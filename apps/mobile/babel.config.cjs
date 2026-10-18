const { createRequire } = require("node:module");

// Resolve Expo's preset through Expo itself under pnpm's isolated dependencies.
const requireFromExpo = createRequire(require.resolve("expo/package.json"));

module.exports = function (api) {
  api.cache(true);
  return {
    // Register Worklets explicitly below so native startup never depends on
    // automatic plugin detection or a previously cached untransformed module.
    presets: [
      [
        requireFromExpo.resolve("babel-preset-expo"),
        { worklets: false, reanimated: false },
      ],
    ],
    // Worklets must be the last Babel plugin.
    plugins: [require.resolve("react-native-worklets/plugin")],
  };
};
