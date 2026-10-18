/* global __dirname */
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("onnx");

// This shared source folder has no package manifest, so Expo does not discover it.
config.watchFolders = [
  ...config.watchFolders,
  path.resolve(__dirname, "../../packages/map-restaurants"),
];

// Keep the separate Worker and all local credentials out of app assets.
config.resolver.blockList = [
  ...config.resolver.blockList,
  /[/\\]apps[/\\]mobile[/\\](server|scripts)[/\\].*/,
  /[/\\]apps[/\\]api[/\\].*/,
  /[/\\]\.env(?:\.[^/\\]*)?$/,
  /[/\\]\.dev\.vars(?:\.[^/\\]*)?$/,
];

module.exports = config;
