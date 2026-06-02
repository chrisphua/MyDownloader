# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Commands

```bash
# Install dependencies
cd apps/desktop && npm install

# Run in dev mode
npm start

# Build installable zip for Apple Silicon
npm run make:mac

# Download bundled yt-dlp + ffmpeg binaries (run once before building)
npm run download-binaries
```

## Architecture

Single Electron app in `apps/desktop/`. No server, no cloud — fully self-contained.

```
apps/desktop/
  binaries/       — yt-dlp + ffmpeg ARM64 binaries (gitignored)
  src/
    main.ts       — Electron main process; spawns yt-dlp/ffmpeg via IPC
    preload.ts    — exposes IPC channels (startDownload, saveFile, onProgress, onDone, onError)
    App.tsx       — React UI
    renderer.tsx  — React root
    index.css     — styles
  forge.config.ts — Electron Forge config; extraResource bundles the binaries
```

**How it works:** user pastes a URL → renderer calls `window.electron.startDownload()` → main process spawns `yt-dlp` with the bundled `ffmpeg` → progress streamed back via IPC → native Save dialog on completion.

**Supported sites:** YouTube, TikTok, Instagram, Facebook, Twitter/X, SoundCloud, Vimeo, and 1000+ others via yt-dlp.

**Build output:** `apps/desktop/out/make/zip/darwin/arm64/MyDownloader-darwin-arm64-*.zip`
