-- =============================================================================
-- ChupaSocial — 0002 — Funções, RPCs, anti-spam e notificações
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers de visibilidade / relacionamento (SECURITY DEFINER para evitar
-- recursão entre políticas RLS).
-- ---------------------------------------------------------------------------
create or replace function public.is_following(p_follower uuid, p_following uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.follows
    where follower_id = p_follower and following_id = p_following
  );
$$;

create or replace function public.is_community_member(p_community uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_members
    where community_id = p_community and user_id = p_user
  );
$$;

create or replace function public.can_moderate_community(p_community uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_members
    where community_id = p_community
      and user_id = p_user
      and role in ('owner', 'moderator')
  );
$$;

-- Um perfil é visível quando está ativo e (é público, é seu, ou você o segue).
create or replace function public.can_view_profile(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = p_profile
      and (pr.deactivated_at is null or pr.id = auth.uid())
      and (
        pr.id = auth.uid()
        or pr.is_private = false
        or public.is_following(auth.uid(), pr.id)
      )
  );
$$;

create or replace function public.can_view_post(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.posts p
    join public.profiles pr on pr.id = p.author_id
    where p.id = p_post
      and (pr.deactivated_at is null or p.author_id = auth.uid())
      and (
        p.author_id = auth.uid()
        or (pr.is_private = false or public.is_following(auth.uid(), p.author_id))
      )
  );
$$;

create or replace function public.is_conversation_member(p_conversation uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation and user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------------
-- Anti-spam: limites por usuário e janela de tempo
-- ---------------------------------------------------------------------------
create or replace function public.assert_rate_limit(
  p_user uuid,
  p_action text,
  p_limit int,
  p_window interval
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if p_action = 'post' then
    select count(*) into v_count from public.posts
      where author_id = p_user and created_at > now() - p_window;
  elsif p_action = 'comment' then
    select count(*) into v_count from public.comments
      where author_id = p_user and created_at > now() - p_window;
  elsif p_action = 'message' then
    select count(*) into v_count from public.messages
      where sender_id = p_user and created_at > now() - p_window;
  elsif p_action = 'follow' then
    select count(*) into v_count from public.follows
      where follower_id = p_user and created_at > now() - p_window;
  else
    return;
  end if;

  if v_count >= p_limit then
    raise exception 'Muitas ações em pouco tempo. Respire e tente novamente em instantes.'
      using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.posts_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_rate_limit(new.author_id, 'post', 12, interval '5 minutes');
  return new;
end; $$;

create or replace function public.comments_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_rate_limit(new.author_id, 'comment', 30, interval '5 minutes');
  return new;
end; $$;

create or replace function public.messages_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_rate_limit(new.sender_id, 'message', 60, interval '5 minutes');
  return new;
end; $$;

create or replace function public.follows_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_rate_limit(new.follower_id, 'follow', 60, interval '1 hour');
  return new;
end; $$;

create trigger posts_rate_limit before insert on public.posts
  for each row execute function public.posts_rate_limit();
create trigger comments_rate_limit before insert on public.comments
  for each row execute function public.comments_rate_limit();
create trigger messages_rate_limit before insert on public.messages
  for each row execute function public.messages_rate_limit();
create trigger follows_rate_limit before insert on public.follows
  for each row execute function public.follows_rate_limit();

-- Máximo de 4 imagens por publicação
create or replace function public.post_media_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.post_media where post_id = new.post_id) >= 4 then
    raise exception 'Uma publicação pode ter no máximo 4 imagens.'
      using errcode = 'check_violation';
  end if;
  return new;
end; $$;

create trigger post_media_limit before insert on public.post_media
  for each row execute function public.post_media_limit();

-- ---------------------------------------------------------------------------
-- Notificações
-- ---------------------------------------------------------------------------
create or replace function public.notify(
  p_user uuid,
  p_actor uuid,
  p_type public.notification_type,
  p_post uuid default null,
  p_comment uuid default null,
  p_conversation uuid default null,
  p_community uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null or p_actor is null or p_user = p_actor then
    return;
  end if;
  insert into public.notifications (user_id, actor_id, type, post_id, comment_id, conversation_id, community_id)
  values (p_user, p_actor, p_type, p_post, p_comment, p_conversation, p_community);
end;
$$;

create or replace function public.on_follow_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.follow_requests
   where requester_id = new.follower_id and target_id = new.following_id;
  perform public.notify(new.following_id, new.follower_id, 'follow');
  return new;
end; $$;

create trigger follows_notify after insert on public.follows
  for each row execute function public.on_follow_created();

create or replace function public.on_follow_request_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.target_id, new.requester_id, 'follow_request');
  return new;
end; $$;

create trigger follow_requests_notify after insert on public.follow_requests
  for each row execute function public.on_follow_request_created();

create or replace function public.on_like_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  select author_id into v_author from public.posts where id = new.post_id;
  perform public.notify(v_author, new.user_id, 'like', new.post_id);
  return new;
end; $$;

create trigger likes_notify after insert on public.likes
  for each row execute function public.on_like_created();

create or replace function public.on_comment_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_post_author uuid;
  v_parent_author uuid;
begin
  select author_id into v_post_author from public.posts where id = new.post_id;

  if new.parent_id is not null then
    select author_id into v_parent_author from public.comments where id = new.parent_id;
    perform public.notify(v_parent_author, new.author_id, 'reply', new.post_id, new.id);
    if v_post_author is distinct from v_parent_author then
      perform public.notify(v_post_author, new.author_id, 'comment', new.post_id, new.id);
    end if;
  else
    perform public.notify(v_post_author, new.author_id, 'comment', new.post_id, new.id);
  end if;

  return new;
end; $$;

create trigger comments_notify after insert on public.comments
  for each row execute function public.on_comment_created();

create or replace function public.on_repost_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_original_author uuid;
begin
  if new.repost_of is null then
    return new;
  end if;
  select author_id into v_original_author from public.posts where id = new.repost_of;
  perform public.notify(v_original_author, new.author_id, 'repost', new.repost_of);
  return new;
end; $$;

create trigger posts_notify_repost after insert on public.posts
  for each row execute function public.on_repost_created();

create or replace function public.on_message_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_member uuid;
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;

  for v_member in
    select user_id from public.conversation_members
    where conversation_id = new.conversation_id and user_id <> new.sender_id
  loop
    perform public.notify(v_member, new.sender_id, 'message', null, null, new.conversation_id);
  end loop;

  return new;
end; $$;

create trigger messages_notify after insert on public.messages
  for each row execute function public.on_message_created();

create or replace function public.on_community_member_joined()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_creator uuid;
begin
  select creator_id into v_creator from public.communities where id = new.community_id;
  perform public.notify(v_creator, new.user_id, 'community', null, null, null, new.community_id);
  return new;
end; $$;

create trigger community_members_notify after insert on public.community_members
  for each row execute function public.on_community_member_joined();

-- Criador entra automaticamente como owner
create or replace function public.on_community_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.community_members (community_id, user_id, role)
  values (new.id, new.creator_id, 'owner')
  on conflict do nothing;
  return new;
end; $$;

create trigger communities_add_owner after insert on public.communities
  for each row execute function public.on_community_created();

-- ---------------------------------------------------------------------------
-- RPCs de negócio
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_conversation(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_conversation uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if p_other = v_me then
    raise exception 'cannot_message_self';
  end if;
  if not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'profile_not_found';
  end if;

  select c.id into v_conversation
    from public.conversations c
    join public.conversation_members m1 on m1.conversation_id = c.id and m1.user_id = v_me
    join public.conversation_members m2 on m2.conversation_id = c.id and m2.user_id = p_other
   limit 1;

  if v_conversation is null then
    insert into public.conversations default values returning id into v_conversation;
    insert into public.conversation_members (conversation_id, user_id)
    values (v_conversation, v_me), (v_conversation, p_other);
  end if;

  return v_conversation;
end;
$$;

create or replace function public.respond_follow_request(p_requester uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.follow_requests
    where requester_id = p_requester and target_id = v_me
  ) then
    raise exception 'request_not_found';
  end if;

  delete from public.follow_requests where requester_id = p_requester and target_id = v_me;

  if p_accept then
    insert into public.follows (follower_id, following_id)
    values (p_requester, v_me)
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.profile_stats(p_user uuid)
returns table (followers bigint, following bigint, posts bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  select
    (select count(*) from public.follows where following_id = p_user),
    (select count(*) from public.follows where follower_id = p_user),
    (
      select count(*)
      from public.posts p
      join public.profiles pr on pr.id = p.author_id
      where p.author_id = p_user
        and not (pr.is_private and not public.is_following(auth.uid(), p_user) and p.author_id <> auth.uid())
    );
end;
$$;

-- Exclusão definitiva da própria conta (cascata em todos os dados).
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  delete from auth.users where id = v_me;
end;
$$;

create or replace function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
     set read_at = now()
   where user_id = auth.uid() and read_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
end $$;

alter table public.messages replica identity full;
alter table public.notifications replica identity full;
