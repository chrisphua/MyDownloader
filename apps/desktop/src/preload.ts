import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,

  startDownload: (jobId: string, url: string, format: string, resolution: string) =>
    ipcRenderer.invoke("start-download", jobId, url, format, resolution),

  saveFile: (jobId: string) =>
    ipcRenderer.invoke("save-file", jobId),

  onProgress: (cb: (jobId: string, data: { percent: number; speed: string; eta: string }) => void) => {
    const handler = (_: unknown, jobId: string, data: { percent: number; speed: string; eta: string }) => cb(jobId, data);
    ipcRenderer.on("download-progress", handler);
    return () => ipcRenderer.off("download-progress", handler);
  },

  onDone: (cb: (jobId: string, filename: string) => void) => {
    const handler = (_: unknown, jobId: string, filename: string) => cb(jobId, filename);
    ipcRenderer.on("download-done", handler);
    return () => ipcRenderer.off("download-done", handler);
  },

  onError: (cb: (jobId: string, message: string) => void) => {
    const handler = (_: unknown, jobId: string, message: string) => cb(jobId, message);
    ipcRenderer.on("download-error", handler);
    return () => ipcRenderer.off("download-error", handler);
  },
});
