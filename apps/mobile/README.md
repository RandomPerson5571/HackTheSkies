# Mobile app

The Expo entry remains `index.ts` → root `App.tsx` → `src/app/App.tsx`.
Navigation stays in the app shell; this project does not use Expo Router.

- `src/features/restaurants`: restaurant screens, collection state, domain models, and imported restaurant data.
- `src/features/food-dex`: discovery screen, collection state, domain models, and scanning service.
- `src/features/community`: community screens and badge/friend models.
- `src/features/profile`: profile screen and editing UI.
- `src/components/maps`: shared map contract and separate native/web implementations.
- `src/theme`: shared color tokens.
- `tests`: centralized domain tests, run with `node --test tests/*.test.mjs` from this directory.

Each feature exports its public API through `index.ts`. Within a feature, use direct relative imports; shared TypeScript imports can also use `@/` for `src/`. Keep pure model imports direct in Node tests so they do not load React Native screens.

FoodDex and the photo recognition endpoint share the cuisine taxonomy and local dish catalog in [`packages/food-catalog`](../../packages/food-catalog/README.md). That guide covers refreshing provider dishes, optional photo searches, and image credits/review.

FoodDex uses all 15 cuisine collections and the imported meal catalog. Downloaded photos are registered in `src/features/food-dex/data/catalogImages.ts` for offline bundling; the default catalog import regenerates this file. `services/catalogPhotos.ts` resolves these assets, and `components/PhotoCredit.tsx` exposes their source and license links. Review flags remain catalog metadata and do not suppress photos.

The native map uses `@rnmapbox/maps` and requires a compatible development build. The browser map uses `mapbox-gl`. Both read `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` and optionally `EXPO_PUBLIC_MAPBOX_STYLE_URL`. Platform resolution keeps the native map dependency out of the web bundle.

Both maps render restaurant points and clusters through Mapbox layers, with at most
eight marker views for visible suggested places and the current selection. Only
suggested places mount photos; other selections use a plain pin. Cluster taps zoom into the group; labels
appear at neighborhood zoom and use collision detection. Keep the shared GeoJSON
payload in `src/components/maps/placeFeatures.ts` limited to coordinates, IDs, and
names. Selection and unrelated UI updates must not rebuild that source or create
per-restaurant marker views. The browse sheet mounts its virtualized photo list only
while open.

Restaurant suggestions use `models/recommendations.ts`: 60% average rating quality
and 40% a lesser-known bonus based on log-scaled review count. Suggestions require
an average of at least 4/5 and a combined score of at least 75/100. Missing ratings
are not treated as high quality or zero popularity. Supabase supplies community
aggregates from clearly labeled fictional reviews. Personal ratings contribute one
additional vote, update rather than duplicate that vote, and sync to the device's
private cloud journal. Restaurant lists, detail cards, and community photos share
the same suggestion eligibility rule.

Add shared components, storage adapters, clients, and providers when needed; avoid empty placeholder folders. Expo configuration and scripts live here, while workspace configuration stays at the repository root.

## Supabase

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (see `.env.example`), then restart Expo. Only the public publishable key belongs in the app.

The app uses Supabase without login, signup, anonymous Auth users, or accounts. A cryptographically random device key allows access to that device's private journal through narrowly scoped database functions. Restaurants and fictional reviews are public and read-only. Bookmarks, visits, ratings, custom lists, followed sample reviewers, profile settings, and Food Dex discovery metadata sync to Supabase, with local caching and automatic retries. Food photos stay on the device.

See [Supabase setup and verification](../../docs/supabase.md) for schema, seeding, and access details.

Restaurant CSV listings are bundled in `src/features/restaurants/data/importedRestaurants.json`
from the two files in the repository's `data/` directory. To refresh their coordinates,
run `python3 scripts/import-restaurants.py` from the repository root (requires network
access). Existing coordinates are cached. Addresses are geocoded with OpenStreetMap;
listings with approximate matches say so in their description. Listing source URLs
and original cuisine/service categories are retained. The shared restaurant collection
feeds both map platforms, restaurant search, and saved lists. Imported listing photos
use a generic restaurant image rather than venue-specific photography.

### AI food recommender

Tap the sparkles button at the top right of the map to describe a craving and get up to three restaurant suggestions. Tap a suggestion to locate it on the map. Suggestions use the restaurant directory and your profile’s dietary preference.

Set `GROQ_API_KEY` in `apps/mobile/.env.server.local`, then run `pnpm dev` (app and API) or `pnpm dev:server` (API only). Optionally override `GROQ_RECOMMENDATION_MODEL` (default: `llama-3.3-70b-versatile`). The integration uses [Groq Chat Completions](https://console.groq.com/docs/text-chat).

Set `EXPO_PUBLIC_FOOD_RECOMMENDATIONS_URL=http://localhost:3000/api/food-recommendations` in `apps/mobile/.env.local` and restart Expo. For a physical phone, replace `localhost` with your computer’s LAN IP. Keep the Groq key on the server; never put it in an `EXPO_PUBLIC_` variable.

Restaurant images use the checked-in `restaurantPhotos.json` source manifest with
source/author/license credits. All restaurant lists and detail cards show images.
Where a restaurant-specific image could not be found, the app shows a catalog
food illustration explicitly labeled as not photographed at that restaurant.
Map photos retain recommendation and viewport limits. No image API key is needed.
To retry missing restaurant images for personal use, run
`python3 scripts/import-restaurant-photos.py` from the repository root. The importer
preserves existing entries, checks image responses, and writes an unmatched/source
error report to `data/restaurant-photo-import-report.json`. Source-site images are
remote and have unspecified reuse rights; Wikimedia licenses remain attached.

### Food camera and detection

The center camera button opens `FoodCameraScreen` above the persistent navigation.
`useLiveFoodDetection` runs one local sampling/inference job at a time, targeting at
most 5 Hz; actual throughput includes Expo still capture and resize latency.
ML Kit runs on iOS/Android; browser builds use COCO-SSD's ten food categories.
Frames are normalized to upright JPEGs; overlays map aspect-fill crops and mirror
the live front preview. Captured-image overlays use unmirrored photo coordinates.
Missing foods lose their visible boxes immediately, and IDs survive one missed
inference. Reduced motion disables geometry animation and pulsing.

The shutter pauses local sampling, captures a photo, re-detects its food regions,
compresses a selected crop to at most 1024 px, and calls Groq to observe the dish,
cuisine, and visible ingredients without sending the catalog. The server retrieves
up to 12 candidates from that cuisine, ranking canonical names and dish descriptions
(including accent-insensitive matches). When an observed name exactly matches a
canonical name in one cuisine, that catalog cuisine corrects the retrieval category.
A second vision call verifies the photo
against those candidates and returns a candidate ID or `NO_MATCH`. The default
Qwen model uses a strict JSON schema with an enum of the retrieved IDs; the server
also validates membership. Other configured models use JSON-object output with
the same server validation. Non-food photos and categories without candidates
skip verification. A valid `NO_MATCH` keeps the observed name/cuisine for manual
confirmation with no catalog badge. Provider errors remain retryable failures.

This retrieval uses the bundled catalog, so it needs no database or embedding
service. It limits prompt growth as the catalog expands, at the cost of a second
model call and a second image input. Retrieval depends on the observed cuisine;
a wrong cuisine can exclude the correct dish. Both calls share one 25-second
deadline and cancellation signal. Retake or navigation cancels recognition and
ignores late results. The suggestion carries
into the Food Dex form; users confirm before collecting a dish. Preview frames
never leave the device. Model loading failure does not prevent manual capture.

Set server-only `GROQ_API_KEY` and optionally `GROQ_FOOD_SCAN_MODEL` in `apps/mobile/.env.server.local`.
The mobile app uses `EXPO_PUBLIC_FOOD_SCAN_URL`. Rebuild the native client after
installing dependencies; ML Kit isn't included in Expo Go or supported by the iOS
simulator. Test on physical phones for detection quality, alignment, memory,
shutter latency, and sustained sampling rate before shipping.

Browser capture uses `FoodCameraView.web.tsx`: an inline, muted, `playsInline`
video stream from `getUserMedia`, with local canvas capture for the custom shutter.
It never uses a file input with `capture` or opens the device camera app. Browser
access requires HTTPS or localhost and camera permission. Streams stop on retake
preview, backgrounding, and leaving the camera tab. The shared app shell keeps
the bottom navigation mounted above the camera view.

### Consolidated project

This directory contains the iOS, Android, browser, and API application.
`pnpm dev` starts Expo and the API together; `pnpm dev:web` selects the browser
preview of this same app. The Restaurants screen includes Saved, cuisine filters,
A–Z/discovery sorting, and Surprise me. Startup imports legacy browser bookmarks
into the journal before storage hydration, once per browser origin.

`server/routes` preserves `/api/food-scan` and `/api/food-recommendations`;
`server/http.ts` adapts Node HTTP streams to Web Request/Response handlers,
including request cancellation. `server/app.ts` routes APIs and serves the
exported `dist` app. `server/tsconfig.json` checks Node code separately from Expo
so server-only code and credentials aren't bundled into the client.

Run `pnpm build` then `pnpm start` from the repository root to serve the browser
build and APIs on one origin. Server environment lives in `.env.server.local`,
using `.env.server.example` as a template. App environment lives in `.env.local`.
