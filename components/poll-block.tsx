"use client";

import { useEffect, useState, useTransition } from "react";
import { BarChart3, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPollAction, votePollAction } from "@/lib/actions/features";
import { cn } from "@/lib/utils";
import type { PostPoll } from "@/lib/types";

export function PollBlock({
  postId,
  initial,
}: {
  postId: string;
  initial: PostPoll;
}) {
  const [poll, setPoll] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPoll(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const channel = supabase
      .channel(`chupa-poll-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "poll_votes",
          filter: `post_id=eq.${postId}`,
        },
        async () => {
          const next = await getPollAction(postId);
          if (!active) return;
          setPoll({ options: next.options, my_vote: next.myVote, total: next.total });
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [postId]);

  function vote(optionId: string) {
    if (pending) return;
    setError(null);
    const previous = poll;
    const already = poll.my_vote === optionId;

    setPoll((current) => {
      const options = current.options.map((option) => {
        let count = option.count;
        if (option.id === current.my_vote) count = Math.max(0, count - 1);
        if (option.id === optionId && !already) count += 1;
        return { ...option, count };
      });
      const total = options.reduce((sum, option) => sum + option.count, 0);
      return {
        options,
        my_vote: already ? null : optionId,
        total,
      };
    });

    startTransition(async () => {
      const result = await votePollAction(postId, optionId);
      if (!result.ok) {
        setPoll(previous);
        setError(result.error);
        return;
      }
      const next = await getPollAction(postId);
      setPoll({ options: next.options, my_vote: next.myVote, total: next.total });
    });
  }

  const total = poll.total;
  const voted = Boolean(poll.my_vote);

  return (
    <div className="mt-2 rounded-xl border border-line bg-bg p-3">
      <p className="mb-2 inline-flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted">
        <BarChart3 size={12} /> enquete
      </p>

      <div className="space-y-1.5">
        {poll.options.map((option) => {
          const percent = total === 0 ? 0 : Math.round((option.count / total) * 100);
          const mine = poll.my_vote === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => vote(option.id)}
              disabled={pending}
              aria-pressed={mine}
              className={cn(
                "relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-80",
                mine ? "border-accent" : "border-line hover:border-accent/60",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width] duration-300",
                  mine ? "bg-accent/20" : "bg-surface-2",
                )}
                style={{ width: `${percent}%` }}
              />
              <span className="relative flex min-w-0 items-center gap-1.5">
                {mine && <Check size={13} className="shrink-0 text-accent" />}
                <span className="truncate">{option.label}</span>
              </span>
              <span className="relative shrink-0 text-xs tabular-nums text-muted">
                {percent}%
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-[0.7rem] text-muted">
        {pending && <Loader2 size={11} className="animate-spin" />}
        {total} {total === 1 ? "voto" : "votos"}
        {voted ? " · você votou (clique para retirar)" : " · vote para ver os resultados"}
      </p>
      {error && <p role="alert" className="mt-1 text-[0.7rem] text-danger">{error}</p>}
    </div>
  );
}
