import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('photos', Path(__file__).parents[1] / 'import-restaurant-photos.py')
photos = importlib.util.module_from_spec(spec)
spec.loader.exec_module(photos)

class RestaurantPhotoMatchingTests(unittest.TestCase):
    rows = [{'id': 'one', 'restaurant_name': 'Happy Noodles'}, {'id': 'two', 'restaurant_name': 'Pizza Palace'}]

    def find(self, markup, rows=None):
        with patch.object(photos, 'fetch', return_value=(markup, 'https://example.com/directory')):
            return photos.find_photos('https://example.com/directory', rows or self.rows)[0]

    def test_directory_cover_is_not_a_restaurant_photo(self):
        self.assertEqual(self.find('<title>Restaurants</title><meta property="og:image" content="/cover.jpg">'), {})

    def test_individual_cards_match_the_correct_images(self):
        result = self.find('<article><h2>Happy Noodles</h2><img src="/noodles.jpg"></article><article><h2>Pizza Palace</h2><img src="/pizza.jpg"></article>')
        self.assertEqual(result['one'][0], 'https://example.com/noodles.jpg')
        self.assertEqual(result['two'][0], 'https://example.com/pizza.jpg')

    def test_single_listing_heading_required_for_cover(self):
        self.assertEqual(self.find('<h1>Unrelated Restaurant</h1><meta property="og:image" content="/cover.jpg">', self.rows[:1]), {})

    def test_logo_is_rejected(self):
        self.assertEqual(self.find('<article>Happy Noodles<img src="/logo.png"></article>'), {})

if __name__ == '__main__': unittest.main()
