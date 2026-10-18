# Cibo · HackTheSkies

`apps/mobile` is the Expo application for iOS, Android and browsers.
`apps/api` is the separate Cloudflare Workers API for food recognition,
restaurant recommendations and quest personalization.

## Start developing

Use Node.js 24+ and pnpm 11.25.0.

```sh
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars
# Set GROQ_API_KEY in apps/api/.dev.vars.
pnpm dev
```

Set `EXPO_PUBLIC_API_URL=http://localhost:8787` in `apps/mobile/.env.local`.
`pnpm dev` runs Expo and the local Worker; `pnpm dev:web` selects browser preview.
Use your Mac's LAN IP for physical devices, or `10.0.2.2:8787` for Android emulators.
For a deployed API set its HTTPS origin and use `CIBO_REMOTE_API=1 pnpm dev` to
start only Expo. Restart Expo after changing public environment values.

```sh
pnpm ios     # select an iOS simulator or connected device
pnpm android
```

Mapbox requires a custom development build rather than Expo Go. ML Kit and
TensorFlow have been removed: food recognition uploads a captured or selected
photo to the API, so simulator builds no longer depend on native food detection.

## Configuration and deployment

Copy `apps/mobile/.env.example` to `.env.local` and configure the public Mapbox
`pk.*` token and Supabase public project settings. See [Supabase setup](docs/supabase.md).
Keep provider keys out of every `EXPO_PUBLIC_*` variable.

See [Cloudflare API setup](apps/api/README.md) for secrets, deployment and testing.
`pnpm deploy:api` deploys all four API routes. Set `EXPO_PUBLIC_API_URL` to the
Worker URL printed by deployment. Supabase storage and journal sync stay unchanged.

## Features

- Restaurant map, search, cuisine/category filters, recommendation-based discovery,
  A–Z sorting, and **Surprise me** for another cuisine.
- Restaurant photos, illustration labels, source/license credits, listing links,
  details, and directions.
- Saved restaurants, Want to try, Visited, custom lists, star ratings, personal
  ranking, sample friend activity, and collection badges.
- Food Dex cuisine collections, discoveries, manual entry, and photo import.
- In-app camera with a persistent bottom bar, shutter, camera switching,
  photo review, retake, and photo-library selection.
- Groq recognition after capture, catalog matching, collected/new labels, and
  confirmation before adding a discovery. The AI food recommender selects from
  actual restaurant IDs and your dietary preference.

Food recognition sends one compressed JPEG of up to 1024 px to the Worker, which
calls Groq to observe the dish and visually verify catalog candidates. Preview
frames never leave the device. Users review the suggestion before collecting a
discovery. Recognition needs an internet connection; manual entry remains available.

## Build the browser app

```sh
pnpm --filter mobile build
```

The static Expo browser app is exported to `apps/mobile/dist` and can be hosted
separately from the API. Configure the public Worker origin before exporting.
`pnpm --filter mobile build:native` verifies native JavaScript bundles; `pnpm ios`
compiles and installs the native simulator app.

## Checks

```sh
pnpm test
pnpm lint
pnpm check-types
```

Tests include the journal, browsing controls, browser bookmark migration, food
recognition, recommendations, and API/static-file routing. Provider tests mock
Groq and don't need an API key.

## Structure

- `apps/mobile/src` — screens, features, UI, storage, and public service clients.
- `apps/mobile/server` — server-only AI routes and HTTP/static-file server.
- `apps/mobile/scripts` — combined development launcher.
- `apps/mobile/tests` and `apps/api/tests` — app and Worker API tests.
- `packages/food-catalog` — cuisine taxonomy, catalog, bundled food images, credits.
- `packages/eslint-config`, `packages/typescript-config` — shared tooling.
- `packages/ui` — optional browser component library; the main app uses React Native.
- `scripts`, `data`, `supabase`, `docs` — imports, data, database setup, and guides.

See [mobile architecture](apps/mobile/README.md) and
[food catalog maintenance](packages/food-catalog/README.md).
