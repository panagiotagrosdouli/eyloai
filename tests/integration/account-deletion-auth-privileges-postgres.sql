do $$
begin

  if not has_table_privilege('supabase_auth_admin', 'public.study_flashcard_decks', 'DELETE') then
    raise exception 'Auth cascade role cannot delete user-owned flashcard rows';
  end if;
  if not has_table_privilege('supabase_auth_admin', 'public.eylo_api_token_events', 'DELETE') then
    raise exception 'Auth cascade role cannot delete token audit rows';
  end if;
  if not has_table_privilege('supabase_auth_admin', 'public.eyra_messages', 'DELETE') then
    raise exception 'Auth cascade role cannot delete nested EYRA rows';
  end if;
  if not has_column_privilege('supabase_auth_admin', 'public.eylo_peer_submissions', 'reviewer_id', 'UPDATE') then
    raise exception 'Auth cascade role cannot preserve a submission when its reviewer is deleted';
  end if;
  if not has_column_privilege('supabase_auth_admin', 'storage.objects', 'owner_id', 'UPDATE') then
    raise exception 'Auth role cannot preserve storage metadata when the owner is deleted';
  end if;
  if has_column_privilege('supabase_auth_admin', 'storage.objects', 'name', 'UPDATE')
     or has_table_privilege('supabase_auth_admin', 'storage.objects', 'SELECT')
     or has_table_privilege('supabase_auth_admin', 'storage.objects', 'INSERT') then
    raise exception 'Auth role received unrelated Storage privileges';
  end if;
  if has_column_privilege('supabase_auth_admin', 'public.eylo_peer_submissions', 'content', 'UPDATE') then
    raise exception 'Auth cascade role received unrelated peer-submission update privileges';
  end if;
  if has_table_privilege('supabase_auth_admin', 'public.study_flashcard_decks', 'SELECT')
     or has_table_privilege('supabase_auth_admin', 'public.study_flashcard_decks', 'INSERT')
     or has_table_privilege('supabase_auth_admin', 'public.study_flashcard_decks', 'UPDATE') then
    raise exception 'Auth cascade role received privileges beyond DELETE';
  end if;
end
$$;
