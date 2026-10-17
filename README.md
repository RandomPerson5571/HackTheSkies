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

Scan the QR code with a compatible Expo Go app, or launch a simulator:

```sh
pnpm ios
pnpm android
```

The iOS simulator requires macOS and Xcode. Android requires an Android Studio
emulator or a connected device. The mobile app uses Expo SDK 57 for compatibility
with the current Expo Go release; see [Expo's setup guidance](https://docs.expo.dev/get-started/create-a-project/).

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
