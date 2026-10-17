# HackTheSkies

A pnpm workspace with a Next.js web app, an Expo React Native mobile app,
and a shared React UI package. All app code uses TypeScript.

## Structure

- `apps/web` — Next.js App Router web app, running at http://localhost:3000.
- `apps/mobile` — Expo SDK 57 mobile app for iOS and Android.
- `packages/ui` — shared React browser components (`@repo/ui`), used by the web app.
- `packages/eslint-config` — shared ESLint configuration.
- `packages/typescript-config` — shared TypeScript configuration.

## Get started

Use Node.js 24 or newer and pnpm 11.25.0 (pinned in `package.json`).

```sh
pnpm install
pnpm dev:web
```

Start the mobile development server in another terminal:

```sh
pnpm dev:mobile
```

The mobile app is a Luma-inspired food discovery map using native Mapbox. It
includes photo markers, food categories, local search, a places sheet, a detail
card, external directions, and bookmarks saved on the device. The Restaurants tab adds searchable discovery,
Want to try and Visited tracking, and custom lists (for example, weekend brunch
or date night). Lists and bookmarks stay in sync and persist between launches. Six
fictional sample places around Toronto are included; search filters this bundled
sample data, not a live restaurant service. Photos are loaded from Unsplash.

The Favorites tab opens your personal ranking, Friends, and Badges pages:

- Rate spots from one to five stars and reorder your ranking with the up/down
  buttons. Rating a place saves it and marks it visited. Clearing a rating keeps
  the visit; removing a visit or saved place also removes its rating and ranking.
- Add or remove fictional sample friends, filter their visit activity, and save
  their recommendations. This is an on-device demo, without accounts, real friend
  requests, or live social activity.
- Earn Japanese, bakery, coffee, and pizza badges by visiting distinct spots.
  Progress comes from the shared Visited collection, so repeat taps cannot inflate it.

Ratings, ranking, and sample friend selections persist with the restaurant journal.
Older saved-list files load without losing existing bookmarks or visits.


Before running the map:

1. Copy `apps/mobile/.env.example` to `apps/mobile/.env`.
2. Set `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` to your Mapbox **public** token (`pk.*`).
   Get one from [Mapbox access tokens](https://console.mapbox.com/account/access-tokens/).
   Never put a secret token in an `EXPO_PUBLIC_` variable.
3. Optionally set `EXPO_PUBLIC_MAPBOX_STYLE_URL` to a Mapbox Studio style URL.
   The default is Mapbox Light.
4. Build and launch the development client:

```sh
pnpm ios
# or
pnpm android
```

After the initial native build, `pnpm dev:mobile` starts Metro for that client.
Rebuild after adding or changing native dependencies. Mapbox requires a native
development build and does not run in Expo Go. Without a public token, the app
shows setup guidance and still allows browsing the sample places.

The iOS simulator requires macOS and Xcode. Android requires an Android Studio
emulator or a connected device. See the
[Mapbox Expo installation guide](https://github.com/rnmapbox/maps/blob/main/plugin/install.md).

Design reference: [Luma’s map on Mobbin](https://mobbin.com/screens/fb378b19-93e3-4cac-b862-fd3208c4c59e).

Run `pnpm dev` to start both development servers through Turborepo. Use
`pnpm dev:mobile` when you want Expo's interactive terminal controls.

## Checks and builds

```sh
pnpm lint
pnpm check-types
pnpm build
```

`pnpm build` creates the Next.js production build. Mobile development uses Metro;
creating installable mobile binaries is a separate Expo/EAS or native build step.
To check mobile bundling locally:

```sh
pnpm --filter mobile exec expo export --platform ios --platform android
```

## Where to edit

- Web home page: `apps/web/app/page.tsx`.
- Mobile home screen: `apps/mobile/App.tsx`.
- Shared browser components: `packages/ui/src/`.

The web app imports `@repo/ui/code` as an example of workspace component sharing.
Use React Native components for mobile screens; the existing UI package renders
browser elements.
