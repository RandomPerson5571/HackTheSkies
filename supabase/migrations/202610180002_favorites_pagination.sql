-- Return an exact matching count and one bounded page for the favourites UI.
-- Rated places are excluded before offset/limit is applied, so pages stay full.
create or replace function public.cibo_favorites_page(
  p_query text default '',
  p_offset integer default 0,
  p_limit integer default 20,
  p_excluded_ids text[] default '{}'::text[]
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as materialized (
    select
      restaurant.id,
      lower(coalesce(restaurant.data ->> 'name', '')) as name_key
    from public.cibo_restaurants as restaurant
    where not (restaurant.id = any(coalesce(p_excluded_ids, '{}'::text[])))
      and (
        coalesce(trim(p_query), '') = ''
        or strpos(lower(coalesce(restaurant.data ->> 'name', '')), lower(trim(p_query))) > 0
        or strpos(lower(coalesce(restaurant.data ->> 'category', '')), lower(trim(p_query))) > 0
      )
  ),
  page as (
    select filtered.id, restaurant.data, filtered.name_key
    from filtered
    join public.cibo_restaurants as restaurant on restaurant.id = filtered.id
    order by filtered.name_key, filtered.id
    offset greatest(0, coalesce(p_offset, 0))
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'places', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('id', page.id, 'data', page.data)
          order by page.name_key, page.id
        )
        from page
      ),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.cibo_favorites_page(text, integer, integer, text[]) from public;
grant execute on function public.cibo_favorites_page(text, integer, integer, text[]) to anon, authenticated;
