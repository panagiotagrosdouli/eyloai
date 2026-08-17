-- Fail deployment if the analytics function cannot produce its stable response
-- shape for an existing authenticated workspace owner.

do $$
declare
  requester uuid;
  result jsonb;
begin
  select id into requester from public.profiles order by created_at asc limit 1;
  if requester is null then
    return;
  end if;

  perform set_config('request.jwt.claim.sub', requester::text, true);
  result := private.get_workspace_analytics_internal();

  if not (result ?& array['scope', 'members', 'counts', 'generated_at']) then
    raise exception 'Workspace analytics returned an invalid response shape';
  end if;
end $$;
