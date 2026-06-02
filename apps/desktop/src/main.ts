import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "node:path";
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, createReadStream } from "node:fs";
import { rm, copyFile, mkdir } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let win: BrowserWindow | null = null;

// ── Binary paths ──────────────────────────────────────────────────────────────
// In dev: binaries/ folder next to src/
// In production: Resources/bin/ (extraResources) and asar.unpacked (ffmpeg-static)

function getBinPath(name: "yt-dlp" | "ffmpeg"): string {
  if (app.isPackaged) {
    // Both binaries are in Resources/ via extraResource
    return path.join(process.resourcesPath, name);
  }
  // Dev: use binaries/ folder next to apps/desktop/
  return path.join(__dirname, "../../binaries", name);
}

// ── Download jobs ─────────────────────────────────────────────────────────────

interface Job {
  tmpDir: string;
  format: string;
  done: boolean;
  filename?: string;
  error?: string;
}

const jobs = new Map<string, Job>();

ipcMain.handle(
  "start-download",
  (_event, jobId: string, url: string, format: string, resolution: string) => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), "ytdl-"));
    const job: Job = { tmpDir, format, done: false };
    jobs.set(jobId, job);

    const ytdlp = getBinPath("yt-dlp");
    const ffmpeg = getBinPath("ffmpeg");

    const args = [
      "--output", path.join(tmpDir, "%(title)s.%(ext)s"),
      "--no-playlist", "--newline", "--no-colors",
      "--ffmpeg-location", ffmpeg,
    ];

    if (format === "mp3") {
      args.push("--extract-audio", "--audio-format", "mp3", "--audio-quality", "0");
    } else {
      const fmtStr = resolution
        ? `bestvideo[height<=${resolution}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${resolution}]`
        : "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best";
      args.push("--format", fmtStr, "--merge-output-format", "mp4");
    }
    args.push(url);

    const proc = spawn(ytdlp, args);
    const pctRe = /\[download\]\s+([\d.]+)%\s+of\s+[\d.]+\S+\s+at\s+([\d.]+\S+)\s+ETA\s+(\S+)/;
    const postRe = /\[(ExtractAudio|Metadata|Merger|VideoConvertor|EmbedThumbnail|ThumbnailsConvertor)\]/;

    function parseLine(line: string) {
      const m = line.match(pctRe);
      if (m) {
        win?.webContents.send("download-progress", jobId, {
          percent: parseFloat(m[1] ?? "0"),
          speed: m[2] ?? "",
          eta: m[3] ?? "",
        });
        return;
      }
      if (postRe.test(line)) {
        win?.webContents.send("download-progress", jobId, { percent: 100, speed: "", eta: "Processing…" });
      }
    }

    proc.stdout.on("data", (d: Buffer) => d.toString().split("\n").forEach(parseLine));
    proc.stderr.on("data", (d: Buffer) => d.toString().split("\n").forEach(parseLine));

    proc.on("close", async (code) => {
      if (code !== 0) {
        job.done = true;
        job.error = "yt-dlp failed — check that the URL is valid and publicly accessible";
        win?.webContents.send("download-error", jobId, job.error);
        await rm(tmpDir, { recursive: true, force: true });
        jobs.delete(jobId);
        return;
      }
      const files = readdirSync(tmpDir);
      if (!files.length) {
        job.done = true;
        job.error = "No output file produced";
        win?.webContents.send("download-error", jobId, job.error);
        await rm(tmpDir, { recursive: true, force: true });
        jobs.delete(jobId);
        return;
      }
      job.filename = files[0]!;
      job.done = true;
      win?.webContents.send("download-done", jobId, job.filename);
    });
  },
);

// Save completed file to user-chosen location
ipcMain.handle("save-file", async (_event, jobId: string) => {
  const job = jobs.get(jobId);
  if (!job?.done || !job.filename) return { error: "File not ready" };

  const ext = path.extname(job.filename);
  const defaultName = job.filename;

  const { filePath, canceled } = await dialog.showSaveDialog(win!, {
    defaultPath: path.join(homedir(), "Downloads", defaultName),
    filters: ext === ".mp3"
      ? [{ name: "Audio", extensions: ["mp3"] }]
      : [{ name: "Video", extensions: ["mp4"] }],
  });

  if (canceled || !filePath) {
    await rm(job.tmpDir, { recursive: true, force: true });
    jobs.delete(jobId);
    return { canceled: true };
  }

  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  await copyFile(path.join(job.tmpDir, job.filename), filePath);
  await rm(job.tmpDir, { recursive: true, force: true });
  jobs.delete(jobId);
  return { savedTo: filePath };
});

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  win = new BrowserWindow({
    width: 620,
    height: 520,
    minWidth: 480,
    minHeight: 440,
    titleBarStyle: "hiddenInset",
    title: "MyDownloader",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
