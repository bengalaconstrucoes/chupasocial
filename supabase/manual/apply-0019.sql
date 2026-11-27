-- ---------------------------------------------------------------------------
-- Login pelo nome de usuário atual (mesmo depois de trocar de @)
-- e liberação de nomes de contas órfãs (sem perfil).
-- ---------------------------------------------------------------------------

-- Devolve a parte local do e-mail sintético original da conta cujo
-- profiles.username é o informado. Assim o login continua funcionando com o
-- nome novo depois de uma troca de usuário.
create or replace function public.login_username_for(p_username citext)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select split_part(u.email, '@', 1)
  from public.profiles pr
  join auth.users u on u.id = pr.id
  where pr.username = p_username
    and u.email like '%@chupasocial.invalid'
  limit 1;
$$;

revoke all on function public.login_username_for(citext) from public;
grant execute on function public.login_username_for(citext) to anon, authenticated;

-- Contas que ficaram sem perfil (exclusão antiga) continuam segurando o e-mail
-- sintético do username. Aqui o e-mail órfão é renomeado, liberando o nome
-- para um novo cadastro. Nunca toca em conta que ainda tenha perfil.
create or replace function public.release_username(p_username citext)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(btrim(p_username::text)) || '@chupasocial.invalid';
  v_id uuid;
  v_new text;
begin
  select u.id into v_id
    from auth.users u
   where lower(u.email) = v_email
   limit 1;

  if v_id is null then
    return false;
  end if;

  if exists (select 1 from public.profiles p where p.id = v_id) then
    return false;
  end if;

  v_new := 'released+' || replace(v_id::text, '-', '') || '@chupasocial.invalid';

  update auth.users
     set email = v_new,
         updated_at = now()
   where id = v_id;

  update auth.identities
     set provider_id = v_new,
         identity_data = jsonb_set(
           coalesce(identity_data, '{}'::jsonb),
           '{email}',
           to_jsonb(v_new::text)
         )
   where user_id = v_id
     and provider = 'email';

  return true;
end;
$$;

revoke all on function public.release_username(citext) from public;
grant execute on function public.release_username(citext) to anon, authenticated;

notify pgrst, 'reload schema';
