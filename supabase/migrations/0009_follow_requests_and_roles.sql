-- =============================================================================
-- ChupaSocial — 0009 — Solicitações de seguir e papéis de comunidade
-- 1) A política de follow_requests consultava profiles, que está sob RLS: um
--    perfil privado é invisível para quem pede, então a política negava tudo.
--    A checagem passa a usar uma função SECURITY DEFINER.
-- 2) Membros não podem mais alterar o próprio papel; promoções exigem ser
--    moderador/dono e ninguém além do dono pode conceder o papel de dono.
-- =============================================================================

create or replace function public.profile_is_private(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select pr.is_private from public.profiles pr
      where pr.id = p_profile and pr.deactivated_at is null),
    false
  );
$$;

grant execute on function public.profile_is_private(uuid) to authenticated;

drop policy if exists "follow_requests_insert_own" on public.follow_requests;
create policy "follow_requests_insert_own" on public.follow_requests
  for insert to authenticated
  with check (requester_id = auth.uid() and public.profile_is_private(target_id));

drop policy if exists "follows_insert_own_public_target" on public.follows;
create policy "follows_insert_own_public_target" on public.follows
  for insert to authenticated
  with check (follower_id = auth.uid() and not public.profile_is_private(following_id));

create or replace function public.is_community_owner(p_community uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_members
    where community_id = p_community and user_id = p_user and role = 'owner'
  );
$$;

grant execute on function public.is_community_owner(uuid, uuid) to authenticated;

drop policy if exists "community_members_update_admin" on public.community_members;
create policy "community_members_update_admin" on public.community_members
  for update to authenticated
  using (
    public.can_moderate_community(community_id, auth.uid())
    and (role <> 'owner' or public.is_community_owner(community_id, auth.uid()))
  )
  with check (
    public.can_moderate_community(community_id, auth.uid())
    and (role <> 'owner' or public.is_community_owner(community_id, auth.uid()))
  );

drop policy if exists "community_members_delete_self_or_admin" on public.community_members;
create policy "community_members_delete_self_or_admin" on public.community_members
  for delete to authenticated
  using (
    (user_id = auth.uid() and role <> 'owner')
    or (public.can_moderate_community(community_id, auth.uid()) and role <> 'owner')
  );
