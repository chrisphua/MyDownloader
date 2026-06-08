import { useEffect, useRef, useState } from "react";

type Format = "mp3" | "mp4";
type Resolution = "best" | "1080" | "720" | "480";
type Phase = "idle" | "starting" | "downloading" | "processing" | "done" | "error";

interface Progress { percent: number; speed: string; eta: string }

declare global {
  interface Window {
    electron: {
      platform: string;
      startDownload: (jobId: string, url: string, format: string, resolution: string) => Promise<void>;
      saveFile: (jobId: string) => Promise<{ savedTo?: string; canceled?: boolean; error?: string }>;
      cancelDownload: (jobId: string) => Promise<void>;
      getYtdlpInfo: () => Promise<{ version: string }>;
      updateYtdlp: () => Promise<{ ok: boolean; message: string; version: string }>;
      openExternal: (url: string) => Promise<void>;
      onProgress: (cb: (jobId: string, data: Progress) => void) => () => void;
      onDone: (cb: (jobId: string, filename: string) => void) => () => void;
      onError: (cb: (jobId: string, message: string) => void) => () => void;
    };
  }
}

function makeJobId() {
  return Math.random().toString(36).slice(2, 10);
}

export function App() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("mp3");
  const [resolution, setResolution] = useState<Resolution>("best");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<Progress>({ percent: 0, speed: "", eta: "" });
  const [errorMsg, setErrorMsg] = useState("");
  const [ytdlpVersion, setYtdlpVersion] = useState("");
  const [updateState, setUpdateState] = useState<"idle" | "checking" | "done">("idle");
  const [updateMsg, setUpdateMsg] = useState("");
  const jobIdRef = useRef<string | null>(null);

  const busy = phase === "starting" || phase === "downloading" || phase === "processing";
  const canDownload = url.trim().length > 0 && !busy;

  // Register IPC listeners once
  useEffect(() => {
    const offProgress = window.electron.onProgress((jobId, data) => {
      if (jobId !== jobIdRef.current) return;
      setProgress({ percent: Math.min(data.percent, 100), speed: data.speed, eta: data.eta });
      setPhase(data.eta === "Processing…" ? "processing" : "downloading");
    });

    const offDone = window.electron.onDone(async (jobId) => {
      if (jobId !== jobIdRef.current) return;
      setProgress((p) => ({ ...p, percent: 100 }));
      // Trigger native Save dialog
      const result = await window.electron.saveFile(jobId);
      if (result.canceled) {
        setPhase("idle");
      } else if (result.error) {
        setPhase("error");
        setErrorMsg(result.error);
      } else {
        setPhase("done");
      }
    });

    const offError = window.electron.onError((jobId, msg) => {
      if (jobId !== jobIdRef.current) return;
      setPhase("error");
      setErrorMsg(msg);
    });

    return () => { offProgress(); offDone(); offError(); };
  }, []);

  // Show the active yt-dlp version (resolves after the launch auto-update).
  useEffect(() => {
    void window.electron.getYtdlpInfo().then((info) => setYtdlpVersion(info.version));
  }, []);

  async function handleCancel() {
    const jobId = jobIdRef.current;
    if (!jobId) return;
    await window.electron.cancelDownload(jobId);
    reset();
  }

  async function handleUpdate() {
    setUpdateState("checking");
    setUpdateMsg("");
    const r = await window.electron.updateYtdlp();
    setYtdlpVersion(r.version);
    setUpdateState("done");
    setUpdateMsg(r.ok ? "Downloader is up to date." : r.message);
  }

  function reset() {
    jobIdRef.current = null;
    setPhase("idle");
    setProgress({ percent: 0, speed: "", eta: "" });
    setErrorMsg("");
  }

  async function handleDownload() {
    if (!canDownload) return;
    reset();
    const jobId = makeJobId();
    jobIdRef.current = jobId;
    setPhase("starting");
    await window.electron.startDownload(
      jobId,
      url.trim(),
      format,
      resolution === "best" ? "" : resolution,
    );
  }

  const pct = Math.round(progress.percent);

  return (
    <div className="app">
      <div className="titlebar">MyDownloader</div>

      <div className="content">
        <div className="field">
          <label className="label">Video URL</label>
          <p className="sublabel">YouTube · TikTok · Instagram · Facebook · Twitter · Vimeo · and more</p>
          <input
            className="input"
            placeholder="Paste a link from any supported site…"
            value={url}
            onChange={(e) => { setUrl(e.target.value); if (phase !== "idle") reset(); }}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label className="label">Format</label>
          <div className="chips">
            {(["mp3", "mp4"] as Format[]).map((f) => (
              <button
                key={f}
                className={`chip${format === f ? " chip--active" : ""}`}
                onClick={() => setFormat(f)}
                type="button"
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {format === "mp4" && (
          <div className="field">
            <label className="label">Resolution</label>
            <div className="chips">
              {(["best", "1080", "720", "480"] as Resolution[]).map((r) => (
                <button
                  key={r}
                  className={`chip${resolution === r ? " chip--active" : ""}`}
                  onClick={() => setResolution(r)}
                  type="button"
                >
                  {r === "best" ? "Best" : `${r}p`}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          className={`btn-download${!canDownload ? " btn-download--disabled" : ""}`}
          onClick={() => void handleDownload()}
          disabled={!canDownload}
          type="button"
        >
          {phase === "starting" ? "Starting…" : "Download"}
        </button>

        {busy && (
          <button className="btn-cancel" type="button" onClick={() => void handleCancel()}>
            Cancel
          </button>
        )}

        {(busy || phase === "done") && (
          <div className="progress-box">
            <div className="track">
              <div className="fill" style={{ width: `${progress.percent}%` }} />
            </div>
            <div className="progress-row">
              <span className="progress-pct">
                {phase === "processing" ? "Processing…" : `${pct}%`}
              </span>
              {progress.speed && phase !== "processing" && (
                <span className="progress-meta">{progress.speed} · ETA {progress.eta}</span>
              )}
            </div>
          </div>
        )}

        {phase === "done" && <p className="msg msg--success">Saved to your Downloads folder.</p>}
        {phase === "error" && <p className="msg msg--error">{errorMsg}</p>}

        <div className="engine">
          <span>Downloader engine: yt-dlp {ytdlpVersion || "…"}</span>
          <button
            className="link-btn"
            type="button"
            onClick={() => void handleUpdate()}
            disabled={updateState === "checking"}
          >
            {updateState === "checking" ? "Checking…" : "Check for updates"}
          </button>
        </div>
        {updateMsg && <p className="engine-msg">{updateMsg}</p>}
      </div>

      <footer className="footer">
        <span>Free &amp; open source</span>
        <button
          className="sponsor-link"
          type="button"
          onClick={() => void window.electron.openExternal("https://github.com/sponsors/chrisphua")}
        >
          Sponsor 💚
        </button>
      </footer>
    </div>
  );
}
