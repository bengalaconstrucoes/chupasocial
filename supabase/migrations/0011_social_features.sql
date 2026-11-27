-- =============================================================================
-- ChupaSocial — 0011 — Grupos, anexos, personalização e favoritos
-- 1) Perfis: localização, cor de destaque e fonte do nome.
-- 2) Conversas: grupos com título e criador.
-- 3) Mensagens: imagem/GIF anexado.
-- 4) Favoritos de GIF por usuário.
-- 5) Remoção de seguidor pelo dono do perfil.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Perfis: personalização
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists location text,
  add column if not exists accent_color text,
  add column if not exists name_font text not null default 'default';

alter table public.profiles drop constraint if exists profiles_location_len;
alter table public.profiles add constraint profiles_location_len
  check (location is null or char_length(btrim(location)) <= 60);

alter table public.profiles drop constraint if exists profiles_accent_color_format;
alter table public.profiles add constraint profiles_accent_color_format
  check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$');

alter table public.profiles drop constraint if exists profiles_name_font_valid;
alter table public.profiles add constraint profiles_name_font_valid
  check (name_font in ('default', 'serif', 'mono', 'rounded', 'condensed'));

-- ---------------------------------------------------------------------------
-- Conversas: grupos
-- ---------------------------------------------------------------------------
alter table public.conversations
  add column if not exists title text,
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

alter table public.conversations drop constraint if exists conversations_title_len;
alter table public.conversations add constraint conversations_title_len
  check (title is null or char_length(btrim(title)) between 1 and 60);

-- ---------------------------------------------------------------------------
-- Mensagens: anexos
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,
  add column if not exists attachment_preview_url text;

alter table public.messages
  alter column body drop not null;

alter table public.messages drop constraint if exists messages_body_len;
alter table public.messages add constraint messages_body_len check (
  char_length(btrim(coalesce(body, ''))) <= 4000
  and (char_length(btrim(coalesce(body, ''))) >= 1 or attachment_url is not null)
);

alter table public.messages drop constraint if exists messages_attachment_type_valid;
alter table public.messages add constraint messages_attachment_type_valid
  check (attachment_type is null or attachment_type in ('image', 'gif'));

alter table public.messages drop constraint if exists messages_attachment_url_len;
alter table public.messages add constraint messages_attachment_url_len
  check (attachment_url is null or char_length(attachment_url) <= 600);

-- ---------------------------------------------------------------------------
-- Favoritos de GIF
-- ---------------------------------------------------------------------------
create table if not exists public.gif_favorites (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  gif_id      text not null,
  provider    text not null default 'giphy',
  title       text not null default '',
  url         text not null,
  preview_url text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, gif_id),
  constraint gif_favorites_id_len check (char_length(gif_id) between 1 and 80),
  constraint gif_favorites_url_len check (char_length(url) <= 600 and char_length(preview_url) <= 600)
);

alter table public.gif_favorites enable row level security;

drop policy if exists "gif_favorites_select_own" on public.gif_favorites;
create policy "gif_favorites_select_own" on public.gif_favorites
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "gif_favorites_insert_own" on public.gif_favorites;
create policy "gif_favorites_insert_own" on public.gif_favorites
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "gif_favorites_delete_own" on public.gif_favorites;
create policy "gif_favorites_delete_own" on public.gif_favorites
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: mídia de mensagens
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('message-media', 'message-media', true, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chupa_media_read" on storage.objects;
create policy "chupa_media_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('avatars', 'banners', 'post-media', 'community-images', 'message-media'));

drop policy if exists "chupa_media_insert" on storage.objects;
create policy "chupa_media_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'banners', 'post-media', 'community-images', 'message-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "chupa_media_update" on storage.objects;
create policy "chupa_media_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'banners', 'post-media', 'community-images', 'message-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('avatars', 'banners', 'post-media', 'community-images', 'message-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "chupa_media_delete" on storage.objects;
create policy "chupa_media_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'banners', 'post-media', 'community-images', 'message-media')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Conversa individual: nunca reaproveitar um grupo com as mesmas pessoas
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
    join public.conversation_members m1
      on m1.conversation_id = c.id and m1.user_id = v_me
    join public.conversation_members m2
      on m2.conversation_id = c.id and m2.user_id = p_other
   where (select count(*) from public.conversation_members m
           where m.conversation_id = c.id) = 2
   limit 1;

  if v_conversation is null then
    insert into public.conversations (created_by) values (v_me) returning id into v_conversation;
    insert into public.conversation_members (conversation_id, user_id)
    values (v_conversation, v_me), (v_conversation, p_other);
  end if;

  return v_conversation;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grupos
-- ---------------------------------------------------------------------------
create or replace function public.create_group_conversation(p_title text, p_members uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_id uuid;
  v_total int;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 60 then
    raise exception 'invalid_title' using errcode = 'check_violation';
  end if;

  select count(distinct m) into v_total
    from unnest(coalesce(p_members, array[]::uuid[])) as m
   where m <> v_me;

  if v_total < 1 then
    raise exception 'no_members' using errcode = 'check_violation';
  end if;
  if v_total > 24 then
    raise exception 'too_many_members' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from unnest(p_members) as m
    where not exists (
      select 1 from public.profiles p where p.id = m and p.deactivated_at is null
    )
  ) then
    raise exception 'profile_not_found' using errcode = 'check_violation';
  end if;

  insert into public.conversations (title, created_by)
  values (v_title, v_me)
  returning id into v_id;

  insert into public.conversation_members (conversation_id, user_id)
  values (v_id, v_me);

  insert into public.conversation_members (conversation_id, user_id)
  select v_id, m from (select distinct unnest(p_members) as m) s where m <> v_me;

  return v_id;
end;
$$;

create or replace function public.add_group_members(p_conversation uuid, p_members uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_total int;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.conversations
    where id = p_conversation and created_by = v_me
  ) then
    raise exception 'not_allowed' using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_total from public.conversation_members
   where conversation_id = p_conversation;

  select v_total + count(distinct m) into v_total
    from unnest(coalesce(p_members, array[]::uuid[])) as m
   where m not in (
     select user_id from public.conversation_members where conversation_id = p_conversation
   );

  if v_total > 25 then
    raise exception 'too_many_members' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from unnest(coalesce(p_members, array[]::uuid[])) as m
    where not exists (
      select 1 from public.profiles p where p.id = m and p.deactivated_at is null
    )
  ) then
    raise exception 'profile_not_found' using errcode = 'check_violation';
  end if;

  insert into public.conversation_members (conversation_id, user_id)
  select p_conversation, m from (select distinct unnest(p_members) as m) s
  on conflict do nothing;
end;
$$;

create or replace function public.rename_group_conversation(p_conversation uuid, p_title text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 60 then
    raise exception 'invalid_title' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.conversations
    where id = p_conversation and created_by = v_me
  ) then
    raise exception 'not_allowed' using errcode = 'insufficient_privilege';
  end if;
  update public.conversations set title = v_title where id = p_conversation;
end;
$$;

create or replace function public.leave_group_conversation(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.conversation_members
   where conversation_id = p_conversation and user_id = v_me;

  if not found then
    raise exception 'not_member' using errcode = 'check_violation';
  end if;

  update public.conversations
     set created_by = (
       select user_id from public.conversation_members
        where conversation_id = p_conversation
        order by joined_at asc
        limit 1
     )
   where id = p_conversation and created_by = v_me;

  if not exists (
    select 1 from public.conversation_members where conversation_id = p_conversation
  ) then
    delete from public.conversations where id = p_conversation;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Remover seguidor (somente o dono do perfil seguido)
-- ---------------------------------------------------------------------------
create or replace function public.remove_follower(p_follower uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.follows
   where follower_id = p_follower and following_id = v_me;

  if not found then
    raise exception 'not_following' using errcode = 'check_violation';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfil público passa a expor a personalização
-- ---------------------------------------------------------------------------
drop function if exists public.get_profile_by_username(citext);

create function public.get_profile_by_username(p_username citext)
returns table (
  id uuid, username citext, display_name text, bio text, avatar_url text, banner_url text,
  website text, is_private boolean, deactivated_at timestamptz, created_at timestamptz,
  location text, accent_color text, name_font text
)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id, pr.username, pr.display_name, pr.bio, pr.avatar_url, pr.banner_url,
         pr.website, pr.is_private, pr.deactivated_at, pr.created_at,
         pr.location, pr.accent_color, pr.name_font
  from public.profiles pr
  where pr.username = p_username
    and (pr.deactivated_at is null or pr.id = auth.uid());
$$;

grant execute on function public.get_profile_by_username(citext) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privilégios das novas RPCs
-- ---------------------------------------------------------------------------
grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;
grant execute on function public.add_group_members(uuid, uuid[]) to authenticated;
grant execute on function public.rename_group_conversation(uuid, text) to authenticated;
grant execute on function public.leave_group_conversation(uuid) to authenticated;
grant execute on function public.remove_follower(uuid) to authenticated;

grant select, insert, delete on public.gif_favorites to authenticated;
