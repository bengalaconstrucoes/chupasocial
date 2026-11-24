import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { NewChat } from "@/components/new-chat";
import { fetchConversations } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { formatTime, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Mensagens" };

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/messages");

  const conversations = await fetchConversations(user.id);

  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <h1 className="text-base font-semibold">Mensagens</h1>
      </div>

      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <NewChat />
      </div>

      {conversations.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <h2 className="text-base font-semibold">Nenhuma conversa ainda</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            Encontre alguém na busca acima e mande a primeira mensagem. Conversas ficam salvas aqui.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <Link
                href={`/messages/${conversation.id}`}
                className="flex items-center gap-3 bg-surface px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5"
              >
                <Avatar profile={conversation.other} size={42} link={false} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold">
                      {conversation.other?.display_name ?? "Conversa"}
                    </p>
                    <span className="shrink-0 text-[0.7rem] text-muted">
                      {formatTime(conversation.last_message_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {conversation.last_message ?? "Conversa iniciada"}
                  </p>
                </div>
                {conversation.unread_count > 0 && (
                  <span className="min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-[0.68rem] font-bold text-accent-ink">
                    {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
