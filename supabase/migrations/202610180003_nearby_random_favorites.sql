drop function if exists public.cibo_favorites_page(text, integer, integer, text[]);

create function public.cibo_favorites_page(
  p_query text default '',
  p_offset integer default 0,
  p_limit integer default 20,
  p_excluded_ids text[] default '{}'::text[],
  p_randomize boolean default false,
  p_center_lon double precision default null,
  p_center_lat double precision default null,
  p_radius_km double precision default null
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  with filtered as materialized (
    select
      restaurant.id,
      restaurant.data,
      lower(coalesce(restaurant.data ->> 'name', '')) as name_key
    from public.cibo_restaurants as restaurant
    where not (restaurant.id = any(coalesce(p_excluded_ids, '{}'::text[])))
      and (
        coalesce(trim(p_query), '') = ''
        or strpos(lower(coalesce(restaurant.data ->> 'name', '')), lower(trim(p_query))) > 0
        or strpos(lower(coalesce(restaurant.data ->> 'category', '')), lower(trim(p_query))) > 0
      )
      and (
        p_center_lon is null or p_center_lat is null or p_radius_km is null
        or (
          jsonb_typeof(restaurant.data -> 'coordinate') = 'array'
          and coalesce(restaurant.data -> 'coordinate' ->> 0, '') ~ '^-?[0-9]+(\.[0-9]+)?$'
          and coalesce(restaurant.data -> 'coordinate' ->> 1, '') ~ '^-?[0-9]+(\.[0-9]+)?$'
          and power(((restaurant.data -> 'coordinate' ->> 1)::double precision - p_center_lat) * 111.32, 2)
            + power(((restaurant.data -> 'coordinate' ->> 0)::double precision - p_center_lon)
              * 111.32 * cos(radians(p_center_lat)), 2)
            <= power(greatest(0, p_radius_km), 2)
        )
      )
  ),
  page as (
    select filtered.id, filtered.data, filtered.name_key, random() as random_key
    from filtered
    order by
      case when coalesce(p_randomize, false) then random() end,
      case when not coalesce(p_randomize, false) then filtered.name_key end,
      filtered.id
    offset greatest(0, coalesce(p_offset, 0))
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'places', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('id', page.id, 'data', page.data)
          order by
            case when coalesce(p_randomize, false) then page.random_key end,
            case when not coalesce(p_randomize, false) then page.name_key end,
            page.id
        )
        from page
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.cibo_favorites_page(text, integer, integer, text[], boolean, double precision, double precision, double precision) from public;
grant execute on function public.cibo_favorites_page(text, integer, integer, text[], boolean, double precision, double precision, double precision) to anon, authenticated;
