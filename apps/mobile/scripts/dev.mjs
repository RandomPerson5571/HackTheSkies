import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import process from "node:process";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const children = [];
let closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
const commands = [
  ["--watch", "--env-file-if-exists=.env.server.local", "server/index.ts"],
  [
    require.resolve("expo/bin/cli"),
    "start",
    "--dev-client",
    ...process.argv.slice(2),
  ],
];
for (const [index, args] of commands.entries()) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: index === 0 ? ["ignore", "inherit", "inherit"] : "inherit",
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => stop(code ?? 0));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
