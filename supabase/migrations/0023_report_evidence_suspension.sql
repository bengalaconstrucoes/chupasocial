-- Denúncias com prints, suspensão temporária e banimento definitivo.

alter table public.reports
  add column if not exists evidence_paths text[] not null default '{}';

alter table public.profiles
  add column if not exists suspended_until timestamptz;

create index if not exists profiles_suspended_idx
  on public.profiles (suspended_until)
  where suspended_until is not null;

-- Moderadores (admins) veem todas as denúncias, não só as próprias.
drop policy if exists "reports_select_admin" on public.reports;
create policy "reports_select_admin" on public.reports
  for select to authenticated
  using (public.is_admin_user());

-- ---------------------------------------------------------------------------
-- Provas (prints) — bucket privado, só quem denunciou envia e só admin lê.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-evidence',
  'report-evidence',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "report_evidence_insert" on storage.objects;
create policy "report_evidence_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'report-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "report_evidence_admin_read" on storage.objects;
create policy "report_evidence_admin_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'report-evidence' and public.is_admin_user());

-- ---------------------------------------------------------------------------
-- Sanções
-- ---------------------------------------------------------------------------
create or replace function public.admin_suspend_user(p_user uuid, p_days integer)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_until timestamptz;
begin
  if not public.is_admin_user() then
    raise exception 'not_admin';
  end if;
  if p_user = auth.uid() then
    raise exception 'self';
  end if;
  if p_days is null or p_days < 0 or p_days > 365 then
    raise exception 'invalid_days';
  end if;

  if p_days = 0 then
    update public.profiles set suspended_until = null where id = p_user;
    return null;
  end if;

  v_until := now() + (p_days || ' days')::interval;
  update public.profiles set suspended_until = v_until where id = p_user;
  return v_until;
end;
$$;

create or replace function public.admin_ban_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'not_admin';
  end if;
  if p_user = auth.uid() then
    raise exception 'self';
  end if;

  -- O perfil e o conteúdo caem junto (FK em cascata).
  delete from auth.users where id = p_user;
end;
$$;

revoke all on function public.admin_suspend_user(uuid, integer) from public;
revoke all on function public.admin_ban_user(uuid) from public;
grant execute on function public.admin_suspend_user(uuid, integer) to authenticated;
grant execute on function public.admin_ban_user(uuid) to authenticated;
