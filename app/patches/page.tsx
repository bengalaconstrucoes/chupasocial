import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Megaphone, MessagesSquare, Pin, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { AdminBadge } from "@/components/badges";
import { AnnouncementForm } from "@/components/announcement-form";
import { AnnouncementRoom } from "@/components/announcement-room";
import { Ducky } from "@/components/ducky";
import { ChatRoom } from "@/components/chat-room";
import type { ChatMessage } from "@/lib/actions/chat";
import { PATCHES } from "@/lib/patches";
import { createClient } from "@/lib/supabase/server";
import { formatDate, timeAgo } from "@/lib/utils";
import type { AnnouncementReply } from "@/lib/actions/announcements";

export const metadata: Metadata = { title: "Patches" };

export default async function PatchesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/patches");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, avatar_frame, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profileData) redirect("/login?erro=sessao");

  await supabase.rpc("prune_chat_messages");

  const [{ data: announcementRows }, { data: chatRows }] = await Promise.all([
    supabase
    .from("announcements")
    .select(
      "id, title, body, pinned, created_at, author:profiles!announcements_author_id_fkey(username, display_name, avatar_url, avatar_frame, is_admin)",
    )
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("chat_messages")
      .select(
        "id, author_id, body, created_at, author:profiles!chat_messages_author_id_fkey(username, display_name, avatar_url, avatar_frame)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const announcements = (announcementRows ?? []) as any[];
  const ids = announcements.map((item) => item.id as string);

  const { data: replyRows } =
    ids.length > 0
      ? await supabase
          .from("announcement_replies")
          .select(
            "id, announcement_id, author_id, body, created_at, author:profiles!announcement_replies_author_id_fkey(username, display_name, avatar_url, avatar_frame)",
          )
          .in("announcement_id", ids)
          .order("created_at", { ascending: true })
          .limit(500)
      : { data: [] as any[] };

  const repliesByAnnouncement = new Map<string, AnnouncementReply[]>();
  for (const row of (replyRows ?? []) as any[]) {
    const list = repliesByAnnouncement.get(row.announcement_id) ?? [];
    list.push(row as AnnouncementReply);
    repliesByAnnouncement.set(row.announcement_id, list);
  }

  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <h1 className="inline-flex items-center gap-1.5 text-base font-semibold">
          <Sparkles size={16} className="text-accent" /> Patches
        </h1>
        <p className="text-xs text-muted">
          Avisos da equipe e o que mudou no ChupaSocial, tudo em uma aba só.
        </p>
      </div>

      <div className="space-y-6 px-4 py-4 sm:px-5">
        <div>
          <Ducky tip="Avisos, histórico de versões e o chat das últimas 24 h ficam todos aqui." />
        </div>

        <section>
          <h2 className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold">
            <MessagesSquare size={14} className="text-accent" /> Chat das últimas 24 h
          </h2>
          <div className="chupa-card overflow-hidden">
            <ChatRoom
              initialMessages={[...((chatRows ?? []) as unknown as ChatMessage[])].reverse()}
              viewer={{
                id: profileData.id,
                username: profileData.username,
                display_name: profileData.display_name,
                avatar_url: profileData.avatar_url,
                avatar_frame: profileData.avatar_frame,
              }}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold">
            <Megaphone size={14} className="text-accent" /> Avisos da administração
          </h2>

          {profileData.is_admin && <AnnouncementForm />}

          {announcements.length === 0 ? (
            <p className="chupa-card p-5 text-center text-sm text-muted">
              Nenhum aviso publicado ainda.
            </p>
          ) : (
            <ul className="space-y-3">
              {announcements.map((announcement) => (
                <li key={announcement.id} className="chupa-card p-4">
                  <div className="flex items-start gap-2.5">
                    <Avatar
                      profile={announcement.author}
                      size={34}
                      link={Boolean(announcement.author)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <span className="font-semibold text-ink">
                          {announcement.author?.display_name ?? "Equipe"}
                        </span>
                        {announcement.author?.is_admin && <AdminBadge size={12} />}
                        <span>· {timeAgo(announcement.created_at)}</span>
                        {announcement.pinned && (
                          <span className="chip !py-0.5 !text-[0.6rem]">
                            <Pin size={9} /> fixado
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 text-[1.02rem] font-semibold leading-snug">
                        {announcement.title}
                      </h3>
                    </div>
                  </div>

                  <p className="prose-chupa mt-2 text-sm leading-relaxed">{announcement.body}</p>

                  <AnnouncementRoom
                    announcementId={announcement.id}
                    initialReplies={repliesByAnnouncement.get(announcement.id) ?? []}
                    viewer={{
                      id: profileData.id,
                      username: profileData.username,
                      display_name: profileData.display_name,
                      avatar_url: profileData.avatar_url,
                      avatar_frame: profileData.avatar_frame,
                    }}
                    canReply
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles size={14} className="text-accent" /> O que mudou, versão por versão
          </h2>
          <ol className="space-y-3">
            {PATCHES.map((patch) => (
              <li key={patch.version} className="chupa-card p-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.68rem] font-bold text-accent">
                    v{patch.version}
                  </span>
                  <h3 className="text-sm font-semibold">{patch.title}</h3>
                  <span className="ml-auto text-[0.68rem] text-muted">
                    {formatDate(patch.date)}
                  </span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {patch.highlights.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-muted">
                      <span
                        className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-accent"
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </AppShell>
  );
}
