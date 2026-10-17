import { createServer } from "node:http";
import { Readable } from "node:stream";
import { once } from "node:events";
import { handleRequest } from "./app.ts";

export function createApiServer(staticRoot?: string) {
  return createServer(async (incoming, outgoing) => {
    const controller = new AbortController();
    outgoing.on("close", () => {
      if (!outgoing.writableEnded) controller.abort();
    });
    incoming.on("aborted", () => controller.abort());
    try {
      const headers = new Headers();
      for (let index = 0; index < incoming.rawHeaders.length; index += 2)
        headers.append(
          incoming.rawHeaders[index]!,
          incoming.rawHeaders[index + 1]!,
        );
      const method = incoming.method ?? "GET";
      const request = new Request(
        new URL(incoming.url ?? "/", "http://localhost"),
        {
          method,
          headers,
          signal: controller.signal,
          ...(method === "GET" || method === "HEAD"
            ? {}
            : {
                body: Readable.toWeb(incoming) as ReadableStream<Uint8Array>,
                duplex: "half",
              }),
        } as RequestInit & { duplex?: string },
      );
      const response = await handleRequest(request, staticRoot);
      if (controller.signal.aborted) return;
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body && method !== "HEAD") {
        const reader = response.body.getReader();
        try {
          while (!controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!outgoing.write(value))
              await once(outgoing, "drain", { signal: controller.signal });
          }
        } finally {
          await reader.cancel().catch(() => {});
        }
      }
      outgoing.end();
      if (!incoming.readableEnded) incoming.resume();
    } catch {
      if (!outgoing.headersSent)
        outgoing.writeHead(500, { "Content-Type": "application/json" });
      if (!outgoing.destroyed)
        outgoing.end(
          JSON.stringify({
            error: "The server couldn’t complete this request.",
          }),
        );
      incoming.resume();
    }
  });
}
