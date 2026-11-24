-- =============================================================================
-- ChupaSocial — 0008 — Políticas compatíveis com INSERT ... RETURNING
-- A política de SELECT não pode depender de uma consulta à própria tabela para
-- a linha recém-inserida (ela ainda não é visível na mesma instrução). O atalho
-- pelo próprio dono resolve sem perder a checagem de privacidade.
-- =============================================================================

drop policy if exists "posts_select_visible" on public.posts;
create policy "posts_select_visible" on public.posts for select to authenticated
  using (author_id = auth.uid() or public.can_view_post(id));

drop policy if exists "comments_select_visible" on public.comments;
create policy "comments_select_visible" on public.comments for select to authenticated
  using (author_id = auth.uid() or public.can_view_post(post_id));

drop policy if exists "likes_select_visible" on public.likes;
create policy "likes_select_visible" on public.likes for select to authenticated
  using (user_id = auth.uid() or public.can_view_post(post_id));

drop policy if exists "profiles_select_visible" on public.profiles;
create policy "profiles_select_visible" on public.profiles for select to authenticated
  using (id = auth.uid() or public.can_view_profile(id));

drop policy if exists "post_media_select_visible" on public.post_media;
create policy "post_media_select_visible" on public.post_media for select to authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
    or public.can_view_post(post_id)
  );
