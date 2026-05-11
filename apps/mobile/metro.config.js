const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Let Metro see the entire monorepo so workspace packages resolve correctly.
config.watchFolders = [repoRoot];

// Look in the local node_modules first, then the monorepo root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(repoRoot, "node_modules"),
];

// npm workspaces hoists everything to the monorepo root, so apps/mobile/node_modules
// doesn't exist. Metro resolves the bundle entry point as a relative file path
// (./node_modules/expo-router/entry) which it can't find locally. This intercepts
// those paths and converts them to bare module names so nodeModulesPaths kicks in.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (/^(\.+\/)+node_modules\//.test(moduleName)) {
    const bareName = moduleName.replace(/^(\.+\/)+node_modules\//, "");
    return context.resolveRequest(context, bareName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
