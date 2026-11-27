import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { NewChat } from "@/components/new-chat";
import { StartChatButton } from "@/components/start-chat-button";
import { fetchConversations, fetchFollowList } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Mensagens" };

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/messages");

  const [conversations, following] = await Promise.all([
    fetchConversations(user.id),
    fetchFollowList(user.id, "following"),
  ]);

  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <h1 className="text-base font-semibold">Mensagens</h1>
        <p className="text-xs text-muted">Conversas diretas, grupos e chamadas.</p>
      </div>

      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <NewChat />
      </div>

      {following.length > 0 && (
        <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Quem você segue
            </h2>
            <span className="text-[0.68rem] text-muted">clique para conversar</span>
          </div>
          <ul className="flex gap-3 overflow-x-auto pb-1">
            {following.slice(0, 20).map((person) => (
              <li key={person.id} className="w-[74px] shrink-0 text-center">
                <div className="flex justify-center">
                  <Avatar profile={person} size={48} />
                </div>
                <p className="mt-1 truncate text-[0.7rem] font-medium">{person.display_name}</p>
                <StartChatButton userId={person.id} name={person.display_name} compact />
              </li>
            ))}
          </ul>
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <h2 className="text-base font-semibold">Nenhuma conversa ainda</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            Encontre alguém na busca acima e mande a primeira mensagem — ou crie um grupo com
            várias pessoas de uma vez.
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
                {conversation.is_group ? (
                  <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Users size={19} />
                  </span>
                ) : (
                  <Avatar profile={conversation.other} size={42} link={false} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold">
                      {conversation.is_group
                        ? conversation.title || "Grupo sem nome"
                        : conversation.other?.display_name ?? "Conversa"}
                    </p>
                    <span className="shrink-0 text-[0.7rem] text-muted">
                      {formatTime(conversation.last_message_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {conversation.is_group && (
                      <span className="text-muted">
                        {conversation.members.length} participantes ·{" "}
                      </span>
                    )}
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
