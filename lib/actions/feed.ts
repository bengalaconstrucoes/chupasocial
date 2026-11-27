"use server";

import { fetchFeed } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { FeedPost } from "@/lib/types";

export async function loadMorePostsAction(options: {
  mode: "all" | "following" | "profile" | "community" | "hashtag";
  before: string;
  profileId?: string;
  communityId?: string;
  tag?: string;
}): Promise<FeedPost[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  return fetchFeed({
    mode: options.mode,
    before: options.before,
    profileId: options.profileId,
    communityId: options.communityId,
    tag: options.tag,
    viewerId: user.id,
    limit: 12,
  });
}
