"use client";

import { useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";
import { startConversationAction } from "@/lib/actions/messages";
import type { Profile } from "@/lib/types";

export function NewChat() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function search(value: string) {
    setQuery(value);
    setError(null);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const term = `%${value.trim()}%`;
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.${term},display_name.ilike.${term}`)
      .limit(6);
    setResults((data ?? []) as unknown as Profile[]);
    setLoading(false);
  }

  function open(profileId: string) {
    startTransition(async () => {
      const result = await startConversationAction(profileId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div>
      <label htmlFor="new-chat" className="field-label">
        Nova conversa
      </label>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id="new-chat"
          value={query}
          onChange={(event) => search(event.target.value)}
          placeholder="Buscar por nome ou @usuário"
          className="field pl-9 text-sm"
        />
        {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted" />}
      </div>

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-lg border border-line">
          {results.map((profile) => (
            <li key={profile.id} className="border-b border-line last:border-0">
              <button
                type="button"
                onClick={() => open(profile.id)}
                disabled={pending}
                className="flex w-full items-center gap-2.5 bg-surface px-3 py-2 text-left hover:bg-surface-2"
              >
                <Avatar profile={profile} size={30} link={false} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{profile.display_name}</span>
                  <span className="block truncate text-xs text-muted">@{profile.username}</span>
                </span>
                <span className="text-xs text-accent">conversar</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
