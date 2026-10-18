"""Add public review counts to imported restaurants for rarity scoring.
Run from the repository root after import-restaurants.py. Looks up each venue's
Restaurantji page (the listed source, or a page matching its name), checks the
street address, and stores `rating_count` plus `rating_count_source`.
Counts already stored are kept; pass --refresh to look them up again.
Progress is cached in data/restaurant-rating-counts.json, and the app's JSON is
written once at the end so a running dev server doesn't reload on every row.
Requests respect the site's one-second crawl delay.
"""
import json
from pathlib import Path
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request

OUTPUT = Path('apps/mobile/src/features/restaurants/data/importedRestaurants.json')
PROGRESS = Path('data/restaurant-rating-counts.json')
CITY_PAGES = {
    'Etobicoke': ['etobicoke', 'toronto'],
    'North York': ['north-york', 'toronto'],
    'Scarborough': ['scarborough', 'toronto'],
    'East York': ['east-york', 'toronto'],
    'York': ['york', 'toronto'],
}
refresh = '--refresh' in sys.argv
restaurants = json.loads(OUTPUT.read_text())
progress = json.loads(PROGRESS.read_text()) if PROGRESS.exists() else {}
for restaurant in restaurants:
    if restaurant['id'] in progress and not refresh:
        restaurant['rating_count'], restaurant['rating_count_source'] = progress[restaurant['id']]

def slug(name):
    text = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode().lower()
    text = text.replace('&', 'and').replace("'", '').replace('’', '')
    return re.sub(r'[^a-z0-9]+', '-', text).strip('-')

def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'HackTheSkies-ReviewCounts/1.0'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return response.read().decode('utf-8', 'replace')
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            time.sleep(5 * (attempt + 1))
        except Exception:
            time.sleep(5 * (attempt + 1))
        finally:
            time.sleep(1.1)
    return None

def street_key(address):
    # "418 Dundas St W" -> ("418", "dundas"); good enough to reject a namesake.
    parts = re.findall(r'[A-Za-z0-9]+', address.lower())
    number = next((part for part in parts if part.isdigit()), None)
    name = next((part for part in parts if part.isalpha() and len(part) > 2), None)
    return number, name

def candidates(restaurant):
    source = restaurant['source_url']
    if 'restaurantji.com' in source:
        yield source
    listed = re.search(r'restaurantji\.com/on/([a-z-]+)/', source)
    district = restaurant.get('geocodedAddress', {}).get('city_district', '')
    # Former boroughs keep their own pages; Etobicoke rows geocode as Toronto.
    if listed:
        pages = [listed.group(1)]
    elif district in CITY_PAGES:
        pages = CITY_PAGES[district]
    elif restaurant['coordinate'][0] < -79.47:
        pages = CITY_PAGES['Etobicoke']
    else:
        pages = ['toronto']
    for page in pages:
        url = f'https://www.restaurantji.com/on/{page}/{slug(restaurant["restaurant_name"])}-/'
        if url != source:
            yield url

def lookup(restaurant):
    number, street = street_key(restaurant['address'])
    for url in candidates(restaurant):
        page = fetch(url)
        if not page:
            continue
        count = re.search(r'"ratingCount"\s*:\s*"?(\d+)', page)
        text = page.lower()
        listed = 'restaurantji.com' in restaurant['source_url'] and url == restaurant['source_url']
        if count and (listed or (number and street and number in text and street in text)):
            return int(count.group(1)), url
    return None

found = 0
for index, restaurant in enumerate(restaurants):
    if 'rating_count' in restaurant and not refresh:
        found += restaurant['rating_count'] is not None
        continue
    result = lookup(restaurant)
    restaurant['rating_count'], restaurant['rating_count_source'] = result or (None, None)
    found += result is not None
    progress[restaurant['id']] = [restaurant['rating_count'], restaurant['rating_count_source']]
    temporary = PROGRESS.with_suffix('.tmp')
    temporary.write_text(json.dumps(progress, indent=2) + '\n')
    temporary.replace(PROGRESS)
    if index % 25 == 0:
        print(f'{index + 1}/{len(restaurants)} processed, {found} counts', flush=True)
print(f'{found}/{len(restaurants)} restaurants have review counts.', flush=True)
temporary = OUTPUT.with_suffix('.tmp')
temporary.write_text(json.dumps(restaurants, ensure_ascii=False, indent=2) + '\n')
temporary.replace(OUTPUT)
