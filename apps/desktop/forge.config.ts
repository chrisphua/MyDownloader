import type { ForgeConfig } from "@electron-forge/shared-types";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { VitePlugin } from "@electron-forge/plugin-vite";
import path from "node:path";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: "MyDownloader",
    executableName: "MyDownloader",
    appBundleId: "com.chrisphua.mydownloader",
    // Both binaries land in Resources/ — accessed via process.resourcesPath at runtime
    extraResource: [
      path.join(__dirname, "binaries", "yt-dlp"),
      path.join(__dirname, "binaries", "ffmpeg"),
    ],
  },
  rebuildConfig: {},
  makers: [
    // macOS — zip (extract and drag .app to Applications)
    { name: "@electron-forge/maker-zip", platforms: ["darwin"], config: {} },
    // Windows
    { name: "@electron-forge/maker-squirrel", config: { name: "MyDownloader" } },
    // Linux
    { name: "@electron-forge/maker-deb", config: {} },
    { name: "@electron-forge/maker-rpm", config: {} },
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
