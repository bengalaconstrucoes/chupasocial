"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Mantém `profiles.last_seen_at` atualizado para online/ausente. */
export function PresenceHeartbeat() {
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    function beat() {
      if (!active || document.visibilityState === "hidden") return;
      void supabase.rpc("touch_presence");
    }

    beat();
    const timer = window.setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);

  return null;
}
