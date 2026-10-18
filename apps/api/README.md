# Cibo API · Cloudflare Workers

This workspace owns every server endpoint. The Expo app is a separate client.
Routes retain their existing request and response formats:

- `POST /api/food-scan`: base64 JPEG/PNG → dish, cuisine and verified catalog ID.
- `POST /api/food-recommendations`: preferences → known restaurant IDs and reasons.
- `GET /api/map-restaurants?bounds=west,south,east,north`: viewport → OpenStreetMap restaurants outside the Toronto demo region.
- `GET /health`: health check. API routes also support CORS preflight.

## Local development

Copy `.dev.vars.example` to `.dev.vars` and set the server-only `GROQ_API_KEY`,
`GROQ_API_KEY_1`, and `GROQ_API_KEY_2`. The API reads secrets from
`apps/api/.dev.vars`; it does not load `apps/mobile/.env.server.local`.
Restart the API after changing this file.
Run `pnpm --filter @cibo/api dev` from the root (port 8787), or `pnpm dev` for
the API and Expo together. `.dev.vars` is ignored and blocked from Metro assets.
Models are configured in `wrangler.jsonc` (currently `qwen/qwen3.8-27b`, verified
against the provider); local `.dev.vars` values can override
them. No Supabase administrator key or database migration is needed.

## Deploy

```sh
wrangler login
pnpm --filter @cibo/api run deploy --secrets-file .dev.vars
# Later updates can use pnpm deploy:api; secrets remain in Cloudflare.
```

Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env.local` to the printed HTTPS Worker
origin, then restart Expo. Client integrations use this origin. Existing
per-route public URL overrides remain supported; remove stale overrides when
switching origins. For local use, simulators use `http://localhost:8787`, Android
emulators use `http://10.0.2.2:8787`, and physical devices use the Mac's LAN IP.

The Worker receives credentials through request-scoped bindings, never by mutating
`process.env`. Uploaded bodies are size-limited, upstream calls have timeouts, and
AI responses disable caching. Restaurant discovery caches successful areas for ten minutes using the Workers Cache API. Images are forwarded to Groq for recognition; the
Worker does not store uploads. Camera preview frames are never sent. Authentication
and abuse protection remain deployment considerations for this public API.

## Verify

```sh
pnpm --filter @cibo/api types
pnpm --filter @cibo/api check-types
pnpm --filter @cibo/api test
pnpm --filter @cibo/api build
```

Tests cover image validation, provider failures, catalog membership, all route
methods/preflights, and isolation of credentials between Worker requests. The
build command bundles the real Worker without publishing it.

## Map restaurant discovery

Toronto stays CSV-only for demonstrations. The explicit demo rectangle is
longitude -79.65 to -79.10, latitude 43.58 to 43.86; it is a demo boundary, not an
exact municipal polygon. Views inside it make no discovery requests. Views
crossing it can discover venues outside, and the server and client both exclude
live Toronto venues. The map uses bundled CSV records rather than Supabase rows.

Elsewhere, map idle triggers a 700 ms debounce. New discovery requires zoom 10+
and a bounding-box area no larger than 0.5 square degrees after outward rounding
to a 0.05-degree grid. This reuses cached results for small pans. Previously loaded
pins remain in wider overview views. The app reports loading, errors with Retry,
and a zoom-in hint; missing API configuration produces an actionable error.

The server validates bounds, limits upstream responses to 8 MB, imposes timeouts,
and falls back from the Kumi Overpass instance to overpass-api.de. Partial/error
responses are not cached as empty areas. Successful responses use the Workers
Cache API for ten minutes (per data center, best effort). No new binding or secret
is needed. The public community services can still be unavailable; this is not
a guaranteed global business directory.

The app keeps up to 2,000 discovered venues in device storage for 24 hours, so
recent pins survive reopening and network failures. Area freshness is ten minutes
within the current session; server caching reduces repeat lookups across sessions.
Listings retain OpenStreetMap source links and attribution. Ratings, photos,
prices, and dietary certifications are not invented. Saved discovery details can
be resolved from the device cache while retained there.

Groq requests rotate through `GROQ_API_KEY`, `GROQ_API_KEY_1`, and `GROQ_API_KEY_2` on HTTP 429. Set all three server secrets for deployment. Empty or duplicate keys are skipped at runtime. Each key is attempted at most once per completion; food scan keeps the selected key for its verification call. If all keys are rate limited, the API returns 429. Retries share the existing request deadline.
