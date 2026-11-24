-- =============================================================================
-- ChupaSocial — 0007 — Volatilidade das funções de visibilidade
-- Funções STABLE usam o snapshot da consulta; com RETURNING, a linha recém
-- inserida ainda não existe para elas e o INSERT falha na política de SELECT.
-- VOLATILE garante um snapshot novo e permite `insert(...).select()`.
-- =============================================================================

create or replace function public.can_view_post(p_post uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.posts p join public.profiles pr on pr.id = p.author_id
    where p.id = p_post
      and (pr.deactivated_at is null or p.author_id = auth.uid())
      and (p.author_id = auth.uid() or (pr.is_private = false or public.is_following(auth.uid(), p.author_id)))
  );
$$;

create or replace function public.can_view_profile(p_profile uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = p_profile
      and (pr.deactivated_at is null or pr.id = auth.uid())
      and (pr.id = auth.uid() or pr.is_private = false or public.is_following(auth.uid(), pr.id))
  );
$$;

create or replace function public.is_conversation_member(p_conversation uuid, p_user uuid)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation and user_id = p_user
  );
$$;

grant execute on function public.can_view_post(uuid) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;
