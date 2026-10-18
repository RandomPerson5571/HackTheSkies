import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { places } from "../apps/mobile/src/features/restaurants/data/places.ts";

if (!process.env.SUPABASE_DB_URL) {
  console.error("Set SUPABASE_DB_URL in the ignored root .env.local file.");
  process.exit(1);
}
const sql = postgres(process.env.SUPABASE_DB_URL, {
  ssl: "require",
  max: 1,
  connect_timeout: 15,
});
const reviewers = [
  ["maya", "Maya Chen", "@mayatastes", "MC", "Always room for ramen."],
  [
    "alex",
    "Alex Rivera",
    "@alexaftercoffee",
    "AR",
    "Coffee first. Everything else later.",
  ],
  [
    "sam",
    "Sam Patel",
    "@crumbtrail",
    "SP",
    "Following the scent of fresh bread.",
  ],
  [
    "jules",
    "Jules Park",
    "@juleseats",
    "JP",
    "Weekend walks and little food discoveries.",
  ],
  ["nora", "Nora Williams", "@noranooodles", "NW", "A noodle for every mood."],
  [
    "leo",
    "Leo Martin",
    "@leoslunch",
    "LM",
    "Lunch breaks are small adventures.",
  ],
  [
    "priya",
    "Priya Shah",
    "@priyaspice",
    "PS",
    "Chasing warm spices and comfort food.",
  ],
  ["oliver", "Oliver Brooks", "@oliverslice", "OB", "One more slice, always."],
  [
    "zoe",
    "Zoe Kim",
    "@zoesbites",
    "ZK",
    "Sharing plates and finding new favorites.",
  ],
  [
    "daniel",
    "Daniel Costa",
    "@danieldines",
    "DC",
    "Exploring Toronto one dinner at a time.",
  ],
  [
    "amina",
    "Amina Hassan",
    "@aminatable",
    "AH",
    "Good company makes every meal better.",
  ],
  [
    "eli",
    "Eli Thompson",
    "@elibakes",
    "ET",
    "Pastries, espresso, and the occasional feast.",
  ],
].map(([id, name, handle, initials, bio]) => ({
  id,
  name,
  handle,
  initials,
  bio,
  is_sample: true,
  avatar_url: `https://i.pravatar.cc/150?u=${id}`,
}));

try {
  await sql.begin(async (tx) => {
    await tx`create schema if not exists cibo_private`;
    await tx`create table if not exists cibo_private.migrations (id text primary key, applied_at timestamptz not null default now())`;
    for (const id of [
      "202610170001_cibo",
      "202610170002_device_keys",
      "202610180001_restaurant_map_viewport",
      "202610180002_favorites_pagination",
      "202610180003_nearby_random_favorites",
      "202610180004_reviewer_avatars",
    ]) {
      const applied =
        await tx`select id from cibo_private.migrations where id = ${id}`;
      if (!applied.length) {
        await tx.unsafe(
          await readFile(
            new URL(`../supabase/migrations/${id}.sql`, import.meta.url),
            "utf8",
          ),
        );
        await tx`insert into cibo_private.migrations (id) values (${id})`;
      }
    }
    const restaurants = places.map((place) => ({
      id: place.id,
      data: tx.json(place),
    }));
    await tx`insert into public.cibo_restaurants ${tx(restaurants, "id", "data")}
      on conflict (id) do update set data = excluded.data`;
    await tx`insert into public.cibo_reviewers ${tx(reviewers)} on conflict (id) do update
      set name = excluded.name, handle = excluded.handle, initials = excluded.initials, bio = excluded.bio, avatar_url = excluded.avatar_url`;
    const reviews = places.flatMap((place, i) =>
      Array.from({ length: 3 + (i % 9) }, (_, j) => {
        const rating = [5, 4, 5, 3, 4, 5, 4, 2, 5, 4, 3, 5][
          (i * 7 + j * 3) % 12
        ];
        const notes =
          rating >= 4
            ? [
                `A lovely ${place.cuisine} find in ${place.neighborhood}. I’d happily come back with friends.`,
                "Warm service and a comforting meal. A great stop during a neighborhood walk.",
                "The flavors were the highlight. Next time I’m bringing someone to share a few dishes.",
                "An easy choice for a relaxed dinner. Left happy and already planning another visit.",
              ]
            : [
                "A decent neighborhood option. The food was enjoyable, though the wait was a little long.",
                "Some dishes worked better than others for me. I’d try a different order next time.",
                "A nice atmosphere, but the meal didn’t quite match my expectations on this visit.",
              ];
        return {
          id: `sample-${place.id}-${j}`,
          restaurant_id: place.id,
          reviewer_id: reviewers[(i + j) % reviewers.length].id,
          rating,
          note: notes[(i + j) % notes.length],
          visited_at: new Date(
            Date.UTC(2026, 9, 16 - ((i + j * 3) % 45), 12 + (j % 9)),
          ).toISOString(),
          is_sample: true,
        };
      }),
    );
    await tx`insert into public.cibo_reviews ${tx(reviews)} on conflict (id) do update
      set rating = excluded.rating, note = excluded.note, visited_at = excluded.visited_at`;
    console.log(
      JSON.stringify({
        restaurants: restaurants.length,
        fictionalReviewers: reviewers.length,
        fictionalReviews: reviews.length,
      }),
    );
  });
} catch (error) {
  console.error(
    "Supabase setup failed:",
    error.code ?? "unknown",
    error.message,
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
