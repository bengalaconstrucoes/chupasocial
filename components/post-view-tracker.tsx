"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Registra a view uma única vez por post a cada sessão do navegador. */
export function PostViewTracker({ postId }: { postId: string }) {
  useEffect(() => {
    if (!postId) return;
    const key = `chupa-view:${postId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // modo privado sem sessionStorage: registra mesmo assim
    }
    const supabase = createClient();
    void supabase
      .rpc("record_post_view", { p_post: postId })
      .then(() => undefined, () => undefined);
  }, [postId]);

  return null;
}
