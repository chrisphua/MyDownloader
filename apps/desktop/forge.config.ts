import type { ForgeConfig } from "@electron-forge/shared-types";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { VitePlugin } from "@electron-forge/plugin-vite";
import path from "node:path";

// yt-dlp/ffmpeg are bundled per-platform. On Windows they carry a .exe suffix.
// forge runs on the build machine, so process.platform picks the right files.
const isWin = process.platform === "win32";
const bin = (name: string) => path.join(__dirname, "binaries", isWin ? `${name}.exe` : name);

// macOS code signing is opt-in via env vars (set by CI from repo secrets).
// When APPLE_SIGNING_IDENTITY is present we do a real Developer ID sign +
// notarize; when it's absent the build is left unsigned and CI ad-hoc signs it
// instead (enough to clear the "damaged" error, but still an "unidentified
// developer" prompt). See README → "macOS code signing".
const signingIdentity = process.env.APPLE_SIGNING_IDENTITY;

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: "MyDownloader",
    executableName: "MyDownloader",
    appBundleId: "com.chrisphua.mydownloader",
    // App icon — electron-packager appends .icns (mac) / .ico (win) automatically
    icon: path.join(__dirname, "assets", "icon"),
    // Binaries land in Resources/ — accessed via process.resourcesPath at runtime
    extraResource: [bin("yt-dlp"), bin("ffmpeg")],
    ...(signingIdentity
      ? {
          osxSign: {
            identity: signingIdentity,
            optionsForFile: () => ({
              hardenedRuntime: true,
              entitlements: path.join(__dirname, "entitlements.plist"),
            }),
          },
          ...(process.env.APPLE_ID
            ? {
                osxNotarize: {
                  appleId: process.env.APPLE_ID,
                  appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD!,
                  teamId: process.env.APPLE_TEAM_ID!,
                },
              }
            : {}),
        }
      : {}),
  },
  rebuildConfig: {},
  makers: [
    // macOS — zip (extract and drag .app to Applications)
    { name: "@electron-forge/maker-zip", platforms: ["darwin"], config: {} },
    // Windows — Squirrel installer (.exe)
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: {
        name: "MyDownloader",
        setupIcon: path.join(__dirname, "assets", "icon.ico"),
        setupExe: "MyDownloader-Setup.exe",
      },
    },
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        { entry: "src/main.ts", config: "vite.main.config.ts", target: "main" },
        { entry: "src/preload.ts", config: "vite.preload.config.ts", target: "preload" },
      ],
      renderer: [{ name: "main_window", config: "vite.renderer.config.ts" }],
    }),
  ],
};

export default config;
