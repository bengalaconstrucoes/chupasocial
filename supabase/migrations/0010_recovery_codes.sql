-- =============================================================================
-- ChupaSocial — 0010 — Contas sem e-mail + código de recuperação
-- =============================================================================
-- O envio de e-mail (SMTP) foi desativado por custo. Contas novas são criadas
-- com um e-mail sintético não entregável (<username>@chupasocial.invalid) e
-- entram com usuário + senha. Cada conta pode ter um código secreto de
-- recuperação, guardado apenas como hash SHA-256.
-- =============================================================================

do $$
begin
  create extension if not exists pgcrypto;
exception
  when others then null;
end $$;

-- ---------------------------------------------------------------------------
-- account_recovery — sem políticas de RLS: só as funções SECURITY DEFINER
-- abaixo enxergam a tabela.
-- ---------------------------------------------------------------------------
create table if not exists public.account_recovery (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  code_hash    text not null,
  attempts     integer not null default 0,
  locked_until timestamptz,
  created_at   timestamptz not null default now(),
  constraint account_recovery_hash_format check (code_hash ~ '^[0-9a-f]{64}$')
);

alter table public.account_recovery enable row level security;
revoke all on public.account_recovery from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Grava (ou rotaciona) o código da conta logada. O app envia só o hash.
-- ---------------------------------------------------------------------------
create or replace function public.set_recovery_code(p_hash text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_hash' using errcode = '22023';
  end if;

  insert into public.account_recovery (user_id, code_hash, attempts, locked_until)
  values (v_me, p_hash, 0, null)
  on conflict (user_id) do update
    set code_hash = excluded.code_hash,
        attempts = 0,
        locked_until = null,
        created_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Redefine a senha usando usuário + código. Disponível sem sessão.
-- Bloqueia por 15 minutos após 5 tentativas erradas.
-- ---------------------------------------------------------------------------
create or replace function public.reset_password_with_recovery_code(
  p_username citext,
  p_hash text,
  p_new_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user     uuid;
  v_hash     text;
  v_locked   timestamptz;
  v_attempts integer;
begin
  if char_length(coalesce(p_new_password, '')) < 8 then
    raise exception 'password_too_short' using errcode = '22023';
  end if;

  select p.id into v_user
    from public.profiles p
   where p.username = lower(btrim(p_username));

  if v_user is null then
    raise exception 'recovery_invalid' using errcode = '22023';
  end if;

  select code_hash, locked_until, attempts
    into v_hash, v_locked, v_attempts
    from public.account_recovery
   where user_id = v_user
     for update;

  if v_hash is null then
    raise exception 'recovery_missing' using errcode = '22023';
  end if;

  if v_locked is not null and v_locked > now() then
    raise exception 'recovery_locked' using errcode = '22023';
  end if;

  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' or p_hash <> v_hash then
    update public.account_recovery
       set attempts = attempts + 1,
           locked_until = case
             when attempts + 1 >= 5 then now() + interval '15 minutes'
             else null
           end
     where user_id = v_user;
    raise exception 'recovery_invalid' using errcode = '22023';
  end if;

  update auth.users
     set encrypted_password = crypt(p_new_password, gen_salt('bf')),
         updated_at = now()
   where id = v_user;

  -- Derruba sessões antigas do usuário.
  delete from auth.sessions where user_id = v_user;

  update public.account_recovery
     set attempts = 0,
         locked_until = null
   where user_id = v_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dica de login: contas antigas (com e-mail real) precisam entrar por e-mail.
-- Devolve apenas 'username', 'email' ou 'unknown' — nunca o endereço.
-- ---------------------------------------------------------------------------
create or replace function public.account_login_hint(p_username citext)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select u.email into v_email
    from auth.users u
    join public.profiles pr on pr.id = u.id
   where pr.username = lower(btrim(p_username))
   limit 1;

  if v_email is null then
    return 'unknown';
  end if;

  if v_email like '%@chupasocial.invalid' then
    return 'username';
  end if;

  return 'email';
end;
$$;

-- ---------------------------------------------------------------------------
-- A conta logada já tem um código salvo?
-- ---------------------------------------------------------------------------
create or replace function public.has_recovery_code()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.account_recovery where user_id = auth.uid());
$$;

revoke all on function public.has_recovery_code() from anon;
grant execute on function public.has_recovery_code() to authenticated;

revoke all on function public.set_recovery_code(text) from anon;
grant execute on function public.set_recovery_code(text) to authenticated;
grant execute on function public.reset_password_with_recovery_code(citext, text, text) to anon, authenticated;
grant execute on function public.account_login_hint(citext) to anon, authenticated;
