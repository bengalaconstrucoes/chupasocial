-- =============================================================================
-- ChupaSocial — 0014 — Respostas como publicações, bloqueios e menções
-- 1) Respostas deixam de viver em `comments` e passam a ser posts com
--    `root_post_id` / `parent_post_id`: assim curtir, repostar, compartilhar,
--    editar e excluir funcionam exatamente como em qualquer publicação.
-- 2) Publicações apenas com mídia (sem legenda) passam a ser permitidas.
-- 3) Bloqueio entre perfis com RLS e helper para filtrar feeds.
-- 4) Notificações de menção (@usuario).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Respostas como posts
-- ---------------------------------------------------------------------------
alter table public.posts
  add column if not exists root_post_id uuid references public.posts (id) on delete cascade,
  add column if not exists parent_post_id uuid references public.posts (id) on delete cascade;

alter table public.posts drop constraint if exists posts_reply_not_root;
alter table public.posts add constraint posts_reply_not_root
  check (root_post_id is null or root_post_id <> id);

create index if not exists posts_root_created_idx on public.posts (root_post_id, created_at);
create index if not exists posts_parent_idx on public.posts (parent_post_id);

-- Publicação só com imagem/GIF: a mídia é inserida depois do post, então a
-- validação de "texto ou mídia" fica no servidor (createPostAction).
alter table public.posts drop constraint if exists posts_content_or_repost;

-- Migra os comentários existentes para posts, preservando autor, texto,
-- hierarquia e data. Sem os triggers de rate limit para não bloquear contas
-- que comentaram muito.
alter table public.posts disable trigger posts_rate_limit;

do $$
declare
  c record;
  v_new uuid;
  v_parent uuid;
begin
  create temp table _comment_map (old_id uuid primary key, new_id uuid not null) on commit drop;

  for c in select * from public.comments order by created_at asc loop
    v_parent := null;
    if c.parent_id is not null then
      select new_id into v_parent from _comment_map where old_id = c.parent_id;
    end if;

    insert into public.posts (author_id, content, root_post_id, parent_post_id, created_at)
    values (c.author_id, c.content, c.post_id, v_parent, c.created_at)
    returning id into v_new;

    insert into _comment_map (old_id, new_id) values (c.id, v_new);
  end loop;
end $$;

alter table public.posts enable trigger posts_rate_limit;

-- Notificações antigas apontavam para comentários; os posts migrados passam a
-- ser a fonte da verdade.
delete from public.comments;

-- Rate limit: posts raiz e respostas têm limites separados.
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
      where author_id = p_user and root_post_id is null and created_at > now() - p_window;
  elsif p_action = 'comment' then
    select count(*) into v_count from public.posts
      where author_id = p_user and root_post_id is not null and created_at > now() - p_window;
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
  if new.root_post_id is null then
    perform public.assert_rate_limit(new.author_id, 'post', 12, interval '5 minutes');
  else
    perform public.assert_rate_limit(new.author_id, 'comment', 30, interval '5 minutes');
  end if;
  return new;
end; $$;

-- Notifica autor do post raiz e autor da resposta respondida.
create or replace function public.on_post_reply_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_root_author uuid;
  v_parent_author uuid;
begin
  if new.root_post_id is null then
    return new;
  end if;

  select author_id into v_root_author from public.posts where id = new.root_post_id;

  if new.parent_post_id is not null then
    select author_id into v_parent_author from public.posts where id = new.parent_post_id;
    perform public.notify(v_parent_author, new.author_id, 'reply', new.root_post_id);
    if v_root_author is distinct from v_parent_author then
      perform public.notify(v_root_author, new.author_id, 'comment', new.root_post_id);
    end if;
  else
    perform public.notify(v_root_author, new.author_id, 'comment', new.root_post_id);
  end if;

  return new;
end;
$$;

drop trigger if exists posts_notify_reply on public.posts;
create trigger posts_notify_reply after insert on public.posts
  for each row execute function public.on_post_reply_created();

-- ---------------------------------------------------------------------------
-- 2) Bloqueios
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

drop policy if exists "blocks_select_own" on public.blocks;
create policy "blocks_select_own" on public.blocks
  for select to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "blocks_insert_own" on public.blocks;
create policy "blocks_insert_own" on public.blocks
  for insert to authenticated
  with check (blocker_id = auth.uid() and blocked_id <> auth.uid());

drop policy if exists "blocks_delete_own" on public.blocks;
create policy "blocks_delete_own" on public.blocks
  for delete to authenticated
  using (blocker_id = auth.uid());

grant select, insert, delete on public.blocks to authenticated;

-- IDs que bloqueiam ou são bloqueados por mim (usado para filtrar feeds).
create or replace function public.blocked_user_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg(case when blocker_id = auth.uid() then blocked_id else blocker_id end),
    array[]::uuid[]
  )
  from public.blocks
  where blocker_id = auth.uid() or blocked_id = auth.uid();
$$;

grant execute on function public.blocked_user_ids() to authenticated;

create or replace function public.block_state(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = p_user) then 'blocking'
    when exists (select 1 from public.blocks where blocker_id = p_user and blocked_id = auth.uid()) then 'blocked'
    else 'none'
  end;
$$;

grant execute on function public.block_state(uuid) to authenticated;

-- Bloqueio impede abrir conversa e seguir.
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
  if exists (
    select 1 from public.blocks
    where (blocker_id = v_me and blocked_id = p_other)
       or (blocker_id = p_other and blocked_id = v_me)
  ) then
    raise exception 'blocked';
  end if;

  select c.id into v_conversation
    from public.conversations c
    join public.conversation_members m1 on m1.conversation_id = c.id and m1.user_id = v_me
    join public.conversation_members m2 on m2.conversation_id = c.id and m2.user_id = p_other
    where c.title is null
   limit 1;

  if v_conversation is null then
    insert into public.conversations default values returning id into v_conversation;
    insert into public.conversation_members (conversation_id, user_id)
    values (v_conversation, v_me), (v_conversation, p_other);
  end if;

  return v_conversation;
end;
$$;

grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Menções
-- ---------------------------------------------------------------------------
create or replace function public.notify_mentions(p_post uuid, p_usernames text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_target uuid;
  v_id uuid;
  v_name text;
begin
  if v_actor is null then
    raise exception 'not_authenticated';
  end if;

  select coalesce(root_post_id, id) into v_target
    from public.posts
   where id = p_post and author_id = v_actor;

  if v_target is null then
    return;
  end if;

  foreach v_name in array coalesce(p_usernames, array[]::text[]) loop
    select id into v_id from public.profiles where username = lower(v_name) limit 1;
    if v_id is not null and v_id <> v_actor then
      perform public.notify(v_id, v_actor, 'mention', v_target);
    end if;
  end loop;
end;
$$;

grant execute on function public.notify_mentions(uuid, text[]) to authenticated;

-- Contagem de publicações do perfil ignora respostas.
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
        and p.root_post_id is null
        and not (pr.is_private and not public.is_following(auth.uid(), p_user) and p.author_id <> auth.uid())
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) GIF animado como foto de perfil
-- ---------------------------------------------------------------------------
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
       file_size_limit = 5242880
 where id = 'avatars';
