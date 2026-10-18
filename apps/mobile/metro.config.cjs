/* global __dirname */
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Keep the separate Worker and all local credentials out of app assets.
config.resolver.blockList = [
  ...config.resolver.blockList,
  /[/\\]apps[/\\]mobile[/\\](server|scripts)[/\\].*/,
  /[/\\]apps[/\\]api[/\\].*/,
  /[/\\]\.env(?:\.[^/\\]*)?$/,
  /[/\\]\.dev\.vars(?:\.[^/\\]*)?$/,
];

module.exports = config;
