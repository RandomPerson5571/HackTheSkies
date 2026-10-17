import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import postgres from "postgres";

const project = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!project || !key || !process.env.SUPABASE_DB_URL)
  throw new Error("Load root .env.local and apps/mobile/.env.local");
const sql = postgres(process.env.SUPABASE_DB_URL, {
  ssl: "require",
  max: 1,
  connect_timeout: 15,
});
async function request(path, body) {
  const response = await fetch(`${project}/rest/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}
const deviceA = randomBytes(32).toString("hex");
const deviceB = randomBytes(32).toString("hex");
try {
  const issued = await request("rpc/cibo_issue_device_key", {});
  assert.equal(issued.status, 200);
  assert.match(issued.data, /^[a-f0-9]{64}$/);
  const issuedAgain = await request("rpc/cibo_issue_device_key", {});
  assert.notEqual(issued.data, issuedAgain.data);
  const counts = await sql`select
    (select count(*)::int from public.cibo_restaurants) restaurants,
    (select count(*)::int from public.cibo_reviews) reviews,
    (select count(*)::int from public.cibo_reviewers) reviewers`;
  assert.equal(counts[0].restaurants, 541);
  assert.equal(counts[0].reviewers, 12);
  assert.equal(counts[0].reviews, 3783);
  const restaurants = await request("cibo_restaurants?select=id,data&limit=1");
  assert.equal(restaurants.status, 200);
  assert.equal(restaurants.data[0].id, restaurants.data[0].data.id);
  const ratings = await request("cibo_restaurant_ratings?limit=1");
  assert.equal(ratings.status, 200);
  assert.ok(ratings.data[0].review_count >= 3);
  const fixtures = {
    collection: {
      saved: [restaurants.data[0].id],
      visited: [restaurants.data[0].id],
      ratings: { [restaurants.data[0].id]: 5 },
      favorites: [restaurants.data[0].id],
      friendIds: ["maya"],
      lists: [
        {
          id: "verification",
          name: "Weekend bites",
          placeIds: [restaurants.data[0].id],
        },
      ],
    },
    profile: {
      name: "Verification guest",
      neighborhood: "Toronto",
      diet: "Vegetarian",
    },
    foodDex: [
      {
        id: "verification-food",
        name: "Ramen",
        cuisine: "Japanese",
        photo: "",
        discoveredAt: "2026-10-17T12:00:00Z",
      },
    ],
  };
  for (const [section, data] of Object.entries(fixtures)) {
    const saved = await request("rpc/cibo_write_document", {
      p_key: deviceA,
      p_section: section,
      p_data: data,
    });
    assert.ok(saved.status < 300, JSON.stringify(saved));
    const loaded = await request("rpc/cibo_read_document", {
      p_key: deviceA,
      p_section: section,
    });
    assert.deepEqual(loaded.data, data);
    const other = await request("rpc/cibo_read_document", {
      p_key: deviceB,
      p_section: section,
    });
    assert.equal(other.data, null);
  }
  // Rewriting one section must leave the others intact.
  const changed = { ...fixtures.profile, name: "Updated guest" };
  await request("rpc/cibo_write_document", {
    p_key: deviceA,
    p_section: "profile",
    p_data: changed,
  });
  assert.deepEqual(
    (
      await request("rpc/cibo_read_document", {
        p_key: deviceA,
        p_section: "collection",
      })
    ).data,
    fixtures.collection,
  );
  assert.ok(
    (
      await request("rpc/cibo_read_document", {
        p_key: "guess",
        p_section: "profile",
      })
    ).status >= 400,
  );
  assert.ok(
    (
      await request("rpc/cibo_write_document", {
        p_key: deviceB,
        p_section: "admin",
        p_data: {},
      })
    ).status >= 400,
  );
  assert.ok(
    (
      await request("rpc/cibo_write_document", {
        p_key: deviceB,
        p_section: "foodDex",
        p_data: {},
      })
    ).status >= 400,
  );
  // Check privileges without attempting destructive writes to shared seed data.
  const [privileges] = await sql`select
    has_table_privilege('anon', 'public.cibo_reviews', 'INSERT') as insert_reviews,
    has_table_privilege('anon', 'public.cibo_restaurants', 'UPDATE') as update_restaurants,
    has_schema_privilege('anon', 'cibo_private', 'USAGE') as private_access`;
  assert.deepEqual(privileges, {
    insert_reviews: false,
    update_restaurants: false,
    private_access: false,
  });
  console.log(
    "Verified: secure device-key issuance, public reads, all three document round trips, device isolation, section isolation, input validation, and restricted table writes.",
  );
  console.log(counts[0]);
} finally {
  // Remove only records created by this test, identified by its random device keys.
  await sql`delete from cibo_private.documents where key_hash in (sha256(convert_to(${deviceA}, 'UTF8')), sha256(convert_to(${deviceB}, 'UTF8')))`;
  await sql.end({ timeout: 5 });
}
