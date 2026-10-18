# Cibo API · Cloudflare Workers

This workspace owns every server endpoint. The Expo app is a separate client.
Routes retain their existing request and response formats:

- `POST /api/food-scan`: base64 JPEG/PNG → dish, cuisine and verified catalog ID.
- `POST /api/food-recommendations`: preferences → known restaurant IDs and reasons.
- `GET /health`: health check. API routes also support CORS preflight.
- `POST /api/restaurants`: map bounds to a count or up to 400 image-free places, combining Overpass/OpenStreetMap and Geoapify.

## Local development

Copy `.dev.vars.example` to `.dev.vars` and set the server-only `GROQ_API_KEY` and `GEOAPIFY_API_KEY`.
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
origin, then restart Expo. All four client integrations use this origin. Existing
per-route public URL overrides remain supported; remove stale overrides when
switching origins. For local use, simulators use `http://localhost:8787`, Android
emulators use `http://10.0.2.2:8787`, and physical devices use the Mac's LAN IP.

The Worker receives credentials through request-scoped bindings, never by mutating
`process.env`. Uploaded bodies are size-limited and upstream calls have timeouts.
Non-map responses disable caching. Images are forwarded to Groq for recognition; the
Worker does not store uploads. Camera preview frames are never sent. Authentication
and abuse protection remain deployment considerations for this public API.

Restaurant map requests use the visible map bounds. Below zoom 12 the app requests
only an OpenStreetMap count, with no place records or map pins. At zoom 12 and
above, it requests details from both Overpass/OpenStreetMap and Geoapify, merges
and deduplicates the results, and caps returned places at 400. Responses are
cached for 10 minutes in the app and Worker. Points have no image URL; the map
renders them as annotations. Configure the Geoapify key as a Worker secret for
production and in `.dev.vars` for local development.

The bundled offline sample is `data/global-restaurant-sample.json`. To add
records in undercovered areas without replacing existing entries, run
`node scripts/collect-undercovered-restaurants.mjs`. It preserves country and
coordinate fields, has no images, and stops at 400 records. The sample is
spatially sampled, so it does not claim complete country coverage.

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
