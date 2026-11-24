-- =============================================================================
-- ChupaSocial — 0001 — Núcleo do banco de dados
-- =============================================================================

create extension if not exists citext;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_role') then
    create type public.member_role as enum ('owner', 'moderator', 'member');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'follow', 'follow_request', 'like', 'comment', 'reply', 'repost', 'message', 'community'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        citext not null unique,
  display_name    text not null default '',
  bio             text not null default '',
  avatar_url      text,
  banner_url      text,
  website         text,
  is_private      boolean not null default false,
  deactivated_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_len check (char_length(display_name) <= 50),
  constraint profiles_bio_len check (char_length(bio) <= 280),
  constraint profiles_website_len check (website is null or char_length(website) <= 120)
);

create index profiles_username_trgm_idx on public.profiles using gin (username gin_trgm_ops);
create index profiles_display_name_trgm_idx on public.profiles using gin (display_name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- communities
-- ---------------------------------------------------------------------------
create table public.communities (
  id          uuid primary key default gen_random_uuid(),
  slug        citext not null unique,
  name        text not null,
  description text not null default '',
  image_url   text,
  creator_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint communities_slug_format check (slug ~ '^[a-z0-9-]{3,32}$'),
  constraint communities_name_len check (char_length(name) between 2 and 60),
  constraint communities_description_len check (char_length(description) <= 500)
);

create index communities_name_trgm_idx on public.communities using gin (name gin_trgm_ops);
create index communities_description_trgm_idx on public.communities using gin (description gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- community_members
-- ---------------------------------------------------------------------------
create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.member_role not null default 'member',
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);

create index community_members_user_idx on public.community_members (user_id);

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles (id) on delete cascade,
  community_id  uuid references public.communities (id) on delete set null,
  repost_of     uuid references public.posts (id) on delete cascade,
  content       text not null default '',
  search_vector tsvector generated always as (to_tsvector('portuguese', content)) stored,
  created_at    timestamptz not null default now(),
  edited_at     timestamptz,
  constraint posts_content_len check (char_length(content) <= 2000),
  constraint posts_content_or_repost check (
    (repost_of is null and char_length(btrim(content)) > 0) or repost_of is not null
  ),
  constraint posts_repost_no_community check (repost_of is null or community_id is null)
);

create index posts_created_at_idx on public.posts (created_at desc);
create index posts_author_created_idx on public.posts (author_id, created_at desc);
create index posts_community_created_idx on public.posts (community_id, created_at desc);
create index posts_search_idx on public.posts using gin (search_vector);
create index posts_content_trgm_idx on public.posts using gin (content gin_trgm_ops);
create unique index posts_unique_repost_idx on public.posts (author_id, repost_of)
  where repost_of is not null;

-- ---------------------------------------------------------------------------
-- post_media
-- ---------------------------------------------------------------------------
create table public.post_media (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  position   smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint post_media_position_range check (position between 0 and 3)
);

create index post_media_post_idx on public.post_media (post_id, position);

-- ---------------------------------------------------------------------------
-- likes
-- ---------------------------------------------------------------------------
create table public.likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index likes_post_idx on public.likes (post_id);

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  parent_id  uuid references public.comments (id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  constraint comments_content_len check (char_length(btrim(content)) between 1 and 1000)
);

create index comments_post_created_idx on public.comments (post_id, created_at);
create index comments_parent_idx on public.comments (parent_id);
create index comments_author_idx on public.comments (author_id);

-- ---------------------------------------------------------------------------
-- follows / follow_requests
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create index follows_following_idx on public.follows (following_id);

create table public.follow_requests (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  target_id    uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (requester_id, target_id),
  constraint follow_requests_no_self check (requester_id <> target_id)
);

create index follow_requests_target_idx on public.follow_requests (target_id);

-- ---------------------------------------------------------------------------
-- conversations / messages
-- ---------------------------------------------------------------------------
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now(),
  constraint messages_body_len check (char_length(btrim(body)) between 1 and 4000)
);

create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index messages_sender_idx on public.messages (sender_id);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  actor_id        uuid references public.profiles (id) on delete cascade,
  type            public.notification_type not null,
  post_id         uuid references public.posts (id) on delete cascade,
  comment_id      uuid references public.comments (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  community_id    uuid references public.communities (id) on delete cascade,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Perfil criado automaticamente no cadastro
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username citext;
  v_display  text;
begin
  v_username := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  if v_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'username_invalid' using errcode = 'check_violation';
  end if;

  v_display := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if char_length(v_display) < 1 then
    v_display := v_username::text;
  end if;
  v_display := left(v_display, 50);

  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, v_display);

  return new;
exception
  when unique_violation then
    raise exception 'username_taken' using errcode = 'unique_violation';
  when check_violation then
    raise exception 'username_invalid' using errcode = 'check_violation';
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
