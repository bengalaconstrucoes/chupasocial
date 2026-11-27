-- =============================================================================
-- ChupaSocial — 0021 — Chat de 24 horas, patches e administração
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Chat público: cada mensagem vive 24 horas
-- ---------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  constraint chat_messages_body_len check (char_length(btrim(body)) between 1 and 500)
);

create index if not exists chat_messages_created_idx
  on public.chat_messages (created_at desc);

alter table public.chat_messages enable row level security;

-- A própria política já esconde o que passou de 24 h, mesmo que a limpeza
-- automática ainda não tenha rodado.
drop policy if exists "chat_messages_read" on public.chat_messages;
create policy "chat_messages_read" on public.chat_messages
  for select to authenticated
  using (created_at > now() - interval '24 hours');

drop policy if exists "chat_messages_insert" on public.chat_messages;
create policy "chat_messages_insert" on public.chat_messages
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and not exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.muted_until is not null
        and p.muted_until > now()
    )
  );

drop policy if exists "chat_messages_delete" on public.chat_messages;
create policy "chat_messages_delete" on public.chat_messages
  for delete to authenticated
  using (author_id = auth.uid() or public.is_admin_user());

create or replace function public.prune_chat_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  if auth.uid() is null then
    return 0;
  end if;

  delete from public.chat_messages
   where created_at < now() - interval '24 hours';

  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.prune_chat_messages() from public;
grant execute on function public.prune_chat_messages() to authenticated;

grant select, insert, delete on public.chat_messages to authenticated;

-- Realtime: a sala recebe mensagens novas sem recarregar.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.chat_messages;
    exception
      when duplicate_object then null;
      when others then null;
    end;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Administração: enxergar e gerenciar qualquer conta, inclusive privada
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select" on public.profiles
  for select to authenticated
  using (public.is_admin_user());

-- ---------------------------------------------------------------------------
-- 3) Música por link: o campo song_url aceita links de provedores externos.
--    Nada a alterar no schema; a validação acontece no servidor.
-- ---------------------------------------------------------------------------
