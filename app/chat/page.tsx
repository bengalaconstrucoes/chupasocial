import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ChatRoom } from "@/components/chat-room";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage } from "@/lib/actions/chat";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/chat");

  // Aproveita a visita para limpar o que já passou de 24 h.
  await supabase.rpc("prune_chat_messages");

  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, avatar_frame")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("chat_messages")
      .select(
        "id, author_id, body, created_at, author:profiles!chat_messages_author_id_fkey(username, display_name, avatar_url, avatar_frame)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (!profile) redirect("/login?erro=sessao");

  // Veio do mais novo para o mais antigo só para pegar as últimas 200;
  // na tela a conversa aparece em ordem cronológica.
  const messages = [...((rows ?? []) as unknown as ChatMessage[])].reverse();

  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <h1 className="inline-flex items-center gap-1.5 text-base font-semibold">
          <MessagesSquare size={16} className="text-accent" /> Chat
        </h1>
        <p className="text-xs text-muted">
          Bate-papo aberto e em tempo real. A sala se limpa sozinha a cada 24 horas.
        </p>
      </div>

      <ChatRoom initialMessages={messages} viewer={profile} />
    </AppShell>
  );
}
