/* global __dirname */
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The API lives beside the app, but its source and credentials are never app assets.
config.resolver.blockList = [
  ...config.resolver.blockList,
  /[/\\]apps[/\\]mobile[/\\](server|scripts)[/\\].*/,
  /[/\\]\.env(?:\.[^/\\]*)?$/,
];

module.exports = config;
