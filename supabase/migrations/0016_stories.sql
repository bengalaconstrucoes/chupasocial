-- ---------------------------------------------------------------------------
-- Stories: mídia que expira em 24 horas
-- ---------------------------------------------------------------------------
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  media_url text not null,
  media_type text not null default 'image',
  caption text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

-- Garante colunas esperadas caso a tabela tenha sido criada antes desta migração.
alter table public.stories
  add column if not exists expires_at timestamptz not null default now() + interval '24 hours';
alter table public.stories
  add column if not exists caption text;
alter table public.stories
  add column if not exists media_type text not null default 'image';

alter table public.stories enable row level security;

grant select, insert, delete on public.stories to authenticated;

drop policy if exists "stories_read" on public.stories;
create policy "stories_read" on public.stories
  for select to authenticated using (true);

drop policy if exists "stories_insert_own" on public.stories;
create policy "stories_insert_own" on public.stories
  for insert to authenticated with check (author_id = auth.uid());

drop policy if exists "stories_delete_own" on public.stories;
create policy "stories_delete_own" on public.stories
  for delete to authenticated using (author_id = auth.uid());

create index if not exists stories_author_expires_idx
  on public.stories (author_id, expires_at desc);

do $$
begin
  begin
    alter publication supabase_realtime add table public.stories;
  exception when duplicate_object then null;
  end;
end $$;
