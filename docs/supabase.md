# Cibo Supabase backend

The app is connected to the configured Supabase project. There are no login/signup screens, no anonymous Supabase Auth sessions, and no new `auth.users` records.

## Setup and seed

1. Set the public URL/key in `apps/mobile/.env.local` using its `.env.example`.
2. Set `SUPABASE_DB_URL` in the ignored root `.env.local`, using `.env.example` as a guide. Use a session pooler connection if your network does not support the direct database's IPv6 address. Percent-encode the password.
3. Run `pnpm db:setup` from the repository root. It applies tracked SQL migrations and seeds the catalog in one transaction. Running it again updates the same sample rows without duplicating reviews or touching device journals.
4. Run `pnpm db:verify` for live access and persistence checks. It creates random test-only device documents and removes just those records afterward.
5. Restart Expo. This integration adds no new native module.

The initial seed includes 541 imported restaurant listings, 12 fictional reviewer personas, and 3,783 fictional reviews. Review text, ratings, and visit dates are synthetic. The app labels these as sample community reviews/activity; the personas are content records, not accounts. The bundled restaurant JSON remains an offline fallback.

## Data and access

- `public.cibo_restaurants`: restaurant IDs and listing payloads, including existing photo credits and location accuracy.
- `public.cibo_reviewers`: fictional names, handles, and bios.
- `public.cibo_reviews`: seeded text reviews and visits linked to restaurants and fictional reviewers.
- `public.cibo_restaurant_ratings`: aggregate sample ratings. Personal ratings are combined once in the app's existing recommendation model, rather than published into this sample feed.
- `cibo_private.documents`: separate `collection`, `profile`, and `foodDex` documents per device, keyed by the SHA-256 hash of a random 256-bit secret.

Public tables have row level security and read-only grants for the app's `anon` role. The private schema has no client access. Only `cibo_read_document` and `cibo_write_document` accept a valid device secret and operate on the matching hash and one permitted section. Their search paths are fixed; callers cannot choose another device's hash or enumerate journals. The write function limits document shape and size (1 MiB).

The device secret is issued by `cibo_issue_device_key`, using Postgres’ cryptographic UUID generator and SHA-256, and saved to AsyncStorage before the first cloud write. Issuing a key creates no row or account. First-time key issuance needs a connection; offline edits remain local until syncing is possible. It is the capability needed to access the device's data. Clearing app storage or reinstalling loses that key; there is no account-based recovery or automatic transfer to another device. Do not share or log the key.

Local journal snapshots are cached in AsyncStorage with a dirty flag; previous browser/native journal files are imported on first use. Writes are serialized per section and retry on subsequent edits, foregrounding, or every 30 seconds while mounted. Late cloud responses do not replace edits made while loading. Uploaded Food Dex documents contain discovery metadata; photo files/data URLs remain local and are merged back from the local cache.

Keep the administrator connection string in the ignored root `.env.local`. It is used only by setup/verification scripts and is never bundled into Expo.
