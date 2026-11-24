import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
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

  const [{ data: otherRows }, { data: messages }] = await Promise.all([
    supabase
      .from("conversation_members")
      .select("user:profiles!conversation_members_user_id_fkey(*)")
      .eq("conversation_id", id)
      .neq("user_id", user.id)
      .limit(1),
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(200),
  ]);

  const other = ((otherRows?.[0] as any)?.user ?? null) as Profile | null;

  return (
    <AppShell>
      <div className="flex items-center gap-3 border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur sm:px-5">
        <Link
          href="/messages"
          className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
          aria-label="Voltar para mensagens"
        >
          <ArrowLeft size={18} />
        </Link>
        <Avatar profile={other} size={34} />
        <div className="min-w-0">
          <Link href={other ? `/u/${other.username}` : "#"} className="block truncate text-sm font-semibold hover:underline">
            {other?.display_name ?? "Conversa"}
          </Link>
          {other && <p className="truncate text-xs text-muted">@{other.username}</p>}
        </div>
      </div>

      <MessageThread
        conversationId={id}
        viewerId={user.id}
        initialMessages={(messages ?? []) as Message[]}
        other={other}
      />
    </AppShell>
  );
}
