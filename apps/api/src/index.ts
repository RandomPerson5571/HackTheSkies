import * as foodScan from "./routes/food-scan.ts";
import * as foodRecommendations from "./routes/food-recommendations.ts";
import type { ApiEnvironment } from "./environment.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};
const routes: Record<
  string,
  {
    POST: (request: Request, env: ApiEnvironment) => Promise<Response>;
    OPTIONS: () => Response;
  }
> = {
  "/api/food-scan": foodScan,
  "/api/food-recommendations": foodRecommendations,
};

export async function handleRequest(
  request: Request,
  env: ApiEnvironment,
): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (
    pathname === "/health" &&
    (request.method === "GET" || request.method === "HEAD")
  )
    return request.method === "HEAD"
      ? new Response(null, { headers })
      : Response.json({ status: "ok" }, { headers });
  const route = Object.hasOwn(routes, pathname) ? routes[pathname] : undefined;
  if (!route)
    return Response.json({ error: "Not found." }, { status: 404, headers });
  if (request.method === "OPTIONS") return route.OPTIONS();
  if (request.method !== "POST")
    return Response.json(
      { error: "Method not allowed." },
      { status: 405, headers: { ...headers, Allow: "POST, OPTIONS" } },
    );
  try {
    return await route.POST(request, env);
  } catch {
    console.error(JSON.stringify({ event: "api_error", pathname }));
    return Response.json(
      { error: "Please try again." },
      { status: 500, headers },
    );
  }
}

export default { fetch: handleRequest };
