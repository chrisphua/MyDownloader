import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import path from "node:path";
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, createReadStream } from "node:fs";
import { rm, copyFile, mkdir } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let win: BrowserWindow | null = null;

// ── Binary paths ──────────────────────────────────────────────────────────────
// Binaries are bundled per-platform: yt-dlp/ffmpeg on macOS, yt-dlp.exe/ffmpeg.exe
// on Windows. Packaged → Resources/ (via extraResource); dev → binaries/ folder.

function getBinPath(name: "yt-dlp" | "ffmpeg"): string {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  if (app.isPackaged) {
    return path.join(process.resourcesPath, exe);
  }
  return path.join(__dirname, "../../binaries", exe);
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

// Turn yt-dlp's raw stderr into a message a non-technical user can act on.
// yt-dlp prints fatal errors on lines prefixed with "ERROR:". We surface those,
// and map the common ones to a plain-English hint + next step.
function explainFailure(stderrLines: string[]): string {
  const errLines = stderrLines.filter((l) => /^\s*ERROR:/i.test(l));
  const raw = (errLines.length ? errLines : stderrLines.slice(-3)).join("\n").trim();
  const hay = raw.toLowerCase();

  if (/sign in to confirm your age|age-restricted|inappropriate for some users/.test(hay))
    return "This video is age-restricted and can't be downloaded without signing in.";
  if (/private video|members-only|join this channel/.test(hay))
    return "This video is private or members-only, so it can't be downloaded.";
  if (/video unavailable|removed by the uploader|account associated.*terminated/.test(hay))
    return "This video is unavailable — it may have been removed or set to private.";
  if (/is not available in your country|geo|blocked it in your country/.test(hay))
    return "This video is blocked in your region.";
  if (/unable to extract|unsupported url|nsig extraction failed|player response|failed to extract any player response/.test(hay))
    return "Couldn't read this video — the site likely changed. A newer app version with an updated downloader should fix it.";
  if (/unable to download|http error 4|http error 5|connection|timed out|getaddrinfo|network is unreachable/.test(hay))
    return "Network error reaching the site. Check your connection and try again.";
  if (/requested format is not available/.test(hay))
    return "That format/resolution isn't available for this video — try a different one.";

  // Fall back to yt-dlp's own message rather than a generic catch-all.
  if (raw) return raw.replace(/^\s*ERROR:\s*/i, "").slice(0, 300);
  return "Download failed — check that the URL is valid and publicly accessible.";
}

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
    // Keep a rolling tail of stderr so a failed run can report the real reason.
    const stderrTail: string[] = [];
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
    proc.stderr.on("data", (d: Buffer) => {
      d.toString().split("\n").forEach((line) => {
        parseLine(line);
        const t = line.trim();
        if (t) {
          stderrTail.push(t);
          if (stderrTail.length > 40) stderrTail.shift();
        }
      });
    });

    proc.on("error", (err) => {
      // spawn itself failed (e.g. bundled binary missing or not executable)
      job.done = true;
      job.error = `Couldn't start the downloader: ${err.message}`;
      win?.webContents.send("download-error", jobId, job.error);
      void rm(tmpDir, { recursive: true, force: true });
      jobs.delete(jobId);
    });

    proc.on("close", async (code) => {
      // The "error" handler may have already cleaned up a failed spawn.
      if (!jobs.has(jobId)) return;
      if (code !== 0) {
        job.done = true;
        job.error = explainFailure(stderrTail);
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

// Open an external URL in the user's default browser (allowlisted hosts only).
ipcMain.handle("open-external", (_event, url: string) => {
  try {
    const { protocol, hostname } = new URL(url);
    const allowed = hostname === "github.com" || hostname.endsWith(".github.com");
    if (protocol === "https:" && allowed) void shell.openExternal(url);
  } catch { /* ignore malformed URL */ }
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
