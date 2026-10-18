-- Keep zoomed-out map requests to counts, then retrieve details only for the
-- visible viewport after the user zooms in.
alter table public.cibo_restaurants
  add column if not exists longitude double precision
    generated always as (nullif(data #>> '{coordinate,0}', '')::double precision) stored,
  add column if not exists latitude double precision
    generated always as (nullif(data #>> '{coordinate,1}', '')::double precision) stored;

create index if not exists cibo_restaurants_map_viewport_idx
  on public.cibo_restaurants (latitude, longitude);

create or replace function public.cibo_count_restaurants_in_bounds(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision
)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::bigint
  from public.cibo_restaurants as restaurant
  where p_west <= p_east
    and p_south <= p_north
    and restaurant.longitude between p_west and p_east
    and restaurant.latitude between p_south and p_north;
$$;

create or replace function public.cibo_restaurants_in_bounds(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
  p_limit integer default 400
)
returns table (id text, data jsonb)
language sql
stable
security invoker
set search_path = ''
as $$
  select restaurant.id, restaurant.data
  from public.cibo_restaurants as restaurant
  where p_west <= p_east
    and p_south <= p_north
    and restaurant.longitude between p_west and p_east
    and restaurant.latitude between p_south and p_north
  order by restaurant.id
  limit greatest(1, least(coalesce(p_limit, 400), 400));
$$;

revoke all on function public.cibo_count_restaurants_in_bounds(double precision, double precision, double precision, double precision) from public;
revoke all on function public.cibo_restaurants_in_bounds(double precision, double precision, double precision, double precision, integer) from public;
grant execute on function public.cibo_count_restaurants_in_bounds(double precision, double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.cibo_restaurants_in_bounds(double precision, double precision, double precision, double precision, integer) to anon, authenticated;
