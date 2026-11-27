import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MessageThread } from "@/components/message-thread";
import { createClient } from "@/lib/supabase/server";
import type { Message, Profile } from "@/lib/types";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/messages/${id}`);

  const { data: membership } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) notFound();

  const [{ data: conversation }, { data: memberRows }, { data: messages }, { data: viewerRow }] =
    await Promise.all([
      supabase.from("conversations").select("id, title, created_by").eq("id", id).maybeSingle(),
      supabase
        .from("conversation_members")
        .select("user:profiles!conversation_members_user_id_fkey(*)")
        .eq("conversation_id", id),
      supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", id)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    ]);

  const members = ((memberRows ?? [])
    .map((row: any) => row.user as Profile | null)
    .filter(Boolean) as Profile[]).sort((a, b) => {
    if (a.id === user.id) return -1;
    if (b.id === user.id) return 1;
    return a.display_name.localeCompare(b.display_name, "pt-BR");
  });

  const viewer = viewerRow as Profile | null;
  if (!viewer) redirect("/login?erro=sessao");

  const title = (conversation?.title as string | null) ?? null;

  return (
    <AppShell>
      <MessageThread
        conversationId={id}
        title={title}
        createdBy={(conversation?.created_by as string | null) ?? null}
        isGroup={Boolean(title) || members.length > 2}
        viewer={viewer}
        members={members}
        initialMessages={(messages ?? []) as Message[]}
      />
    </AppShell>
  );
}
