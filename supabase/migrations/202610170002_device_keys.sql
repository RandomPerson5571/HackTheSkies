-- Issue an unregistered capability using Postgres' cryptographic UUID generator.
-- No account or session is created, and no database row is allocated here.
create function public.cibo_issue_device_key()
returns text language sql volatile security invoker set search_path = '' as $$
  select encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')), 'hex');
$$;
revoke all on function public.cibo_issue_device_key() from public, anon, authenticated;
grant execute on function public.cibo_issue_device_key() to anon, authenticated;
