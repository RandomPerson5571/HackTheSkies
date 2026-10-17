import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, mkdir, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { handleRequest } from "../app.ts";
const request = (url, method = "GET") =>
  new Request(`http://localhost${url}`, { method });
test("AI endpoints retain their URLs and HTTP method/preflight behavior", async () => {
  for (const route of ["/api/food-scan", "/api/food-recommendations"]) {
    assert.equal((await handleRequest(request(route))).status, 405);
    const response = await handleRequest(request(route, "OPTIONS"));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  }
  assert.equal((await handleRequest(request("/api/missing"))).status, 404);
  assert.deepEqual(await (await handleRequest(request("/health"))).json(), {
    status: "ok",
  });
});
test("the same server serves the exported app without exposing hidden files or escaping dist", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "cibo-server-"));
  const root = path.join(temporary, "dist");
  await mkdir(root);
  await writeFile(path.join(root, "index.html"), "<h1>Cibo mobile</h1>");
  await writeFile(path.join(root, "app.js"), "console.log('Cibo');");
  await mkdir(path.join(root, "assets", "node_modules", ".pnpm"), {
    recursive: true,
  });
  await writeFile(
    path.join(root, "assets", "node_modules", ".pnpm", "icons.ttf"),
    "font-data",
  );
  await writeFile(path.join(temporary, "secret.txt"), "private");
  await writeFile(path.join(root, ".env"), "private");
  await symlink(
    path.join(temporary, "secret.txt"),
    path.join(root, "outside.txt"),
  );
  try {
    assert.match(
      await (await handleRequest(request("/"), root)).text(),
      /Cibo mobile/,
    );
    assert.match(
      await (await handleRequest(request("/food-dex"), root)).text(),
      /Cibo mobile/,
    );
    assert.equal(
      (await handleRequest(request("/app.js"), root)).headers.get(
        "Content-Type",
      ),
      "text/javascript; charset=utf-8",
    );
    assert.equal(
      await (await handleRequest(request("/app.js", "HEAD"), root)).text(),
      "",
    );
    assert.equal(
      await (
        await handleRequest(
          request("/assets/node_modules/.pnpm/icons.ttf"),
          root,
        )
      ).text(),
      "font-data",
    );
    for (const url of [
      "/.env",
      "/outside.txt",
      "/%2e%2e%2fsecret.txt",
      "/missing.js",
    ])
      assert.equal((await handleRequest(request(url), root)).status, 404);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
