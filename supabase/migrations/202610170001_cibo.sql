-- No auth.users records: possession of a random 256-bit device key grants
-- access only to that device's journal. Keys are stored hashed, never exposed.
create schema if not exists cibo_private;
revoke all on schema cibo_private from public, anon, authenticated;

create table public.cibo_restaurants (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object')
);
create table public.cibo_reviewers (
  id text primary key,
  name text not null,
  handle text not null unique,
  initials text not null,
  bio text not null,
  is_sample boolean not null default true check (is_sample)
);
create table public.cibo_reviews (
  id text primary key,
  restaurant_id text not null references public.cibo_restaurants(id),
  reviewer_id text not null references public.cibo_reviewers(id),
  rating integer not null check (rating between 1 and 5),
  note text not null check (char_length(note) <= 2000),
  visited_at timestamptz not null,
  is_sample boolean not null default true check (is_sample),
  unique (restaurant_id, reviewer_id)
);
create index cibo_reviews_restaurant_idx on public.cibo_reviews(restaurant_id);
create table cibo_private.documents (
  key_hash bytea not null,
  section text not null check (section in ('collection', 'profile', 'foodDex')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (key_hash, section)
);

alter table public.cibo_restaurants enable row level security;
alter table public.cibo_reviewers enable row level security;
alter table public.cibo_reviews enable row level security;
alter table cibo_private.documents enable row level security;
revoke all on public.cibo_restaurants, public.cibo_reviewers, public.cibo_reviews from anon, authenticated;
grant select on public.cibo_restaurants, public.cibo_reviewers, public.cibo_reviews to anon, authenticated;
create policy "Public restaurant catalog" on public.cibo_restaurants for select to anon, authenticated using (true);
create policy "Fictional community profiles" on public.cibo_reviewers for select to anon, authenticated using (true);
create policy "Fictional reviews" on public.cibo_reviews for select to anon, authenticated using (true);

-- Keep community aggregates separate from personal ratings so the app does not
-- count a device's own rating twice when building recommendations.
create view public.cibo_restaurant_ratings with (security_invoker = true) as
select restaurant_id, avg(rating)::float8 as average_rating, count(*)::integer as review_count
from public.cibo_reviews group by restaurant_id;
grant select on public.cibo_restaurant_ratings to anon, authenticated;

create function public.cibo_read_document(p_key text, p_section text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_key is null or p_key !~ '^[a-f0-9]{64}$' or p_section not in ('collection', 'profile', 'foodDex') or p_section is null then
    raise exception 'Invalid device key or section' using errcode = '22023';
  end if;
  return (select data from cibo_private.documents
    where key_hash = sha256(convert_to(p_key, 'UTF8')) and section = p_section);
end;
$$;

create function public.cibo_write_document(p_key text, p_section text, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_key is null or p_key !~ '^[a-f0-9]{64}$' or p_section not in ('collection', 'profile', 'foodDex') or p_section is null then
    raise exception 'Invalid device key or section' using errcode = '22023';
  end if;
  if p_data is null or octet_length(p_data::text) > 1048576
    or (p_section = 'foodDex' and jsonb_typeof(p_data) <> 'array')
    or (p_section <> 'foodDex' and jsonb_typeof(p_data) <> 'object') then
    raise exception 'Invalid document' using errcode = '22023';
  end if;
  insert into cibo_private.documents(key_hash, section, data)
  values (sha256(convert_to(p_key, 'UTF8')), p_section, p_data)
  on conflict (key_hash, section) do update set data = excluded.data, updated_at = now();
end;
$$;
revoke all on function public.cibo_read_document(text, text) from public, anon, authenticated;
revoke all on function public.cibo_write_document(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.cibo_read_document(text, text) to anon, authenticated;
grant execute on function public.cibo_write_document(text, text, jsonb) to anon, authenticated;
