<p align="center">
  <img src="./assets/banner.png" alt="MyDownloader — download videos & audio from YouTube, TikTok, Instagram, and 1000+ sites" width="100%">
</p>

<p align="center">
  <a href="https://github.com/chrisphua/MyDownloader/releases/latest"><img src="https://img.shields.io/github/v/release/chrisphua/MyDownloader?color=22aa77&label=download" alt="Latest release"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-22aa77" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-555" alt="macOS and Windows">
  <a href="https://github.com/sponsors/chrisphua"><img src="https://img.shields.io/badge/sponsor-%E2%9D%A4-db61a2" alt="Sponsor"></a>
</p>

# MyDownloader

A free, open-source, self-contained video downloader for **macOS and Windows**.
Paste a link from YouTube, TikTok, Instagram, Facebook, and 1000+ other sites —
get an MP3 or MP4 saved straight to your computer. No account, no server, no installs.

**🌐 Landing page:** https://chrisphua.github.io/MyDownloader/

**⬇️ Download:** https://github.com/chrisphua/MyDownloader/releases/latest

## Features

- Download from YouTube, TikTok, Instagram, Facebook, Twitter/X, SoundCloud,
  Vimeo, and 1000+ other sites (via [yt-dlp](https://github.com/yt-dlp/yt-dlp))
- MP3 (audio) or MP4 (video) with resolution control
- Fully self-contained — `yt-dlp` and `ffmpeg` are bundled inside the app
- Runs entirely on your computer; nothing is sent to any server
- Native macOS (Apple Silicon) and Windows (x64) builds

## Install

Download from the [Releases page](https://github.com/chrisphua/MyDownloader/releases/latest):

**macOS (Apple Silicon):**
1. Download `MyDownloader-macOS-arm64.zip`, unzip, drag **MyDownloader.app** to Applications
2. First launch: the app is unsigned, so right-click it → **Open** → **Open** again to confirm (Gatekeeper)
3. Still see _"damaged and can't be opened"_? macOS quarantined it. Run this once in Terminal, then reopen:
   ```bash
   xattr -dr com.apple.quarantine /Applications/MyDownloader.app
   ```

**Windows (10/11, x64):**
1. Download `MyDownloader-Setup.exe` and run it
2. First launch: the app is unsigned, so SmartScreen may warn — click **More info → Run anyway**

Then paste a video URL, pick a format, and download.

## Architecture

Single Electron app — no server, no cloud.

```
apps/desktop/
  binaries/       yt-dlp + ffmpeg ARM64 binaries (gitignored)
  src/
    main.ts       Electron main process; spawns yt-dlp/ffmpeg via IPC
    preload.ts    exposes IPC channels to the renderer
    App.tsx       React UI
    renderer.tsx  React root
    index.css     styles
  forge.config.ts Electron Forge config; bundles the binaries
docs/             GitHub Pages landing page
```

**How it works:** you paste a URL → the renderer calls
`window.electron.startDownload()` → the main process spawns the bundled `yt-dlp`
(using the bundled `ffmpeg` for muxing/conversion) → progress is streamed back
over IPC → a native Save dialog appears when the download finishes.

## Development

```bash
# Install dependencies
cd apps/desktop && npm install

# Download bundled yt-dlp + ffmpeg binaries (run once before building)
npm run download-binaries

# Run in dev mode
npm start

# Build the installable .zip for Apple Silicon
npm run make:mac
```

Build output: `apps/desktop/out/make/zip/darwin/arm64/MyDownloader-darwin-arm64-*.zip`

## Releasing

Releases are built by GitHub Actions. Push a version tag and the
`release` workflow builds macOS (Apple Silicon) + Windows (x64), signs the
macOS app, and attaches both to the GitHub Release:

```bash
# Bump apps/desktop/package.json "version" first, then:
git tag v0.1.2
git push origin v0.1.2
```

Assets land with stable, version-less names
(`MyDownloader-macOS-arm64.zip`, `MyDownloader-Setup.exe`), so the landing
page's `releases/latest/download/...` links never break across releases.

### macOS code signing

By default the macOS build is **ad-hoc signed** — enough to avoid the
"damaged and can't be opened" error, but users still get an "unidentified
developer" prompt and need to right-click → **Open** the first time.

To ship a **notarized** build that opens with no warning, add these repo
secrets (Settings → Secrets and variables → Actions). When present, the
`release` workflow automatically does a Developer ID sign + notarize:

| Secret | What it is |
| --- | --- |
| `APPLE_CERTIFICATE_BASE64` | Your "Developer ID Application" cert exported as `.p12`, then `base64 -i cert.p12 \| pbcopy` |
| `APPLE_CERTIFICATE_PASSWORD` | The password you set when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | Your Apple Developer account email |
| `APPLE_APP_SPECIFIC_PASSWORD` | An [app-specific password](https://support.apple.com/102654) for that Apple ID |
| `APPLE_TEAM_ID` | Your 10-character Apple Developer Team ID |

Requires a paid [Apple Developer Program](https://developer.apple.com/programs/)
membership ($99/yr). With no secrets set, builds stay ad-hoc signed — nothing
breaks.

## Support

MyDownloader is free and open source. If it's useful to you, consider
[sponsoring on GitHub](https://github.com/sponsors/chrisphua) — it helps cover
maintenance and keeps the project free for everyone. 💚

## Disclaimer

**This software is a tool. You are solely responsible for how you use it.**

- MyDownloader is provided for **personal, lawful use only** — for example,
  downloading content you own, content in the public domain, or content you
  have explicit permission to download.
- **The author and contributors take no responsibility for any misuse** of this
  software, nor for any content downloaded with it.
- Downloading copyrighted material without the rights holder's permission may
  violate the terms of service of the source platform and/or the copyright laws
  of your country. Respecting those terms and laws is **your responsibility**.
- **All downloaded content belongs to its respective owners.** This software
  does not grant you any rights to any content. You must ensure you have the
  legal right to download and use any content you obtain with it.
- The software is provided **"as is", without warranty of any kind**. The author
  is not liable for any damages, data loss, or legal consequences arising from
  its use. See [LICENSE](./LICENSE) for the full terms.

By downloading or using MyDownloader, you agree that you understand and accept
these terms and that you will comply with all applicable laws and the terms of
service of any platform you download from.

## License

[MIT](./LICENSE) © 2026 Chris Phua

Bundled third-party components retain their own licenses:
[yt-dlp](https://github.com/yt-dlp/yt-dlp/blob/master/LICENSE) (Unlicense) and
[ffmpeg](https://ffmpeg.org/legal.html) (LGPL/GPL).
