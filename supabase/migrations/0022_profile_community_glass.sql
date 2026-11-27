-- Ajustes de perfil e comunidade: enquadramento de banner, emblemas ocultos,
-- cores do player de música, banner e privacidade de comunidade.

alter table public.profiles
  add column if not exists banner_focus smallint not null default 50,
  add column if not exists hidden_badges text[] not null default '{}',
  add column if not exists song_text_color text,
  add column if not exists song_bubble_color text;

alter table public.communities
  add column if not exists banner_url text,
  add column if not exists banner_focus smallint not null default 50,
  add column if not exists is_private boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_banner_focus_range'
  ) then
    alter table public.profiles
      add constraint profiles_banner_focus_range check (banner_focus between 0 and 100);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'communities_banner_focus_range'
  ) then
    alter table public.communities
      add constraint communities_banner_focus_range check (banner_focus between 0 and 100);
  end if;
end $$;
