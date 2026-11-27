-- =============================================================================
-- ChupaSocial — 0012 — Corrige a busca por conversa individual
-- Um grupo com exatamente duas pessoas (criador + convidado) era confundido
-- com uma DM. Agora só conversas sem título entram na busca.
-- =============================================================================

create or replace function public.get_or_create_conversation(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_conversation uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if p_other = v_me then
    raise exception 'cannot_message_self';
  end if;
  if not exists (select 1 from public.profiles where id = p_other) then
    raise exception 'profile_not_found';
  end if;

  select c.id into v_conversation
    from public.conversations c
    join public.conversation_members m1
      on m1.conversation_id = c.id and m1.user_id = v_me
    join public.conversation_members m2
      on m2.conversation_id = c.id and m2.user_id = p_other
   where c.title is null
     and (select count(*) from public.conversation_members m
           where m.conversation_id = c.id) = 2
   limit 1;

  if v_conversation is null then
    insert into public.conversations (created_by) values (v_me) returning id into v_conversation;
    insert into public.conversation_members (conversation_id, user_id)
    values (v_conversation, v_me), (v_conversation, p_other);
  end if;

  return v_conversation;
end;
$$;
