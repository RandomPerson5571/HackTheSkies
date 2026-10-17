"""Find restaurant-specific photos without API keys. Run from repository root.
Keeps existing curated photos, rejects directory-wide cover images, records misses.
Website images retain source attribution; their reuse license is not established.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
import html
import json
from pathlib import Path
import re
import time
import unicodedata
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'apps/mobile/src/features/restaurants/data/restaurantPhotos.json'
REPORT = ROOT / 'data/restaurant-photo-import-report.json'
HEADERS = {'User-Agent': 'HackTheSkiesPersonalPhotoResearch/1.0'}

def normal(value):
    return re.sub(r'[^a-z0-9]+', ' ', unicodedata.normalize('NFKD', html.unescape(value)).encode('ascii', 'ignore').decode().lower()).strip()

class Node:
    def __init__(self, tag='', attrs=None, parent=None):
        self.tag, self.attrs, self.parent = tag, {key: value or '' for key, value in (attrs or [])}, parent
        self.children = []
    def text(self):
        if self.tag in ('script', 'style', 'nav', 'footer', 'header'): return ''
        return ' '.join(c if isinstance(c, str) else c.text() for c in self.children)
    def nodes(self):
        yield self
        for c in self.children:
            if isinstance(c, Node): yield from c.nodes()

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = self.current = Node()
    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in ('img','meta','link','input','br','hr','source','area','base','embed','wbr'): self.current = node
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)
    def handle_endtag(self, tag):
        node = self.current
        while node.parent:
            if node.tag == tag:
                self.current = node.parent
                return
            node = node.parent
    def handle_data(self, data): self.current.children.append(data)

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=12) as response:
        return response.read(4_000_000).decode('utf-8', errors='replace'), response.url

def image_url(node, base):
    for key in ('data-src', 'data-lazy-src', 'src'):
        raw = node.attrs.get(key, '')
        if raw and not raw.startswith('data:'):
            url = urllib.parse.urljoin(base, html.unescape(raw))
            url = urllib.parse.quote(url, safe=":/?&=%+#@!$,;()[]~*'")
            if urllib.parse.urlparse(url).scheme in ('http','https') and not re.search(r'logo|favicon|avatar|placeholder|spinner|tracking|pixel|\.svg(?:\?|$)', url, re.I):
                return url
    return None

def find_photos(url, rows, follow=True):
    try:
        raw, base = fetch(url)
        parser = Page(); parser.feed(raw)
        nodes = list(parser.root.nodes())
        result = {}
        names = {r['id']: normal(r['restaurant_name']) for r in rows}
        for row in rows:
            name = names[row['id']]
            if len(name) < 4: continue
            # A cover image is usable only when the page heading identifies this restaurant.
            headings = [normal(n.text()) for n in nodes if n.tag in ('h1','title')]
            page_match = any(name in h and len(h) < len(name) + 100 for h in headings)
            if len(rows) == 1 and page_match:
                for node in nodes:
                    if node.tag == 'meta' and node.attrs.get('property', node.attrs.get('name')) in ('og:image','twitter:image'):
                        fake = Node('img', [('src', node.attrs.get('content',''))])
                        photo = image_url(fake, base)
                        if photo:
                            result[row['id']] = (photo, base, 'restaurant-page-heading'); break
            if row['id'] in result: continue
            # Match an image inside a short card containing exactly one restaurant name.
            for node in nodes:
                if node.tag != 'img': continue
                photo = image_url(node, base)
                if not photo: continue
                ancestor = node
                for _ in range(5):
                    if not ancestor: break
                    text = normal(ancestor.text() + ' ' + node.attrs.get('alt',''))
                    if name in text and len(text) < len(name) + 400:
                        others = [other for identity, other in names.items() if identity != row['id'] and other != name and len(other) >= 4 and other in text]
                        if not others:
                            result[row['id']] = (photo, base, 'named-directory-card'); break
                    ancestor = ancestor.parent
                if row['id'] in result: break
        if follow:
            for row in rows:
                if row['id'] in result: continue
                name = names[row['id']]
                for node in nodes:
                    if node.tag != 'a' or not node.attrs.get('href'): continue
                    text = normal(node.text())
                    if name not in text or len(text) > len(name) + 60: continue
                    target = urllib.parse.urljoin(base, node.attrs['href'])
                    if urllib.parse.urlparse(target).scheme not in ('http', 'https') or target.split('#')[0] == base.split('#')[0]: continue
                    found, _ = find_photos(target, [row], follow=False)
                    if found:
                        result.update(found)
                    break
        return result, None
    except Exception as exc:
        return {}, str(exc)

def working_image(url):
    try:
        request = urllib.request.Request(url, headers={**HEADERS, 'Range': 'bytes=0-100'})
        with urllib.request.urlopen(request, timeout=7) as response:
            valid = response.headers.get('Content-Type', '').startswith('image/')
            response.read(100)
            return valid
    except Exception:
        return False

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--workers', type=int, default=3); args = parser.parse_args()
    rows = json.loads((ROOT/'apps/mobile/src/features/restaurants/data/importedRestaurants.json').read_text())
    photos = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    grouped = {}
    for row in rows:
        if row['id'] not in photos: grouped.setdefault(row['source_url'], []).append(row)
    report = {'sources': [], 'unmatched': []}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        pending = {pool.submit(find_photos, url, group): url for url, group in grouped.items()}
        for i, future in enumerate(as_completed(pending), 1):
            url = pending[future]; matches, error = future.result()
            for identity, (image, source, method) in matches.items():
                if identity in photos or not working_image(image): continue
                photos[identity] = {'url': image, 'sourceUrl': source, 'photographer': None, 'licenseName': None, 'licenseUrl': None, 'capturedAt': '', 'verifiedAt': time.strftime('%Y-%m-%d'), 'provider': 'source-website', 'matchMethod': method, 'rights': 'Not specified by source; personal-use integration', 'description': next(r['restaurant_name'] for r in rows if r['id']==identity)}
            report['sources'].append({'url': url, 'matches': len(matches), 'error': error})
            OUTPUT.write_text(json.dumps(photos, ensure_ascii=False, indent=2)+'\n')
            if i % 10 == 0: print(f'{i}/{len(grouped)} source pages checked; {len(photos)} restaurant photos', flush=True)
    report['unmatched'] = [{'id': r['id'], 'name': r['restaurant_name'], 'sourceUrl': r['source_url']} for r in rows if r['id'] not in photos]
    report['matched'] = len(photos); report['total'] = len(rows)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(f'Finished: {len(photos)}/{len(rows)} restaurant-specific photos; {len(report["unmatched"])} unmatched.', flush=True)

if __name__ == '__main__': main()
