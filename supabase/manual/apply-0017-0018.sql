-- ChupaSocial — migrações pendentes (0017 + 0018)
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute.

-- ---------------------------------------------------------------------------
-- Administração, álbum de fotos, caixinha de feedback, comunidades com
-- aprovação/convites/emojis personalizados e ranking semanal.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Administração
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;

revoke all on function public.is_admin_user() from public;
grant execute on function public.is_admin_user() to authenticated;

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists "reports_admin_read" on public.reports;
create policy "reports_admin_read" on public.reports
  for select to authenticated using (public.is_admin_user());

drop policy if exists "reports_admin_update" on public.reports;
create policy "reports_admin_update" on public.reports
  for update to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ---------------------------------------------------------------------------
-- Álbum de fotos do perfil
-- ---------------------------------------------------------------------------
create table if not exists public.profile_photos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  photo_url  text not null,
  caption    text,
  created_at timestamptz not null default now(),
  constraint profile_photos_caption_len check (caption is null or char_length(caption) <= 120)
);

create index if not exists profile_photos_user_idx
  on public.profile_photos (user_id, created_at desc);

alter table public.profile_photos enable row level security;
grant select, insert, delete on public.profile_photos to authenticated;

drop policy if exists "profile_photos_read" on public.profile_photos;
create policy "profile_photos_read" on public.profile_photos
  for select to authenticated using (true);

drop policy if exists "profile_photos_insert_own" on public.profile_photos;
create policy "profile_photos_insert_own" on public.profile_photos
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "profile_photos_delete_own" on public.profile_photos;
create policy "profile_photos_delete_own" on public.profile_photos
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Caixinha de feedback
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  mood       text not null default 'idea',
  body       text not null,
  status     text not null default 'open',
  created_at timestamptz not null default now(),
  constraint feedback_body_len check (char_length(btrim(body)) between 3 and 500),
  constraint feedback_mood_valid check (mood in ('idea', 'bug', 'love', 'other')),
  constraint feedback_status_valid check (status in ('open', 'read'))
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;
grant select, insert, update on public.feedback to authenticated;

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own" on public.feedback
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "feedback_select_own_or_admin" on public.feedback;
create policy "feedback_select_own_or_admin" on public.feedback
  for select to authenticated using (user_id = auth.uid() or public.is_admin_user());

drop policy if exists "feedback_admin_update" on public.feedback;
create policy "feedback_admin_update" on public.feedback
  for update to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ---------------------------------------------------------------------------
-- Comunidades: aprovação de membros, convites por link e emojis próprios
-- ---------------------------------------------------------------------------
alter table public.communities
  add column if not exists requires_approval boolean not null default false;
alter table public.communities
  add column if not exists emojis text[] not null default '{}'::text[];
alter table public.communities
  add column if not exists invite_token text;

update public.communities
  set invite_token = replace(gen_random_uuid()::text, '-', '')
  where invite_token is null;

alter table public.communities
  alter column invite_token set default replace(gen_random_uuid()::text, '-', '');
alter table public.communities alter column invite_token set not null;

create unique index if not exists communities_invite_token_idx
  on public.communities (invite_token);

alter table public.community_members
  add column if not exists status text not null default 'active';

alter table public.community_members drop constraint if exists community_members_status_valid;
alter table public.community_members add constraint community_members_status_valid
  check (status in ('pending', 'active'));

create or replace function public.is_community_admin(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_members m
    where m.community_id = p_community
      and m.user_id = auth.uid()
      and m.role in ('owner', 'moderator')
      and m.status = 'active'
  )
$$;

revoke all on function public.is_community_admin(uuid) from public;
grant execute on function public.is_community_admin(uuid) to authenticated;

-- Entrada em comunidade com aprovação entra como pendente.
create or replace function public.set_community_member_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requires boolean;
  v_owner uuid;
begin
  select c.requires_approval, c.creator_id into v_requires, v_owner
  from public.communities c where c.id = new.community_id;

  if new.user_id = v_owner then
    new.role := 'owner';
    new.status := 'active';
  elsif v_requires and new.user_id = auth.uid() and new.status = 'active' then
    new.status := 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists community_members_status on public.community_members;
create trigger community_members_status
  before insert on public.community_members
  for each row execute function public.set_community_member_status();

drop policy if exists "community_members_read" on public.community_members;
create policy "community_members_read" on public.community_members
  for select to authenticated using (true);

drop policy if exists "community_members_admin_update" on public.community_members;
create policy "community_members_admin_update" on public.community_members
  for update to authenticated
  using (public.is_community_admin(community_id))
  with check (public.is_community_admin(community_id));

drop policy if exists "community_members_admin_delete" on public.community_members;
create policy "community_members_admin_delete" on public.community_members
  for delete to authenticated using (public.is_community_admin(community_id));

-- ---------------------------------------------------------------------------
-- Ranking semanal
-- ---------------------------------------------------------------------------
create or replace function public.weekly_ranking(p_limit int default 10)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_verified boolean,
  points bigint,
  posts bigint,
  likes_received bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with recent_posts as (
    select p.id, p.author_id
    from public.posts p
    where p.created_at > now() - interval '7 days'
      and p.root_post_id is null
      and p.repost_of is null
  ),
  post_counts as (
    select rp.author_id as uid, count(*)::bigint as total
    from recent_posts rp group by rp.author_id
  ),
  like_counts as (
    select rp.author_id as uid, count(l.*)::bigint as total
    from recent_posts rp
    join public.likes l on l.post_id = rp.id
    group by rp.author_id
  ),
  follower_counts as (
    select f.following_id as uid, count(*)::bigint as total
    from public.follows f
    where f.created_at > now() - interval '7 days'
    group by f.following_id
  ),
  scored as (
    select p.id as uid,
      coalesce(pc.total, 0) * 5
        + coalesce(lc.total, 0) * 2
        + coalesce(fc.total, 0) * 3 as points
    from public.profiles p
    left join post_counts pc on pc.uid = p.id
    left join like_counts lc on lc.uid = p.id
    left join follower_counts fc on fc.uid = p.id
    where coalesce(pc.total, 0) + coalesce(lc.total, 0) + coalesce(fc.total, 0) > 0
  )
  select p.id, p.username, p.display_name, p.avatar_url, p.is_verified,
    s.points,
    coalesce(pc.total, 0) as posts,
    coalesce(lc.total, 0) as likes_received
  from scored s
  join public.profiles p on p.id = s.uid
  left join post_counts pc on pc.uid = p.id
  left join like_counts lc on lc.uid = p.id
  where p.deactivated_at is null
  order by s.points desc, p.username asc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

revoke all on function public.weekly_ranking(int) from public;
grant execute on function public.weekly_ranking(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Contagens usadas para conquistas (badges)
-- ---------------------------------------------------------------------------
create or replace function public.profile_achievement_counts(p_user uuid)
returns table (
  posts bigint,
  likes_received bigint,
  followers bigint,
  communities bigint,
  days int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.posts p
      where p.author_id = p_user and p.root_post_id is null and p.repost_of is null),
    (select count(*) from public.likes l
      join public.posts p on p.id = l.post_id
      where p.author_id = p_user),
    (select count(*) from public.follows f where f.following_id = p_user),
    (select count(*) from public.community_members m
      where m.user_id = p_user and m.status = 'active'),
    coalesce((select extract(day from now() - p.created_at)::int
      from public.profiles p where p.id = p_user), 0);
$$;

revoke all on function public.profile_achievement_counts(uuid) from public;
grant execute on function public.profile_achievement_counts(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Para virar administrador, rode uma vez no SQL Editor:
--   update public.profiles set is_admin = true where username = 'seu-usuario';
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Salas ao vivo dentro das comunidades
-- ---------------------------------------------------------------------------
create table if not exists public.live_rooms (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  host_id      uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  status       text not null default 'live',
  created_at   timestamptz not null default now(),
  ended_at     timestamptz,
  constraint live_rooms_title_len check (char_length(btrim(title)) between 3 and 80),
  constraint live_rooms_status_valid check (status in ('live', 'ended'))
);

create index if not exists live_rooms_community_idx
  on public.live_rooms (community_id, status, created_at desc);

alter table public.live_rooms enable row level security;
grant select, insert, update, delete on public.live_rooms to authenticated;

drop policy if exists "live_rooms_read" on public.live_rooms;
create policy "live_rooms_read" on public.live_rooms
  for select to authenticated using (true);

drop policy if exists "live_rooms_insert_admin" on public.live_rooms;
create policy "live_rooms_insert_admin" on public.live_rooms
  for insert to authenticated
  with check (host_id = auth.uid() and public.is_community_admin(community_id));

drop policy if exists "live_rooms_update_host" on public.live_rooms;
create policy "live_rooms_update_host" on public.live_rooms
  for update to authenticated
  using (host_id = auth.uid() or public.is_community_admin(community_id))
  with check (host_id = auth.uid() or public.is_community_admin(community_id));

drop policy if exists "live_rooms_delete_host" on public.live_rooms;
create policy "live_rooms_delete_host" on public.live_rooms
  for delete to authenticated using (host_id = auth.uid());

notify pgrst, 'reload schema';
