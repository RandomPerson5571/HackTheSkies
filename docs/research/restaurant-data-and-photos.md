# Restaurant data origins and photo API research

Researched October 17, 2026. This documents the existing restaurant feature and a proposed enrichment pipeline; no paid API calls or UI changes were made.

## Where the current restaurants came from

The traceable chain is `data/downtown_toronto_restaurants.csv` (385 rows) and `data/etobicoke_restaurants.csv` (157 rows) → `scripts/import-restaurants.py` → `apps/mobile/src/features/restaurants/data/importedRestaurants.json` → `places.ts`.

542 input rows become 541 unique restaurants. Biwon Korean Restaurant at 473 Dundas St W appears twice. IDs are SHA-256 hashes of normalized name plus address. Each CSV row records a `source_url`; the repository does not establish the original collection method, collection date, or permission to republish the source site's images. A source URL is provenance, not proof that the listing remains current.

Largest recorded source domains across the input CSVs:

- Restaurantji: 93 rows, all Etobicoke.
- Chinatown BIA: 84.
- Destination Toronto: 68.
- Downtown Yonge: 61.
- NowServingTO: 23.
- Queen St West BIA (`queenstwestbia.ca`): 21.
- Eatoutmap: 21.
- Old Town Toronto: 19.
- Mappca: 16.
- Find-open: 26 across both files.

Other sources include restaurant websites, St. Lawrence Market, Yellow Pages, Michelin, delivery sites, and additional directories. See `data/restaurant-source-audit.csv` for all 541 imported records, their original URL, coordinate precision, and a Wikimedia search link. Search links are discovery aids, not confirmed image matches.

Coordinates come from address queries to OpenStreetMap's Nominatim service, not restaurant-level identity verification. 529 records are labeled `address`, 12 `approximate`; even an address match does not prove a business is still operating there. The importer caches entire records by ID, so an existing cache also prevents updates to other source fields unless explicitly refreshed.

Every restaurant currently uses the same Unsplash URL in `places.ts`. It is a generic placeholder, not a restaurant-specific photo. No restaurant history, founding country, or owner origin is established by this audit; cuisine labels cannot establish those facts.

## Recommended sources

### Foursquare Places API: first commercial pilot

Official [search endpoint](https://docs.foursquare.com/fsq-developers-places/reference/place-search) and [photo endpoint](https://docs.foursquare.com/fsq-developers-places/reference/place-photos).

Use `GET https://places-api.foursquare.com/places/search` to find candidates, then `GET https://places-api.foursquare.com/places/{fsq_place_id}/photos`. The current photo documentation requires `X-Places-Api-Version: 2025-06-17`, returns prefix/suffix image metadata, and supports food/drink and storefront classifications. Use its documented URL assembly link, rather than treating the photo metadata endpoint as a JPEG.

This is my first pilot choice for the current Mapbox app, subject to confirming the account's display, attribution, retention, and photo access terms. Actual Toronto match rate and usable-photo coverage have not been measured. Do not assume the open Places dataset makes the photos openly licensed.

The [migration/pricing notice](https://docs.foursquare.com/developer/reference/upcoming-changes) says legacy V3 endpoints were deprecated May 15, 2026, and lists 500 free Pro calls followed by $15 per 1,000 calls in the next band from June 1. This is not a verified photo-endpoint quote: confirm photo tier and account pricing before budgeting a full import. Avoid older tutorials using `/v3/places`.

### Yelp Places API: alternative live enrichment

[Official overview](https://docs.developer.yelp.com/docs/places-intro), [Business Details](https://docs.developer.yelp.com/reference/v3_business_info), and [rate limits](https://docs.developer.yelp.com/docs/places-rate-limiting).

Search `GET https://api.yelp.com/v3/businesses/search`, or use business matching for an existing name/address, then retrieve `/v3/businesses/{id}`. Search includes an image URL; details offers richer business data including photos. Keep the bearer API key on the server. Account plan determines access, quota, and price; these were not tested.

Treat it as live provider content, rather than a permanent photo dump into the repository. Yelp's development guidance permits caching for up to 24 hours and retaining business IDs solely for backend matching. Confirm the applicable production agreement and display requirements before shipping.

### Google Places (New): useful only with a compatible display design

[Photo API](https://developers.google.com/maps/documentation/places/web-service/place-photos) and [policies](https://developers.google.com/maps/documentation/places/web-service/policies).

Obtain photo resource names through Text Search/Place Details, then request `GET https://places.googleapis.com/v1/{photo-resource-name}/media` with a maximum width or height. Preserve required author attribution and refresh references as needed. Do not commit photo references as permanent image assets.

Google's policies restrict storage and require Google Maps when Places results appear on a map. This app uses Mapbox on web and native, including photo markers, so Google is not a drop-in provider for the existing interface. A separately compliant display design would need review. Billing and API credentials are required; no authenticated coverage test was performed.

### OpenStreetMap Overpass: open listing enrichment

[Official community documentation](https://wiki.openstreetmap.org/wiki/Overpass_API).

Query restaurants/cafes/fast food in the app's region using Overpass, including cuisine, address, website, and any `image`, `wikimedia_commons`, or `wikidata` tags. Preserve OSM attribution and applicable database licensing. Image tags are links, not a blanket image reuse license. Coverage must be measured; do not expect an image for every restaurant. Use scheduled regional imports rather than calling shared public instances for every map interaction.

Example request body for `POST https://overpass-api.de/api/interpreter` (bounding box is south, west, north, east):

```text
[out:json][timeout:30];
nwr[amenity~"^(restaurant|cafe|fast_food)$"](43.58,-79.65,43.85,-79.25);
out center tags;
```

### Toronto DineSafe: local public-data verification

[City dataset](https://open.toronto.ca/dataset/dinesafe/).

Use the City's dataset resources to cross-check establishments and inspections, resolving the current download/API resource through its catalog rather than hardcoding an old resource ID. It is a local verification source, not a restaurant image API or a definitive opening-hours feed. Deduplicate inspection records by establishment; inspection outcomes are not customer ratings.

### Wikimedia Commons: reusable photo fallback

[Imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo) and [Toronto restaurant collection](https://commons.wikimedia.org/wiki/Category:Restaurants_in_Toronto).

Search exact restaurant name plus Toronto and verify branch/address from the file description. For selected files request `action=query&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800&format=json&titles=File:...` from `https://commons.wikimedia.org/w/api.php`.

Store the original file page, photographer, license name/URL, attribution text, and retrieval date. Only publish after checking the individual license and location match. Existing `scripts/lib/commons-photos.mjs` already contains license/credit validation for food photos and is a useful pattern; dish-name search logic should not be reused as restaurant identity matching.

## Actual photo leads found

These are recorded in `data/restaurant-photo-candidates.json` and are not wired into the UI:

- [The Rex, August 15, 2026](https://commons.wikimedia.org/wiki/File:The_Rex_Hotel_Jazz_and_Blues_Bar_Toronto,_August_15_2026.jpg): file description explicitly matches 194 Queen Street West. Credits Dillan Payne and states CC BY-SA 4.0. Retrieve the complete license metadata and review the image before publication.
- [Canoe Restaurant, Toronto](https://commons.wikimedia.org/wiki/File:Canoe_Restaurant,_Toronto_(14113432476).jpg): restaurant identified in the description; dated March 2010. Check branch/location, age suitability, and license before use.
- [El Catrin photo candidate](https://commons.wikimedia.org/wiki/File:El_Catrin_Mexican_Restaurant_-_Toronto_(25414365307).jpg): discovered in the indexed El Catrin category, but the individual file page could not be fetched in this research session. License and exact address remain unverified.

These three leads do not demonstrate coverage of the remaining 538 restaurants.

## Implementation path

1. Keep stable internal IDs and attach provider IDs separately. Match normalized name, full street address/unit, and coordinates. Manually review ambiguous chains and all 12 approximate locations; proximity alone is insufficient.
2. Pilot Foursquare and Yelp on a small, varied sample before selecting a paid source. Measure exact branch matches, photos returned, useful food/storefront images, latency, and actual billed requests. No numeric coverage or total cost is claimed yet.
3. Put authenticated calls behind the existing web backend. Apply request limits and provider-specific cache lifetimes. Never place provider secrets in Expo public variables or image URLs sent to clients.
4. Add structured photo metadata rather than only `image: string`: provider, provider place ID, image reference/URL, source page, author, license/attribution, retrieval/expiry, match status, and whether the image is a placeholder. Show credits with photos, including detail and map surfaces where required.
5. For lasting bundled images, prefer individually verified Commons files or owner-supplied images with permission. Where no verified image exists, show an explicit placeholder. Keep venue photos and user dish photos separate.
6. Use restaurant websites only as a final discovery fallback. JSON-LD `Restaurant.image` and Open Graph images can identify candidates but do not confer reuse rights. Check site automation rules and rights before downloading or displaying them. Do not scrape Google/Yelp HTML as a substitute for their supported APIs.

## Scope and validation

Local counts and ID mappings were checked against the current JSON and both CSVs. Public provider documentation was reviewed; no API credentials were used, no paid requests were issued, no images were downloaded, and no runtime files were modified. All 541 restaurants still use the existing placeholder until an enrichment pipeline is implemented. The audit does not certify every original source listing as current.

## Integration update — October 17, 2026

All three candidates were subsequently verified through the Commons Imageinfo API (including coordinates, descriptions, authors, and licenses) and integrated through `restaurantPhotos.json`. Canoe: Navjot Singh, CC BY-SA 2.0; El Catrin: Mark, CC BY 2.0; The Rex: Dillan Payne, CC BY-SA 4.0. Remote thumbnail URLs are used with source/license links and capture years in restaurant views. Existing recommendation-based photo visibility remains in effect. Other restaurants retain the placeholder. Earlier candidate-status statements describe the initial research stage.

## Full-list personal-use integration

The no-key source-page importer (`python3 scripts/import-restaurant-photos.py`) now preserves curated Commons photos and follows recorded restaurant source pages and named directory links. It rejects generic directory covers, logos, and ambiguous multi-restaurant cards. It can be rerun to retry unmatched entries without replacing existing photos. Source-site photos are name/card matches, not manually verified branch photographs; their reuse licenses are unknown and recorded as such.

Current coverage: 227 restaurant-specific image entries and 314 explicitly labeled food illustrations from the existing licensed food catalog, covering all 541 listings. Illustrations are not represented as photos taken at those restaurants. Restaurant lists and details now show images independently of recommendation eligibility; map photo markers retain the existing recommendation and viewport limits. Broken images show a failure state rather than endlessly retrying. Credits link back to the source and, when known, the license. The full set of misses and source errors is recorded in `data/restaurant-photo-import-report.json`.

No API keys are required. The website images are remote and depend on those websites remaining available. This integration does not establish permission for future public redistribution of source-site images.

Image validation: 227 imported image URLs returned an image response; seven broken, inaccessible, or non-image URLs were removed. Their restaurants use labeled illustrations. Validation failures are retained in the import report.
