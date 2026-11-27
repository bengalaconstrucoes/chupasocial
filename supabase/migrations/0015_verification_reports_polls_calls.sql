-- =============================================================================
-- ChupaSocial — 0015 — Verificação, denúncias, enquetes, colaboração, visitas
-- e sinalização de chamadas entre abas.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Perfis: selo, bandeira, status, música, post fixado, privacidade e estilo
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_verified boolean not null default false,
  add column if not exists flag text,
  add column if not exists status_text text,
  add column if not exists status_emoji text,
  add column if not exists favorite_song text,
  add column if not exists favorite_song_artist text,
  add column if not exists pinned_post_id uuid references public.posts (id) on delete set null,
  add column if not exists show_stats boolean not null default true,
  add column if not exists show_visits boolean not null default true,
  add column if not exists profile_style text not null default 'modern',
  add column if not exists last_seen_at timestamptz;

alter table public.profiles drop constraint if exists profiles_status_len;
alter table public.profiles add constraint profiles_status_len
  check (status_text is null or char_length(btrim(status_text)) <= 80);

alter table public.profiles drop constraint if exists profiles_status_emoji_len;
alter table public.profiles add constraint profiles_status_emoji_len
  check (status_emoji is null or char_length(status_emoji) <= 8);

alter table public.profiles drop constraint if exists profiles_song_len;
alter table public.profiles add constraint profiles_song_len
  check (
    (favorite_song is null or char_length(btrim(favorite_song)) <= 80)
    and (favorite_song_artist is null or char_length(btrim(favorite_song_artist)) <= 80)
  );

alter table public.profiles drop constraint if exists profiles_flag_valid;
alter table public.profiles add constraint profiles_flag_valid
  check (flag is null or flag ~ '^[a-z0-9-]{2,24}$');

alter table public.profiles drop constraint if exists profiles_style_valid;
alter table public.profiles add constraint profiles_style_valid
  check (profile_style in ('modern', 'y2k'));

-- ---------------------------------------------------------------------------
-- Publicações: tipo da mídia (imagem, GIF ou vídeo)
-- ---------------------------------------------------------------------------
alter table public.post_media
  add column if not exists media_type text not null default 'image';

alter table public.post_media drop constraint if exists post_media_type_valid;
alter table public.post_media add constraint post_media_type_valid
  check (media_type in ('image', 'gif', 'video'));

-- ---------------------------------------------------------------------------
-- Mensagens: temporárias e de visualização única
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists view_once boolean not null default false,
  add column if not exists expires_at timestamptz;

alter table public.messages drop constraint if exists messages_attachment_type_valid;
alter table public.messages add constraint messages_attachment_type_valid
  check (attachment_type is null or attachment_type in ('image', 'gif', 'audio'));

create index if not exists messages_expires_idx on public.messages (expires_at)
  where expires_at is not null;

-- ---------------------------------------------------------------------------
-- Publicações salvas (coleção privada)
-- ---------------------------------------------------------------------------
create table if not exists public.saved_posts (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists saved_posts_user_idx on public.saved_posts (user_id, created_at desc);

alter table public.saved_posts enable row level security;

drop policy if exists "saved_posts_select_own" on public.saved_posts;
create policy "saved_posts_select_own" on public.saved_posts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "saved_posts_insert_own" on public.saved_posts;
create policy "saved_posts_insert_own" on public.saved_posts
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "saved_posts_delete_own" on public.saved_posts;
create policy "saved_posts_delete_own" on public.saved_posts
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Denúncias de conteúdo
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null,
  target_id   uuid not null,
  reason      text not null,
  details     text,
  status      text not null default 'open',
  created_at  timestamptz not null default now(),
  constraint reports_target_valid check (target_type in ('post', 'message', 'profile')),
  constraint reports_reason_valid check (
    reason in ('spam', 'harassment', 'hate', 'nudity', 'violence', 'misinformation', 'other')
  ),
  constraint reports_status_valid check (status in ('open', 'reviewed', 'dismissed')),
  constraint reports_details_len check (details is null or char_length(details) <= 500)
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create unique index if not exists reports_unique_target
  on public.reports (reporter_id, target_type, target_id);

alter table public.reports enable row level security;

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own" on public.reports
  for select to authenticated using (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Visitas de perfil (uma linha por visitante, com contador)
-- ---------------------------------------------------------------------------
create table if not exists public.profile_visits (
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  visitor_id   uuid not null references public.profiles (id) on delete cascade,
  visit_count  integer not null default 1,
  last_visit_at timestamptz not null default now(),
  primary key (profile_id, visitor_id)
);

create index if not exists profile_visits_profile_idx
  on public.profile_visits (profile_id, last_visit_at desc);

alter table public.profile_visits enable row level security;

drop policy if exists "profile_visits_select_own" on public.profile_visits;
create policy "profile_visits_select_own" on public.profile_visits
  for select to authenticated using (visitor_id = auth.uid());

drop policy if exists "profile_visits_insert_own" on public.profile_visits;
create policy "profile_visits_insert_own" on public.profile_visits
  for insert to authenticated with check (visitor_id = auth.uid());

drop policy if exists "profile_visits_update_own" on public.profile_visits;
create policy "profile_visits_update_own" on public.profile_visits
  for update to authenticated
  using (visitor_id = auth.uid())
  with check (visitor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Publicações colaborativas
-- ---------------------------------------------------------------------------
create table if not exists public.post_collaborators (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_collaborators enable row level security;

drop policy if exists "post_collaborators_select" on public.post_collaborators;
create policy "post_collaborators_select" on public.post_collaborators
  for select to authenticated using (true);

drop policy if exists "post_collaborators_insert_author" on public.post_collaborators;
create policy "post_collaborators_insert_author" on public.post_collaborators
  for insert to authenticated
  with check (
    exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

drop policy if exists "post_collaborators_delete_author" on public.post_collaborators;
create policy "post_collaborators_delete_author" on public.post_collaborators
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Enquetes
-- ---------------------------------------------------------------------------
create table if not exists public.polls (
  post_id    uuid primary key references public.posts (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_options (
  id       uuid primary key default gen_random_uuid(),
  post_id  uuid not null references public.polls (post_id) on delete cascade,
  label    text not null,
  position integer not null default 0,
  constraint poll_options_label_len check (char_length(btrim(label)) between 1 and 60),
  unique (id, post_id)
);

create table if not exists public.poll_votes (
  post_id   uuid not null references public.polls (post_id) on delete cascade,
  option_id uuid not null,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id),
  foreign key (option_id, post_id) references public.poll_options (id, post_id) on delete cascade
);

create index if not exists poll_votes_option_idx on public.poll_votes (option_id);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

drop policy if exists "polls_select" on public.polls;
create policy "polls_select" on public.polls for select to authenticated using (true);

drop policy if exists "polls_insert_author" on public.polls;
create policy "polls_insert_author" on public.polls
  for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

drop policy if exists "poll_options_select" on public.poll_options;
create policy "poll_options_select" on public.poll_options for select to authenticated using (true);

drop policy if exists "poll_options_insert_author" on public.poll_options;
create policy "poll_options_insert_author" on public.poll_options
  for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

drop policy if exists "poll_votes_select" on public.poll_votes;
create policy "poll_votes_select" on public.poll_votes for select to authenticated using (true);

drop policy if exists "poll_votes_insert_own" on public.poll_votes;
create policy "poll_votes_insert_own" on public.poll_votes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "poll_votes_delete_own" on public.poll_votes;
create policy "poll_votes_delete_own" on public.poll_votes
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Toque de chamada entre abas (o receptor escuta só os próprios toques)
-- ---------------------------------------------------------------------------
create table if not exists public.call_rings (
  id              uuid primary key default gen_random_uuid(),
  call_id         uuid not null,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  from_user       uuid not null references public.profiles (id) on delete cascade,
  to_user         uuid not null references public.profiles (id) on delete cascade,
  mode            text not null default 'audio',
  dismissed       boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint call_rings_mode_valid check (mode in ('audio', 'video'))
);

create index if not exists call_rings_target_idx on public.call_rings (to_user, created_at desc);

alter table public.call_rings enable row level security;

drop policy if exists "call_rings_select_target" on public.call_rings;
create policy "call_rings_select_target" on public.call_rings
  for select to authenticated using (to_user = auth.uid() or from_user = auth.uid());

drop policy if exists "call_rings_insert_caller" on public.call_rings;
create policy "call_rings_insert_caller" on public.call_rings
  for insert to authenticated
  with check (
    from_user = auth.uid()
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id = call_rings.conversation_id and m.user_id = from_user
    )
    and exists (
      select 1 from public.conversation_members m
      where m.conversation_id = call_rings.conversation_id and m.user_id = to_user
    )
  );

drop policy if exists "call_rings_update_party" on public.call_rings;
create policy "call_rings_update_party" on public.call_rings
  for update to authenticated
  using (to_user = auth.uid() or from_user = auth.uid())
  with check (to_user = auth.uid() or from_user = auth.uid());

drop policy if exists "call_rings_delete_party" on public.call_rings;
create policy "call_rings_delete_party" on public.call_rings
  for delete to authenticated using (to_user = auth.uid() or from_user = auth.uid());

-- ---------------------------------------------------------------------------
-- Abrir mensagem de visualização única (o destinatário apaga a mensagem)
-- ---------------------------------------------------------------------------
create or replace function public.open_view_once_message(p_message uuid)
returns table (body text, attachment_url text, attachment_type text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.messages;
begin
  select * into v_row from public.messages m where m.id = p_message;
  if v_row.id is null then
    raise exception 'not_found';
  end if;
  if not public.is_conversation_member(v_row.conversation_id, v_uid) then
    raise exception 'not_allowed';
  end if;
  if v_row.sender_id = v_uid then
    raise exception 'own_message';
  end if;
  if not v_row.view_once then
    raise exception 'not_view_once';
  end if;

  delete from public.messages where id = p_message;
  return query select v_row.body, v_row.attachment_url, v_row.attachment_type;
end;
$$;

revoke all on function public.open_view_once_message(uuid) from public;
grant execute on function public.open_view_once_message(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: vídeo em publicações, áudio em mensagens e mídia de stories
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('post-media', 'post-media', true, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'video/mp4', 'video/webm', 'video/quicktime']),
  ('message-media', 'message-media', true, 26214400,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg']),
  ('stories', 'stories', true, 26214400,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chupa_media_read" on storage.objects;
create policy "chupa_media_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('avatars', 'banners', 'post-media', 'community-images', 'message-media', 'stories'));

drop policy if exists "chupa_media_insert" on storage.objects;
create policy "chupa_media_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'banners', 'post-media', 'community-images', 'message-media', 'stories')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "chupa_media_delete" on storage.objects;
create policy "chupa_media_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'banners', 'post-media', 'community-images', 'message-media', 'stories')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Realtime para enquetes e toques de chamada
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.poll_votes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.call_rings;
  exception when duplicate_object then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Estatísticas de perfil opcionais: visitas visíveis só para o dono
-- ---------------------------------------------------------------------------
create or replace function public.profile_visit_stats(p_user uuid)
returns table (total_visits bigint, unique_visitors bigint, recent_visitors bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(sum(visit_count), 0)::bigint,
    count(*)::bigint,
    count(*) filter (where last_visit_at > now() - interval '7 days')::bigint
  from public.profile_visits
  where profile_id = p_user;
$$;

revoke all on function public.profile_visit_stats(uuid) from public;
grant execute on function public.profile_visit_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Registra visita de perfil (uma vez por visitante, com contador)
-- ---------------------------------------------------------------------------
create or replace function public.record_profile_visit(p_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visitor uuid := auth.uid();
begin
  if v_visitor is null or v_visitor = p_profile then
    return;
  end if;

  begin
    insert into public.profile_visits (profile_id, visitor_id, visit_count, last_visit_at)
    values (p_profile, v_visitor, 1, now())
    on conflict (profile_id, visitor_id) do update
      set visit_count = public.profile_visits.visit_count + 1,
          last_visit_at = now();
  exception
    when foreign_key_violation then return;
  end;
end;
$$;

revoke all on function public.record_profile_visit(uuid) from public;
grant execute on function public.record_profile_visit(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Marca presença (usada pelo provedor de presença no cliente)
-- ---------------------------------------------------------------------------
create or replace function public.touch_presence()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

revoke all on function public.touch_presence() from public;
grant execute on function public.touch_presence() to authenticated;

notify pgrst, 'reload schema';
