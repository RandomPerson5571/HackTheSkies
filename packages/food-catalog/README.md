# Food catalog

The app's 15 cuisine groups and country/region labels live in `src/cuisines.ts`.
These are product groupings supplied by the app owner, rather than claims about
political boundaries or exclusive culinary origins. FoodDex and the recognition
endpoint both consume this file. Saved `Indian` and `Mexican` discoveries migrate
to `South Asian` and `Latin` when loaded.

`data/seeds.ts` contains 71 curated starter dishes covering every listed region.
`Other` accepts custom discoveries. The app reads `data/catalog.ts` locally;
opening FoodDex never calls the food or photo providers. Restaurant/menu records
and the user's discoveries remain separate from this dish catalog.

## Refreshing dishes and photos

Run from the repository root with Node 24+:

```sh
node --env-file-if-exists=.env.local scripts/import-food-catalog.mjs
```

Or use `pnpm catalog:import`. The importer requests TheMealDB's current area list,
fetches only mapped areas, and merges results with the curated starter dishes.
It takes up to 25 dishes per available area by default (`--limit 5` for a smaller
snapshot; accepted range: 1–100). The current full snapshot has 256 dishes and
256 downloaded photos (188 from TheMealDB and 68 from Wikimedia Commons), about
44 MB of image data. Images retain their review flags.
Names are normalized for case, whitespace, and accent variants within a group.
Curated IDs and descriptions survive a matching provider result. Recipe IDs,
provider areas, image URLs, source pages, and image credits are retained.
`cuisineIds` supports recording additional group associations; FoodDex currently
displays dishes under their primary `cuisine`.

Set importer credentials in a root `.env.local`, or supply them through the shell:

```dotenv
THEMEALDB_API_KEY=1
PEXELS_API_KEY=your_pexels_key
```

`THEMEALDB_API_KEY` defaults to the development key `1`. TheMealDB requires a
supporter key for public app-store releases; see its [API guide](https://www.themealdb.com/api.php).
The optional Pexels key stays in the importer and must not use an `EXPO_PUBLIC_`
prefix. Add `--photos` to search Pexels for dishes still missing an image:

```sh
node --env-file-if-exists=.env.local scripts/import-food-catalog.mjs --photos
```

Without `--photos`, only recipe-supplied images are collected. Existing photo
selections are reused; explicitly reviewed photos survive refreshes. Provider
errors stop the import before replacing the app's catalog. Writes use a temporary
file and rename. No credentials are written into the generated files.

Use `--offline` to regenerate just the curated starters without any network calls.
This removes imported-only dishes from the output. `--output /path/catalog.ts`
and `--report /path/report.json` allow previewing a run in separate files.

### Full list with downloaded pictures

```sh
node --env-file-if-exists=.env.local scripts/import-food-catalog.mjs --all --commons --download-images
```

`--all` removes the local per-area cap and includes every record returned by the
configured provider for mapped regions. It is the full available provider list,
plus curated starters, rather than an exhaustive inventory of every world dish.
The provider may still restrict records by API key, and some listed regions have
no records. Wikimedia fills missing images without an API key, preferring the
image on the dish's Wikipedia article. Requests use batches and respect retry
delays. Unresolved image matches remain explicit in the coverage report.

The command stores:

- `data/catalog.json`: reusable food list, cuisine/region definitions, image URLs,
  source and license credits, local picture paths, and import coverage.
- `data/catalog.md`: a browsable list grouped by cuisine with local pictures and credits.
- `data/images/`: downloaded JPEG, PNG, or WebP pictures for offline use.
- `data/catalog.ts`: the same dishes for FoodDex.
- `data/import-report.json`: provider counts and unresolved coverage.

`--json /path/catalog.json` changes the JSON export location. By default it is
saved beside the TypeScript catalog. Downloads are verified as image responses;
image matches remain candidates until reviewed. Each Wikimedia picture retains
its individual license and artist credit, including share-alike requirements.

## Image review and coverage

New photo candidates have `reviewed: false`. Check that the image matches the
dish and that the source's reuse terms fit your use, then set `reviewed: true`
on its image record in `data/catalog.ts`. FoodDex displays reviewed dish images
with a linked credit. Unreviewed or missing photos use the existing dish icon.
The importer validates HTTPS URLs and provider domains; it does not claim that
image contents or reuse permissions have been automatically verified.

Each image retains the source URL, photographer where supplied, license/terms
URL, and attribution. TheMealDB does not provide individual photographer or
license metadata in its area-filter response; those photographer fields stay
null and its terms page is recorded. Pexels searches are candidates, not verified
dish matches. Its [API guidelines](https://www.pexels.com/api/documentation/)
require a prominent Pexels link and recommend photographer credit; the displayed
credit links back to the Pexels photo page. Keep credits when using exported data.

`data/import-report.json` lists counts per cuisine, missing/unreviewed images,
unmapped provider areas, unavailable candidate area labels (`unsupportedAreas`),
and available areas returning no dishes (`emptyAreas`). An area can appear in the
provider's list while having no meals. Some candidate labels are synonyms; a
missing label does not imply the entire cuisine is unsupported. Provider-only
records retain their area label without inventing finer regional origins.

Run importer tests with `node --test scripts/tests/foodCatalog.test.mjs`.
