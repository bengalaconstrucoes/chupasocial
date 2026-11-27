-- Performance: resumos de conversa em uma consulta e total de não lidas por RPC.

create index if not exists post_views_viewer_idx
  on public.post_views (viewer_id, post_id);

create or replace function public.unread_message_total()
returns bigint
language sql
stable
set search_path = public
as $$
  select count(*)
  from public.messages m
  join public.conversation_members cm
    on cm.conversation_id = m.conversation_id
  where cm.user_id = auth.uid()
    and m.created_at > cm.last_read_at
    and m.sender_id <> auth.uid();
$$;

create or replace function public.conversation_summaries(p_limit integer default 50)
returns table (
  id uuid,
  title text,
  last_message_at timestamptz,
  last_message text,
  last_attachment text,
  unread_count bigint,
  members jsonb
)
language sql
stable
set search_path = public
as $$
  with mine as (
    select cm.conversation_id, cm.last_read_at
    from public.conversation_members cm
    where cm.user_id = auth.uid()
  ),
  conv as (
    select
      c.id as conversation_id,
      c.title as conversation_title,
      c.last_message_at as conversation_last_message_at
    from public.conversations c
    join mine m on m.conversation_id = c.id
    order by c.last_message_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  )
  select
    conv.conversation_id,
    conv.conversation_title,
    conv.conversation_last_message_at,
    last_msg.body,
    last_msg.attachment_type,
    coalesce(unread.total, 0),
    coalesce(mem.list, '[]'::jsonb)
  from conv
  join mine m on m.conversation_id = conv.conversation_id
  left join lateral (
    select msg.body, msg.attachment_type
    from public.messages msg
    where msg.conversation_id = conv.conversation_id
    order by msg.created_at desc
    limit 1
  ) last_msg on true
  left join lateral (
    select count(*) as total
    from public.messages msg
    where msg.conversation_id = conv.conversation_id
      and msg.created_at > m.last_read_at
      and msg.sender_id <> auth.uid()
  ) unread on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'avatar_frame', p.avatar_frame,
        'is_verified', p.is_verified
      )
    ) as list
    from public.conversation_members cm2
    join public.profiles p on p.id = cm2.user_id
    where cm2.conversation_id = conv.conversation_id
  ) mem on true;
$$;

grant execute on function public.unread_message_total() to authenticated;
grant execute on function public.conversation_summaries(integer) to authenticated;
