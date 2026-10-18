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

Set `GROQ_API_KEY` in `apps/api/.dev.vars`, then run `pnpm dev` (app and API) or `pnpm dev:server` (API only). Optionally override `GROQ_RECOMMENDATION_MODEL` (default: `qwen/qwen3.8-27b`). The integration uses [Groq Chat Completions](https://console.groq.com/docs/text-chat).

Set `EXPO_PUBLIC_API_URL=http://localhost:8787` in `apps/mobile/.env.local` and restart Expo. For a physical phone, replace `localhost` with your computer’s LAN IP. Keep the Groq key on the server; never put it in an `EXPO_PUBLIC_` variable.

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

### Food camera and photo recognition

The camera offers **take a photo** or **choose a photo**. Photo selection is always
available, including in an iOS simulator without a working camera. A selected or
captured image is converted to JPEG, resized to at most 1024 px and uploaded once
to the Worker. Preview frames are never analyzed or uploaded. ML Kit, COCO-SSD,
TensorFlow, and continuous detection have been removed.

The Worker identifies the dish and cuisine through Groq, retrieves up to 12 catalog
candidates, then verifies a candidate ID or `NO_MATCH` with a second vision call.
Both calls share one deadline. A recognized dish appears in the frozen photo
review; the user confirms before adding it to Food Dex. Retry sends another
request. Retake and navigation cancel requests and ignore late responses. Missing
configuration and network errors preserve manual entry.

### Separate Cloudflare API

All server routes now live in `apps/api`; the mobile app contains no server.
See [API setup](../api/README.md) for local secrets, deployment and endpoints.
`pnpm dev` starts Expo and a local Worker; `pnpm dev:web` opens the browser preview.
Set `EXPO_PUBLIC_API_URL` to the deployed Worker origin to call it from any device.
Set `CIBO_REMOTE_API=1` when starting Expo to skip the local Worker.

Native Mapbox still requires a development build. After dependency changes run
`pnpm --filter mobile exec expo prebuild --platform ios`, then `pnpm ios` and
select your simulator. The removed ML Kit pods no longer exclude simulator ARM64.

### Cibo Lens

Open **+ → Lens** to photograph or upload a restaurant menu. The photo-first scanner
uses Groq vision to read up to 24 dishes and normalized text boxes, then verifies
catalog candidates in a second, batched request. Tap an anchored marker or a list
row for a catalog photo, origin, description, cuisine discovery count, and collection
action. A scan does not automatically collect dishes; **I tried this** adds one to
the existing Food Dex. The sample menu works without a server and cannot add demo
entries to the collection.

The Worker’s `GROQ_API_KEY` and app’s `EXPO_PUBLIC_API_URL` configuration are reused.
Optionally set `EXPO_PUBLIC_MENU_SCAN_URL` to a separate endpoint and
`GROQ_MENU_SCAN_MODEL` on the server to a vision-capable model (default:
`qwen/qwen3.8-27b`). Restart Expo after changing public environment variables.
For local development, physical devices need the computer's LAN address; deployed HTTPS Workers work on any network.

Dietary flags use the profile's Vegetarian, Vegan, or Pescatarian preference.
They indicate possible ingredients, never allergy safety. A rare find means an
uncollected dish from a cuisine with fewer than two discoveries. Unknown matches
remain readable discoveries without a canonical badge or fabricated catalog photo.

This first release analyzes a single compressed capture, not video frames. Boxes
are model estimates anchored to the frozen image, with a list alternative for
missing or imprecise positions. Live tracking, on-device ML Kit OCR, embeddings,
and Skia rendering are not part of this photo-first implementation. The camera
uses the existing Expo dependency; no new native modules are required.

### Cibo Quests

The Quests tab contains optional restaurant challenges. Visits are self-reported,
each restaurant counts once per adventure, and rewards can be claimed once.
Weekly/monthly periods run for 7/30 days from joining. Challenge progress and XP
save locally under `cibo.quests.v1` and do not currently sync to Supabase.


### Haptics and game feedback

`src/lib/sensory.ts` owns feedback events. Use `playFeedback(name)` for one
coordinated sound and haptic response; shared `FeedbackPressable` controls provide
quiet click/selection feedback automatically. Avoid pairing a feedback event with
an extra Expo vibration.

Basic taps, selections, confirmations and errors use `expo-haptics`. Android uses
`performAndroidHapticsAsync`; iOS and supported browsers use Expo's impact,
selection and notification methods. Hardware and OS settings can suppress haptics,
including while the iOS camera is active.

Native game effects use `react-native-pulsar`: reward → CoinDrop, chest → Unfurl,
new cuisine → Pip, badge → Fanfare, level up → Ascent, discovery → Sonar,
and capture → CameraShutter. Presets are preloaded, with generated sound enabled.
The stable Pulsar 1.7 API does not support custom synchronized audio files yet.
Web, Expo Go and clients without Pulsar use Expo haptics plus bundled WAVs.

After installing dependencies, rebuild the native development client with
`pnpm ios` or `pnpm android` from the repository root. Reloading JavaScript alone
cannot add Pulsar or Worklets to an existing native client. Worklets is aligned
with Expo SDK 57's bundled version; Expo's Babel preset enables its plugin.
