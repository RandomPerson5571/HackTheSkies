# Mobile app

The Expo entry remains `index.ts` → root `App.tsx` → `src/app/App.tsx`.
Navigation stays in the app shell; this project does not use Expo Router.

- `src/features/restaurants`: restaurant screens, collection state, domain models, and sample place data.
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

Add shared components, storage adapters, clients, and providers when needed; avoid empty placeholder folders. Expo configuration and scripts live here, while workspace configuration stays at the repository root.

## Supabase

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (see `.env.example`), then restart Expo. Import the shared client with `import { supabase } from "@/lib/supabase"` for database, auth, and storage calls. Only use the public publishable key in the app.

Sessions persist with AsyncStorage. The app shell starts token refresh while the native app is active and stops it in the background. Rebuild the development client after installing the native storage dependency. Authentication screens and database synchronization are not added by this setup.
