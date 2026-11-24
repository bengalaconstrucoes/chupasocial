-- =============================================================================
-- ChupaSocial — 0003 — Row Level Security
-- Toda tabela é acessível apenas conforme a sessão do usuário.
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.follow_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles_select_visible" on public.profiles
  for select to authenticated
  using (public.can_view_profile(id));

create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
create policy "posts_select_visible" on public.posts
  for select to authenticated
  using (public.can_view_post(id));

create policy "posts_insert_own" on public.posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (community_id is null or public.is_community_member(community_id, auth.uid()))
  );

create policy "posts_update_own" on public.posts
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "posts_delete_own_or_moderated" on public.posts
  for delete to authenticated
  using (
    author_id = auth.uid()
    or (community_id is not null and public.can_moderate_community(community_id, auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- post_media
-- ---------------------------------------------------------------------------
create policy "post_media_select_visible" on public.post_media
  for select to authenticated
  using (public.can_view_post(post_id));

create policy "post_media_insert_own_post" on public.post_media
  for insert to authenticated
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  );

create policy "post_media_delete_own_post" on public.post_media
  for delete to authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- likes
-- ---------------------------------------------------------------------------
create policy "likes_select_visible" on public.likes
  for select to authenticated
  using (public.can_view_post(post_id));

create policy "likes_insert_own" on public.likes
  for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_post(post_id));

create policy "likes_delete_own" on public.likes
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
create policy "comments_select_visible" on public.comments
  for select to authenticated
  using (public.can_view_post(post_id));

create policy "comments_insert_own" on public.comments
  for insert to authenticated
  with check (author_id = auth.uid() and public.can_view_post(post_id));

create policy "comments_update_own" on public.comments
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "comments_delete_own_or_moderated" on public.comments
  for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.posts p
      where p.id = post_id
        and (p.author_id = auth.uid()
          or (p.community_id is not null and public.can_moderate_community(p.community_id, auth.uid())))
    )
  );

-- ---------------------------------------------------------------------------
-- follows
-- ---------------------------------------------------------------------------
create policy "follows_select_visible" on public.follows
  for select to authenticated
  using (
    follower_id = auth.uid()
    or following_id = auth.uid()
    or (public.can_view_profile(follower_id) and public.can_view_profile(following_id))
  );

create policy "follows_insert_own_public_target" on public.follows
  for insert to authenticated
  with check (
    follower_id = auth.uid()
    and exists (
      select 1 from public.profiles pr
      where pr.id = following_id and pr.is_private = false and pr.deactivated_at is null
    )
  );

create policy "follows_delete_participant" on public.follows
  for delete to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());

-- ---------------------------------------------------------------------------
-- follow_requests
-- ---------------------------------------------------------------------------
create policy "follow_requests_select_participant" on public.follow_requests
  for select to authenticated
  using (requester_id = auth.uid() or target_id = auth.uid());

create policy "follow_requests_insert_own" on public.follow_requests
  for insert to authenticated
  with check (
    requester_id = auth.uid()
    and exists (
      select 1 from public.profiles pr
      where pr.id = target_id and pr.is_private = true and pr.deactivated_at is null
    )
  );

create policy "follow_requests_delete_participant" on public.follow_requests
  for delete to authenticated
  using (requester_id = auth.uid() or target_id = auth.uid());

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
create policy "conversations_select_member" on public.conversations
  for select to authenticated
  using (public.is_conversation_member(id, auth.uid()));

create policy "conversations_update_member" on public.conversations
  for update to authenticated
  using (public.is_conversation_member(id, auth.uid()))
  with check (public.is_conversation_member(id, auth.uid()));

-- ---------------------------------------------------------------------------
-- conversation_members
-- ---------------------------------------------------------------------------
create policy "conversation_members_select_member" on public.conversation_members
  for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

create policy "conversation_members_update_self" on public.conversation_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create policy "messages_select_member" on public.messages
  for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

create policy "messages_insert_member" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id, auth.uid())
  );

create policy "messages_delete_own" on public.messages
  for delete to authenticated
  using (sender_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notifications_delete_own" on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- communities
-- ---------------------------------------------------------------------------
create policy "communities_select_all" on public.communities
  for select to authenticated
  using (true);

create policy "communities_insert_own" on public.communities
  for insert to authenticated
  with check (creator_id = auth.uid());

create policy "communities_update_admin" on public.communities
  for update to authenticated
  using (public.can_moderate_community(id, auth.uid()))
  with check (public.can_moderate_community(id, auth.uid()));

create policy "communities_delete_owner" on public.communities
  for delete to authenticated
  using (creator_id = auth.uid());

-- ---------------------------------------------------------------------------
-- community_members
-- ---------------------------------------------------------------------------
create policy "community_members_select_all" on public.community_members
  for select to authenticated
  using (true);

create policy "community_members_insert_self" on public.community_members
  for insert to authenticated
  with check (user_id = auth.uid() and role = 'member');

create policy "community_members_update_admin" on public.community_members
  for update to authenticated
  using (
    public.can_moderate_community(community_id, auth.uid())
    or user_id = auth.uid()
  )
  with check (
    public.can_moderate_community(community_id, auth.uid())
    or user_id = auth.uid()
  );

create policy "community_members_delete_self_or_admin" on public.community_members
  for delete to authenticated
  using (
    (user_id = auth.uid() and role <> 'owner')
    or public.can_moderate_community(community_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Privilégios: nada de escrita direta fora das políticas acima.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select on public.profiles, public.posts, public.post_media, public.likes,
  public.comments, public.follows, public.communities, public.community_members
  to authenticated;

grant insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to authenticated;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;
grant execute on function public.respond_follow_request(uuid, boolean) to authenticated;
grant execute on function public.profile_stats(uuid) to authenticated;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.mark_notifications_read() to authenticated;
