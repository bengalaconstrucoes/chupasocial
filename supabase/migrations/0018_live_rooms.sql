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
