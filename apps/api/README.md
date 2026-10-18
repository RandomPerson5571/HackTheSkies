# Cibo API · Cloudflare Workers

This workspace owns every server endpoint. The Expo app is a separate client.
Routes retain their existing request and response formats:

- `POST /api/food-scan`: base64 JPEG/PNG → dish, cuisine and verified catalog ID.
- `POST /api/food-recommendations`: preferences → known restaurant IDs and reasons.
- `GET /health`: health check. API routes also support CORS preflight.

## Local development

Copy `.dev.vars.example` to `.dev.vars` and set the server-only `GROQ_API_KEY`.
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
`process.env`. Uploaded bodies are size-limited, upstream calls have timeouts, and
responses disable caching. Images are forwarded to Groq for recognition; the
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
