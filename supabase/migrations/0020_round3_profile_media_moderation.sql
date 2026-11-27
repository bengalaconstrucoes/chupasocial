-- =============================================================================
-- ChupaSocial — 0020 — Perfil turbinado, views, moderação e avisos
-- Rode este arquivo inteiro no SQL Editor do Supabase.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Perfil: moldura de foto e música de fundo
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_frame text not null default 'none';
alter table public.profiles add column if not exists song_url text;
alter table public.profiles add column if not exists muted_until timestamptz;

-- A RPC do perfil devolvia só algumas colunas: bandeira, status, estilo,
-- música e selos nunca chegavam na tela. Agora devolve o perfil inteiro.
drop function if exists public.get_profile_by_username(citext);

create function public.get_profile_by_username(p_username citext)
returns setof public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select pr.*
  from public.profiles pr
  where pr.username = p_username
    and (pr.deactivated_at is null or pr.id = auth.uid());
$$;

grant execute on function public.get_profile_by_username(citext) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Posts: ocultação por moderação
-- ---------------------------------------------------------------------------
alter table public.posts add column if not exists hidden_at timestamptz;
alter table public.posts add column if not exists hidden_reason text;

create index if not exists posts_visible_idx
  on public.posts (created_at desc)
  where hidden_at is null;

-- ---------------------------------------------------------------------------
-- 3) Fila de moderação (conteúdo sinalizado automaticamente)
-- ---------------------------------------------------------------------------
create table if not exists public.moderation_flags (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  reason     text not null,
  severity   text not null default 'review' check (severity in ('review', 'high')),
  created_at timestamptz not null default now(),
  unique (post_id, reason)
);

create index if not exists moderation_flags_created_idx
  on public.moderation_flags (created_at desc);

alter table public.moderation_flags enable row level security;

drop policy if exists "moderation_flags_insert" on public.moderation_flags;
create policy "moderation_flags_insert" on public.moderation_flags
  for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists "moderation_flags_admin_read" on public.moderation_flags;
create policy "moderation_flags_admin_read" on public.moderation_flags
  for select to authenticated
  using (public.is_admin_user());

drop policy if exists "moderation_flags_admin_delete" on public.moderation_flags;
create policy "moderation_flags_admin_delete" on public.moderation_flags
  for delete to authenticated
  using (public.is_admin_user());

-- ---------------------------------------------------------------------------
-- 4) Views por publicação
-- ---------------------------------------------------------------------------
create table if not exists public.post_views (
  post_id    uuid not null references public.posts (id) on delete cascade,
  viewer_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, viewer_id)
);

create index if not exists post_views_post_idx on public.post_views (post_id);

alter table public.post_views enable row level security;

drop policy if exists "post_views_read" on public.post_views;
create policy "post_views_read" on public.post_views
  for select to authenticated
  using (true);

drop policy if exists "post_views_insert" on public.post_views;
create policy "post_views_insert" on public.post_views
  for insert to authenticated
  with check (viewer_id = auth.uid());

create or replace function public.record_post_view(p_post uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_count bigint;
begin
  if v_me is null or p_post is null then
    return 0;
  end if;

  insert into public.post_views (post_id, viewer_id)
  values (p_post, v_me)
  on conflict do nothing;

  select count(*) into v_count from public.post_views where post_id = p_post;
  return v_count;
end;
$$;

revoke all on function public.record_post_view(uuid) from public;
grant execute on function public.record_post_view(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Avisos da administração (fórum em tempo real)
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  title      text not null,
  body       text not null,
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_title_len check (char_length(btrim(title)) between 2 and 120),
  constraint announcements_body_len check (char_length(btrim(body)) between 1 and 4000)
);

create index if not exists announcements_created_idx
  on public.announcements (pinned desc, created_at desc);

create table if not exists public.announcement_replies (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  author_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now(),
  constraint announcement_replies_body_len check (char_length(btrim(body)) between 1 and 1000)
);

create index if not exists announcement_replies_thread_idx
  on public.announcement_replies (announcement_id, created_at);

drop trigger if exists announcements_touch_updated_at on public.announcements;
create trigger announcements_touch_updated_at
  before update on public.announcements
  for each row execute function public.touch_updated_at();

alter table public.announcements enable row level security;
alter table public.announcement_replies enable row level security;

drop policy if exists "announcements_read" on public.announcements;
create policy "announcements_read" on public.announcements
  for select to authenticated
  using (true);

drop policy if exists "announcements_admin_write" on public.announcements;
create policy "announcements_admin_write" on public.announcements
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "announcement_replies_read" on public.announcement_replies;
create policy "announcement_replies_read" on public.announcement_replies
  for select to authenticated
  using (true);

drop policy if exists "announcement_replies_insert" on public.announcement_replies;
create policy "announcement_replies_insert" on public.announcement_replies
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.muted_until is not null and p.muted_until > now()
    )
  );

drop policy if exists "announcement_replies_delete" on public.announcement_replies;
create policy "announcement_replies_delete" on public.announcement_replies
  for delete to authenticated
  using (author_id = auth.uid() or public.is_admin_user());

-- Realtime: respostas dos avisos chegam ao vivo.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.announcement_replies;
    exception
      when duplicate_object then null;
      when others then null;
    end;
  end if;
end $$;

-- Um aviso de boas-vindas para o fórum não nascer vazio.
insert into public.announcements (author_id, title, body, pinned)
select p.id,
       'Bem-vindo aos avisos do ChupaSocial',
       'Aqui a administração publica novidades, regras e manutenções. Responda abaixo — o fórum é em tempo real.',
       true
from public.profiles p
where p.is_admin = true
  and not exists (select 1 from public.announcements)
order by p.created_at asc
limit 1;

-- ---------------------------------------------------------------------------
-- 6) Moderação: silenciar conta (usado pelo painel e pelas políticas)
-- ---------------------------------------------------------------------------
create or replace function public.set_user_muted(p_user uuid, p_minutes int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'not_admin';
  end if;

  update public.profiles
     set muted_until = case
       when p_minutes is null or p_minutes <= 0 then null
       else now() + make_interval(mins => p_minutes)
     end
   where id = p_user;
end;
$$;

revoke all on function public.set_user_muted(uuid, int) from public;
grant execute on function public.set_user_muted(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Storage: vídeos no post (até 50 MB) e músicas de perfil
-- ---------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'video/mp4', 'video/webm', 'video/quicktime'
       ]
 where id = 'post-media';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('songs', 'songs', true, 15728640, array['audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chupa_songs_read" on storage.objects;
create policy "chupa_songs_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'songs');

drop policy if exists "chupa_songs_insert" on storage.objects;
create policy "chupa_songs_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'songs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "chupa_songs_delete" on storage.objects;
create policy "chupa_songs_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'songs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Privilégios das tabelas novas.
grant select on public.post_views to authenticated;
grant insert on public.post_views to authenticated;
grant select, insert, update, delete on public.announcements to authenticated;
grant select, insert, delete on public.announcement_replies to authenticated;
grant select, insert, delete on public.moderation_flags to authenticated;
