import type { ForgeConfig } from "@electron-forge/shared-types";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { VitePlugin } from "@electron-forge/plugin-vite";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: "Todo App",
    executableName: "todo-app",
  },
  rebuildConfig: {},
  makers: [
    { name: "@electron-forge/maker-squirrel", config: { name: "todo_app" } },
    { name: "@electron-forge/maker-zip", platforms: ["darwin"], config: {} },
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
