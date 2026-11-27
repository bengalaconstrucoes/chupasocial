"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AtSign,
  Bell,
  Check,
  Heart,
  Loader2,
  MessageCircle,
  Repeat2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";
import {
  clearNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/notifications";
import { respondFollowRequestAction } from "@/lib/actions/follow";
import { cn, timeAgo } from "@/lib/utils";
import type { NotificationItem } from "@/lib/types";

const icons = {
  follow: UserPlus,
  follow_request: UserPlus,
  like: Heart,
  comment: MessageCircle,
  reply: AtSign,
  repost: Repeat2,
  mention: AtSign,
  message: Bell,
  community: Users,
} as const;

const labels: Record<NotificationItem["type"], string> = {
  follow: "começou a te seguir",
  follow_request: "quer te seguir",
  like: "curtiu sua publicação",
  comment: "comentou sua publicação",
  reply: "respondeu seu comentário",
  repost: "repostou sua publicação",
  mention: "te mencionou em uma publicação",
  message: "te enviou uma mensagem",
  community: "entrou na sua comunidade",
};

function targetHref(item: NotificationItem) {
  if (item.type === "message" && item.conversation_id) return `/messages/${item.conversation_id}`;
  if (item.post_id) return `/post/${item.post_id}`;
  if (item.community_id && item.community?.slug) return `/communities/${item.community.slug}`;
  if (item.actor) return `/u/${item.actor.username}`;
  return "/notifications";
}

export function NotificationList({
  initialItems,
  viewerId,
}: {
  initialItems: NotificationItem[];
  viewerId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => setItems(initialItems), [initialItems]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("chupa-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${viewerId}`,
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, viewerId]);

  function markAll() {
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) setNotice(result.error);
      else router.refresh();
    });
  }

  function markOne(id: string) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read_at: new Date().toISOString() } : item)),
    );
    startTransition(async () => {
      await markNotificationReadAction(id);
    });
  }

  function clearAll() {
    startTransition(async () => {
      const result = await clearNotificationsAction();
      if (!result.ok) setNotice(result.error);
      else {
        setItems([]);
        router.refresh();
      }
    });
  }

  function respond(requesterId: string, accept: boolean) {
    startTransition(async () => {
      const result = await respondFollowRequestAction(requesterId, accept);
      if (!result.ok) setNotice(result.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5 sm:px-5">
        <button
          type="button"
          onClick={markAll}
          disabled={pending}
          className="btn btn-quiet !px-2.5 !py-1.5 text-xs"
        >
          <Check size={13} /> Marcar todas como lidas
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={pending || items.length === 0}
          className="btn btn-quiet !px-2.5 !py-1.5 text-xs"
        >
          Limpar
        </button>
        {pending && <Loader2 size={13} className="animate-spin text-muted" />}
        {notice && <span className="text-xs text-danger">{notice}</span>}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
          <Bell size={22} className="text-muted" />
          <h2 className="mt-2 text-base font-semibold">Tudo tranquilo por aqui</h2>
          <p className="max-w-xs text-sm text-muted">
            Curtidas, comentários, novos seguidores e mensagens aparecem nesta página.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const Icon = icons[item.type];
            const unread = !item.read_at;
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-start gap-3 bg-surface px-4 py-3.5 sm:px-5",
                  unread && "bg-[color-mix(in_srgb,var(--accent-soft)_45%,var(--surface))]",
                )}
              >
                <div className="relative shrink-0">
                  <Avatar profile={item.actor} size={38} />
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface text-accent">
                    <Icon size={11} />
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">
                    {item.actor ? (
                      <Link href={`/u/${item.actor.username}`} className="font-semibold hover:underline">
                        {item.actor.display_name}
                      </Link>
                    ) : (
                      <span className="font-semibold">Alguém</span>
                    )}{" "}
                    <span className="text-muted">{labels[item.type]}</span>
                    {item.type === "community" && item.community && (
                      <>
                        {" "}
                        <Link
                          href={`/communities/${item.community.slug}`}
                          className="font-medium text-accent hover:underline"
                        >
                          {item.community.name}
                        </Link>
                      </>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{timeAgo(item.created_at)}</p>

                  {item.type === "follow_request" && item.actor && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => respond(item.actor!.id, true)}
                        className="btn btn-primary !px-3 !py-1.5 text-xs"
                      >
                        <Check size={12} /> Aceitar
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => respond(item.actor!.id, false)}
                        className="btn btn-ghost !px-3 !py-1.5 text-xs"
                      >
                        <X size={12} /> Recusar
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <Link
                    href={targetHref(item)}
                    onClick={() => unread && markOne(item.id)}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    abrir
                  </Link>
                  {unread && (
                    <button
                      type="button"
                      onClick={() => markOne(item.id)}
                      className="text-[0.68rem] text-muted hover:text-ink"
                    >
                      marcar lida
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
