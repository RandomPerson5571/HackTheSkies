# Cibo · HackTheSkies

`apps/mobile` is the main application for iOS, Android, and browsers. It contains
the Expo interface and the Node server for food recognition and restaurant
recommendations. Both use the shared food catalog and restaurant directory.

## Start developing

Use Node.js 24+ and pnpm 11.25.0.

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts the mobile development server and the API server together.
For a browser preview, run `pnpm dev:web` instead. Both commands run the same
Expo application, including its map, bottom navigation, and in-app food camera.
The API runs at `http://localhost:3000`; Expo prints its preview address.
From `apps/mobile`, `pnpm start --web` also launches both services. Starting
Expo directly requires a separate `pnpm dev:server` for photo recognition.

For native builds:

```sh
pnpm ios
# or
pnpm android
```

Mapbox and ML Kit require a development build; Expo Go does not include all native
modules. The iOS simulator needs macOS and Xcode; ML Kit detection needs a physical
iPhone. Rebuild after changing native dependencies. Use `pnpm dev:mobile` to run
the Expo development client and API, or `pnpm dev:server` for just the API.

## Configuration

- Copy `apps/mobile/.env.example` to `apps/mobile/.env.local` for public app settings.
- Copy `apps/mobile/.env.server.example` to `apps/mobile/.env.server.local` for server settings.
- Set `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` to a public Mapbox `pk.*` token. Optionally
  set `EXPO_PUBLIC_MAPBOX_STYLE_URL`; the default is Mapbox Light.
- Set the public Supabase URL and publishable key for journal sync. See
  [Supabase setup](docs/supabase.md). Browsing and local journal features remain
  available when cloud sync is unavailable.
- Set server-only `GROQ_API_KEY` for food recognition and AI recommendations.
  `GROQ_FOOD_SCAN_MODEL` defaults to `qwen/qwen3.8-27b`, and
  `GROQ_RECOMMENDATION_MODEL` to `llama-3.3-70b-versatile`.
- The app calls `/api/food-scan` and `/api/food-recommendations` using the URLs in
  its public environment file. Physical phones use the computer's LAN IP instead
  of `localhost`; Android emulators use `10.0.2.2`.
- `API_PORT` defaults to 3000 and `API_HOST` to `0.0.0.0`. If changing the port,
  update both public API URLs too.

Keep Groq and database administrator credentials out of `EXPO_PUBLIC_*` values.
The server environment file is ignored by Git and isn't loaded by Expo.
Existing local server settings were preserved during consolidation.

## Features

- Restaurant map, search, cuisine/category filters, recommendation-based discovery,
  A–Z sorting, and **Surprise me** for another cuisine.
- Restaurant photos, illustration labels, source/license credits, listing links,
  details, and directions.
- Saved restaurants, Want to try, Visited, custom lists, star ratings, personal
  ranking, sample friend activity, and collection badges.
- Food Dex cuisine collections, discoveries, manual entry, and photo import.
- In-app camera with a persistent bottom bar, shutter, camera switching,
  photo review, retake, and local food bounding boxes.
- Groq recognition after capture, catalog matching, collected/new labels, and
  confirmation before adding a discovery. The AI food recommender selects from
  actual restaurant IDs and your dietary preference.

Food detection runs locally with ML Kit on native devices and COCO-SSD's ten food
categories in browsers. Native sampling targets at most five jobs per second;
actual throughput depends on capture and inference latency. Browser models download
on first use. Preview images are never uploaded. The shutter sends a JPEG of up
to 1024 px (cropped to selected food when detected) to Groq. Recognition first
observes the dish and cuisine, then retrieves up to 12 catalog candidates from
that cuisine for a second visual verification call. The model selects a retrieved
ID or `NO_MATCH`; the full catalog is never sent. Retrying recognition
or pressing Analyze photo sends another request. Missing recognition configuration
preserves manual entry. Test camera performance and detection quality on devices.

Previous browser bookmarks import once into the mobile app's journal when it runs
on the same origin (protocol, hostname, and port). To keep the old browser address,
build the browser app and serve it on that address using the included server.
Changing origins requires moving browser storage separately. The original bookmark
key is retained as a backup; visits, ratings, lists, and other cached journal data
are preserved during import.

## Build and serve the browser app

```sh
pnpm build
pnpm start
```

This exports the Expo browser app to `apps/mobile/dist`, then serves it and both AI
endpoints from the same Node server. `/health` returns its health status.
`pnpm --filter mobile build:native` verifies iOS and Android bundles; installable
binaries require the native build commands or EAS. Add access controls and a shared
rate limit before exposing AI endpoints as a public service.

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
- `apps/mobile/tests` and `apps/mobile/server/tests` — app and server tests.
- `packages/food-catalog` — cuisine taxonomy, catalog, bundled food images, credits.
- `packages/eslint-config`, `packages/typescript-config` — shared tooling.
- `packages/ui` — optional browser component library; the main app uses React Native.
- `scripts`, `data`, `supabase`, `docs` — imports, data, database setup, and guides.

See [mobile architecture](apps/mobile/README.md) and
[food catalog maintenance](packages/food-catalog/README.md).
