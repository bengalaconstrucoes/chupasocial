"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { PostCard } from "@/components/post-card";
import { EmptyState } from "@/components/empty-state";
import { loadMorePostsAction } from "@/lib/actions/feed";
import type { FeedPost } from "@/lib/types";

export function FeedList({
  initialPosts,
  viewerId,
  mode,
  profileId,
  communityId,
  emptyTitle,
  emptyDescription,
}: {
  initialPosts: FeedPost[];
  viewerId: string;
  mode: "all" | "following" | "profile" | "community";
  profileId?: string;
  communityId?: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(initialPosts.length < 12);

  useEffect(() => {
    setPosts(initialPosts);
    setDone(initialPosts.length < 12);
  }, [initialPosts]);

  function loadMore() {
    const last = posts[posts.length - 1];
    if (!last) return;
    startTransition(async () => {
      const next = await loadMorePostsAction({
        mode,
        before: last.created_at,
        profileId,
        communityId,
      });
      if (next.length === 0) {
        setDone(true);
        return;
      }
      setPosts((current) => {
        const seen = new Set(current.map((post) => post.id));
        return [...current, ...next.filter((post) => !seen.has(post.id))];
      });
      if (next.length < 12) setDone(true);
    });
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        icon={<span className="text-3xl">🫧</span>}
      />
    );
  }

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} viewerId={viewerId} />
      ))}

      <div className="flex justify-center px-4 py-5">
        {done ? (
          <p className="text-xs text-muted">Você chegou ao fim do feed por aqui.</p>
        ) : (
          <button
            type="button"
            onClick={loadMore}
            disabled={pending}
            className="btn btn-ghost"
          >
            {pending && <Loader2 size={14} className="animate-spin" />}
            {pending ? "Carregando" : "Ver publicações anteriores"}
          </button>
        )}
      </div>
    </div>
  );
}
