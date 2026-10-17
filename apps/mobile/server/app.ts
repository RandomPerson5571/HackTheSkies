import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as foodScan from "./routes/food-scan.ts";
import * as foodRecommendations from "./routes/food-recommendations.ts";

const routes: Record<
  string,
  { POST: (request: Request) => Promise<Response>; OPTIONS: () => Response }
> = {
  "/api/food-scan": foodScan,
  "/api/food-recommendations": foodRecommendations,
};
const defaultRoot = fileURLToPath(new URL("../dist/", import.meta.url));
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

export async function handleRequest(
  request: Request,
  staticRoot = defaultRoot,
): Promise<Response> {
  const url = new URL(request.url);
  const route = routes[url.pathname];
  if (route) {
    if (request.method === "OPTIONS") return route.OPTIONS();
    if (request.method === "POST") return route.POST(request);
    return Response.json(
      { error: "Method not allowed." },
      { status: 405, headers: { Allow: "POST, OPTIONS" } },
    );
  }
  if (url.pathname.startsWith("/api/"))
    return Response.json({ error: "Not found." }, { status: 404 });
  if (url.pathname === "/health") return Response.json({ status: "ok" });
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  try {
    const root = await realpath(staticRoot);
    const pathname = decodeURIComponent(url.pathname);
    let candidate = path.resolve(root, `.${pathname}`);
    if (candidate !== root && !candidate.startsWith(root + path.sep))
      return new Response(null, { status: 404 });
    // Block hidden files, while allowing Expo’s generated pnpm asset paths.
    if (
      pathname
        .split("/")
        .some((part) => part.startsWith(".") && part !== ".pnpm")
    )
      return new Response(null, { status: 404 });
    try {
      if ((await stat(candidate)).isDirectory())
        candidate = path.join(candidate, "index.html");
    } catch {
      if (path.extname(pathname)) return new Response(null, { status: 404 });
      candidate = path.join(root, "index.html");
    }
    const resolved = await realpath(candidate);
    if (!resolved.startsWith(root + path.sep))
      return new Response(null, { status: 404 });
    return new Response(
      request.method === "HEAD"
        ? null
        : new Uint8Array(await readFile(resolved)),
      {
        headers: {
          "Content-Type":
            mime[path.extname(resolved)] ?? "application/octet-stream",
          "Cache-Control": "no-cache",
        },
      },
    );
  } catch {
    return Response.json(
      {
        error:
          "Browser app not built. Run pnpm build, or use pnpm dev:web for the browser preview.",
      },
      { status: 404 },
    );
  }
}
