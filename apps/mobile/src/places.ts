export type Category = "All" | "Coffee" | "Pizza" | "Bakery" | "Ramen";
export type Place = {
  id: string;
  name: string;
  category: Exclude<Category, "All">;
  neighborhood: string;
  address: string;
  coordinate: [number, number];
  image: string;
  note: string;
};

// Curated demo content, not a live restaurant search or availability feed.
export const places: Place[] = [
  {
    id: "coffee",
    name: "Sunday Coffee",
    category: "Coffee",
    neighborhood: "Kensington Market",
    address: "Kensington Ave, Toronto",
    coordinate: [-79.4004, 43.6547],
    image:
      "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=400&h=400&fit=crop",
    note: "A slow morning, a good flat white, and a seat by the window.",
  },
  {
    id: "pizza",
    name: "Little Slice",
    category: "Pizza",
    neighborhood: "Little Italy",
    address: "College St, Toronto",
    coordinate: [-79.4142, 43.6552],
    image:
      "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=400&fit=crop",
    note: "Crispy edges, a little char, and one more slice for the walk.",
  },
  {
    id: "bakery",
    name: "Butter & Crumb",
    category: "Bakery",
    neighborhood: "Trinity Bellwoods",
    address: "Dundas St W, Toronto",
    coordinate: [-79.4129, 43.6503],
    image:
      "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=400&fit=crop",
    note: "Flaky pastries and something sweet to take to the park.",
  },
  {
    id: "ramen",
    name: "Noodle House",
    category: "Ramen",
    neighborhood: "Chinatown",
    address: "Spadina Ave, Toronto",
    coordinate: [-79.3985, 43.6517],
    image:
      "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=400&fit=crop",
    note: "A cozy corner for a big bowl of broth and a little comfort.",
  },
  {
    id: "espresso",
    name: "Good Company",
    category: "Coffee",
    neighborhood: "Queen West",
    address: "Queen St W, Toronto",
    coordinate: [-79.406, 43.6477],
    image:
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=400&fit=crop",
    note: "Meet a friend, order a coffee, stay a little longer.",
  },
  {
    id: "bread",
    name: "Morning Ritual",
    category: "Bakery",
    neighborhood: "The Annex",
    address: "Bloor St W, Toronto",
    coordinate: [-79.4074, 43.6655],
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=400&fit=crop",
    note: "Fresh bread and a small everyday reason to get outside.",
  },
];

export const categories: Category[] = [
  "All",
  "Coffee",
  "Pizza",
  "Bakery",
  "Ramen",
];
export const mapCenter = [-79.406, 43.6555];
