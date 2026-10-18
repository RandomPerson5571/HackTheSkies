import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const expoRequire = createRequire(require.resolve("expo/package.json"));
const metroRequire = createRequire(
  expoRequire.resolve("@expo/metro-config/package.json"),
);
const { transform } = metroRequire("./build/babel-transformer.js");
const babel = metroRequire("@babel/core");
const workletsRoot = dirname(
  require.resolve("react-native-worklets/package.json"),
);

for (const dev of [true, false]) {
  test(`iOS ${dev ? "development" : "release"} supplies every Worklets startup unpacker's code`, () => {
    for (const name of [
      "Value",
      "Synchronizable",
      "CustomSerializable",
      "ShareableHost",
      "ShareableGuest",
      "RemoteFunction",
    ]) {
      const filename = join(
        workletsRoot,
        "src/memory",
        `${name[0].toLowerCase()}${name.slice(1)}Unpacker.native.ts`,
      );
      const { ast } = transform({
        filename,
        src: readFileSync(filename, "utf8"),
        options: {
          projectRoot,
          platform: "ios",
          dev,
          hot: false,
          enableBabelRCLookup: true,
          unstable_transformProfile: "hermes-stable",
          customTransformOptions: { engine: "hermes" },
        },
      });
      const { code } = babel.transformFromAstSync(ast, null, {
        configFile: false,
        babelrc: false,
      });
      const exports = {};
      runInNewContext(code, { exports, __DEV__: dev, global: { Error } });
      const unpacker = exports[`install${name}Unpacker`];
      assert.equal(typeof unpacker, "function", name);
      assert.equal(
        typeof unpacker.__initData?.code,
        "string",
        `${name} missing startup code`,
      );
      assert.ok(unpacker.__initData.code.length > 0, name);
    }
  });
}
