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

The camera offers **take a photo**, **choose a photo**, and **Live scan**.
Live scan starts enabled and sends one preview snapshot after a 1.6-second pause,
before the user presses the shutter. Toggle it off and on to recognize a new dish.
The food-trained YOLO11n-Seg model runs locally through ONNX Runtime on browser and native cameras.
Its bounding boxes stay invisible. Label cards hug the tracked box corners and
move with it; arrows connect them to the tracked box perimeter, using Reanimated
and respecting reduced motion. Missed detections retain the last valid box for
700 ms, then stop rendering its arrows and geometry. The detector locates generic food regions; Groq supplies dish names. Unseen meals may still be missed.
Tracking frames stay on device. Initial identification and up to two fallback
snapshots can be uploaded to Groq per scan session, with an 800 ms debounce,
7-second cooldown, and one request in flight. Groq identity is independent of
localization: a valid YOLO track stays live, while Groq-only discoveries freeze
the exact analyzed frame. Reliable 0–1000 estimates use a dashed amber box for
the duration of the photo review; missing locations show a discovery card
without a box. Box positions come only from YOLO or Groq detection results. Invalid or non-food results never render object boxes. The model is bundled with the app. The browser ONNX runtime still downloads on first use.
Browser inference runs in a worker; native inference samples serialized camera
snapshots and may follow more slowly than a dedicated frame processor.
Pressing the shutter freezes the photo and identifies it with Groq. The recognition
screen stays open after success or failure; users choose **Continue to review**
once identification finishes, or retry identification or retake the photo.

Native tracking requires rebuilding the development client after installing
`onnxruntime-react-native`: run `pnpm --filter mobile exec expo prebuild`, then
`pnpm ios` or `pnpm android`. Reloading JavaScript cannot add this module.
The model is [food-trained YOLO11n-Seg](https://huggingface.co/kris-0918/lidar-food-measurable-yolo11n-seg)
(AGPL-3.0), pinned to revision `4b766bcfc0e249deca6912229bbb3956beacac05`.
Its bundled ONNX export uses a fixed 416×416 RGB input and only five box/score
channels. Mask outputs are removed because tracking only needs boxes. This input
has 42% of the pixels of 640×640; accuracy at this size must be checked on target
meals. NMS suppresses duplicate anchors at IoU 0.45 with confidence 0.3.
Frames run sequentially with at least 300 ms idle time, increased to the preceding
frame's processing time on slower devices. Browser tracking pauses in hidden tabs;
native tracking pauses when the app is inactive. Native inference uses two CPU
threads. These limits control load, but are not a phone FPS or battery benchmark.
See `assets/models/README.md` for provenance and reproduction.

### Separate Cloudflare API

All server routes now live in `apps/api`; the mobile app contains no server.
See [API setup](../api/README.md) for local secrets, deployment and endpoints.
`pnpm dev` starts Expo and a local Worker; `pnpm dev:web` opens the browser preview.
Set `EXPO_PUBLIC_API_URL` to the deployed Worker origin to call it from any device.
Set `CIBO_REMOTE_API=1` when starting Expo to skip the local Worker.

Native Mapbox still requires a development build. After dependency changes run
`pnpm --filter mobile exec expo prebuild --platform ios`, then `pnpm ios` and
select your simulator. The removed ML Kit pods no longer exclude simulator ARM64.

For local development, physical devices need the computer's LAN address; deployed HTTPS Workers work on any network.

Dietary flags use the profile's Vegetarian, Vegan, or Pescatarian preference.
They indicate possible ingredients, never allergy safety. A rare find means an
uncollected dish from a cuisine with fewer than two discoveries. Unknown matches
remain readable discoveries without a canonical badge or fabricated catalog photo.

Recognition analyzes a single compressed snapshot. YOLO tracking processes preview
frames locally and does not upload them. On-device OCR, embeddings, and Skia
rendering are not included.

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
