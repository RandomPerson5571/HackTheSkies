"""Import CSV restaurants using OpenStreetMap address coordinates.
Run from the repository root. Existing coordinates are cached in the output.
Geocoding attribution: https://www.openstreetmap.org/copyright
"""
from concurrent.futures import ThreadPoolExecutor
import csv
import hashlib
import json
from pathlib import Path
import re
import sys
import time
import urllib.parse
import urllib.request

OUTPUT = Path('apps/mobile/src/features/restaurants/data/importedRestaurants.json')
cache = {row['id']: row for row in json.loads(OUTPUT.read_text())} if OUTPUT.exists() else {}
rows = []
for filename in ['downtown_toronto_restaurants.csv', 'etobicoke_restaurants.csv']:
    with open(Path('data') / filename, encoding='utf-8-sig', newline='') as source:
        for row in csv.DictReader(source):
            row['rating'] = float(row['rating'])
            identity = row['restaurant_name'].strip().lower() + '|' + row['address'].strip().lower()
            row['id'] = 'csv-' + hashlib.sha256(identity.encode()).hexdigest()[:16]
            rows.append(row)

def locate(query):
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({'q': query, 'format': 'jsonv2', 'addressdetails': 1, 'limit': 5, 'countrycodes': 'ca'})
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'HackTheSkies-RestaurantImporter/1.0'})
            with urllib.request.urlopen(request, timeout=20) as response:
                features = json.load(response)
            time.sleep(1.1)
            for feature in features:
                lon, lat = float(feature['lon']), float(feature['lat'])
                if -79.65 < lon < -79.25 and 43.58 < lat < 43.85:
                    properties = feature.get('address', {})
                    properties['housenumber'] = properties.get('house_number', '')
                    return {'properties': properties, 'geometry': {'coordinates': [lon, lat]}}
            return None
        except Exception:
            time.sleep(3)
    return None

def geocode(row):
    if row['id'] in cache:
        return {**cache[row['id']], **row}
    address = re.split(r',|#|\bUnit\b|\bSuite\b|\bSte\b|(?:\d+(?:st|nd|rd|th)|Top|Ground|Main|Second)\s+Floor|\bFloor\b', row['address'], flags=re.I)[0].strip()
    address = address.replace('Queens Plate', "Queen's Plate")
    feature = locate(address + ', Toronto, Ontario, Canada')
    if feature is None:
        print('UNRESOLVED:', row['restaurant_name'], row['address'], flush=True)
        return None
    properties = feature['properties']
    exact = properties.get('housenumber', '').lower() == address.split()[0].lower()
    return {**row, 'coordinate': feature['geometry']['coordinates'], 'locationAccuracy': 'address' if exact else 'approximate', 'geocodedAddress': properties}

results = {row['id']: cache[row['id']] for row in rows if row['id'] in cache}
with ThreadPoolExecutor(max_workers=1) as pool:
    for index, result in enumerate(pool.map(geocode, rows)):
        if result:
            results[result['id']] = result
            temporary = OUTPUT.with_suffix('.tmp')
            temporary.write_text(json.dumps(list(results.values()), ensure_ascii=False, indent=2) + '\n')
            temporary.replace(OUTPUT)
        if index % 25 == 0:
            print(f'{index + 1}/{len(rows)} processed', flush=True)
print(f'Imported {len(results)} unique restaurants.', flush=True)

missing = [row for row in rows if row['id'] not in results]
if missing:
    print(f'{len(missing)} addresses still need coordinates.', file=sys.stderr)
    sys.exit(1)
