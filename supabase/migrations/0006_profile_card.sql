-- =============================================================================
-- ChupaSocial — 0006 — Cabeçalho público de perfil
-- Permite mostrar "perfil privado" sem expor publicações: retorna apenas os
-- campos de apresentação, nunca conteúdo protegido.
-- =============================================================================

create or replace function public.get_profile_by_username(p_username citext)
returns table (
  id uuid, username citext, display_name text, bio text, avatar_url text, banner_url text,
  website text, is_private boolean, deactivated_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id, pr.username, pr.display_name, pr.bio, pr.avatar_url, pr.banner_url,
         pr.website, pr.is_private, pr.deactivated_at, pr.created_at
  from public.profiles pr
  where pr.username = p_username
    and (pr.deactivated_at is null or pr.id = auth.uid());
$$;

grant execute on function public.get_profile_by_username(citext) to anon, authenticated;
