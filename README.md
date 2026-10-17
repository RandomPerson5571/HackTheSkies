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

The Favorites tab opens your personal ranking, Friends, and Rewards pages:

- Rate spots from one to five stars and reorder your ranking with the up/down
  buttons. Rating a place saves it and marks it visited. Clearing a rating keeps
  the visit; removing a visit or saved place also removes its rating and ranking.
- Add or remove fictional sample friends, filter their visit activity, and save
  their recommendations. This is an on-device demo, without accounts, real friend
  requests, or live social activity.
- Earn Japanese, bakery, coffee, and pizza badges by visiting distinct spots.
  Progress comes from the shared Visited collection, so repeat taps cannot inflate it.
- Earn points: 10 for each different spot visited, plus 50 for your first spot in a
  new region. Regions are drawn areas of the sample city
  (see `apps/mobile/src/features/rewards/models/rewards.ts`); places outside them
  fall into roughly 2 km grid cells. Restaurant cards show what a visit would earn.
- Complete monthly challenges for bonus points, Strava-style: visit 3 spots, eat in
  2 regions, discover a new region, and a featured food type that rotates each month.
  Challenges use the date each place was marked visited and reset on the 1st.
  Visits saved before dates were tracked keep their points but don't count toward challenges.

Ratings, ranking, and sample friend selections persist with the restaurant journal.
Older saved-list files load without losing existing bookmarks or visits.

## Food Dex

The Food Dex tab groups food discoveries by Japanese, Italian, Mexican, Indian,
Chinese, and Thai cuisine, with four starter dishes per cuisine. Other cuisines
and custom dishes can be added too. Each cuisine shows starter-dish progress and
its collected foods. Repeat discoveries of the same dish in a cuisine do not
increase progress. Discoveries and captured photos are saved on the device.
Open a discovery to view its photo/date or remove an accidental addition.

Choose **Scan a new bite**, take a photo or select one from your library, then
choose **Analyze photo**. Review or correct the suggested dish and cuisine before
adding it. Manual entry works without a recognition service, including when
offline or camera access is denied. Photos are sent for recognition only when
Analyze photo is pressed, using the OpenAI
[image input API](https://developers.openai.com/api/docs/guides/images-vision).

To enable recognition locally:

1. Copy `apps/web/.env.example` to `apps/web/.env.local` and set `OPENAI_API_KEY`.
   Keep this key on the server; never put it in a public mobile environment variable.
   Configure the Supabase public variables in the same example for the web app's
   session middleware as well.
2. Run `pnpm dev:web` to serve `/api/food-scan`.
3. Set `EXPO_PUBLIC_FOOD_SCAN_URL` in `apps/mobile/.env` to that endpoint, e.g.
   `http://localhost:3000/api/food-scan` for the iOS simulator. For a physical phone,
   use the development computer's LAN IP; Android emulator uses `10.0.2.2`.
4. Rebuild the mobile development client (`pnpm ios` or `pnpm android`) for the
   new image-picker native module and camera/photo permission descriptions.

The recognition route is intended for local development. Before exposing it as a
public service, add authenticated access and a shared rate limit for API usage.
Photo requests are bounded to 8 MB of base64 data and time out; recognition errors
keep the photo available for retry or manual entry. Live AI recognition requires
a configured API key and network connection.

UI references from Mobbin: [Woolworths cuisine browsing](https://mobbin.com/screens/7531ca44-b035-416f-9d9d-48dff270bd6c),
[Alma collection cards](https://mobbin.com/screens/a8cb20c1-d653-4348-b40a-08aaffbe4972),
and [Life Reset food scanning](https://mobbin.com/flows/31b12473-9be8-4428-9a65-962ba177f25a).


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
