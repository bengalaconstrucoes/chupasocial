-- =============================================================================
-- ChupaSocial — 0005 — Privilégios de execução e utilidades públicas
-- Funções usadas dentro das políticas RLS precisam de EXECUTE para o papel
-- authenticated; funções internas (notify, assert_rate_limit) ficam restritas.
-- =============================================================================

grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.can_view_post(uuid) to authenticated;
grant execute on function public.is_following(uuid, uuid) to authenticated;
grant execute on function public.is_community_member(uuid, uuid) to authenticated;
grant execute on function public.can_moderate_community(uuid, uuid) to authenticated;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;
grant execute on function public.respond_follow_request(uuid, boolean) to authenticated;
grant execute on function public.profile_stats(uuid) to authenticated;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.mark_notifications_read() to authenticated;

create or replace function public.is_username_available(p_username citext)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_username ~ '^[a-z0-9_]{3,20}$'
    and not exists (select 1 from public.profiles where username = p_username);
$$;

grant execute on function public.is_username_available(citext) to anon, authenticated;
