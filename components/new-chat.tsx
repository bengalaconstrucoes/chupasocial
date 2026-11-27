"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Search, Users, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";
import { createGroupAction, startConversationAction } from "@/lib/actions/messages";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export function NewChat() {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile[]>([]);
  const [groupName, setGroupName] = useState("");
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
      .select("id, username, display_name, avatar_url, name_font, accent_color")
      .or(`username.ilike.${term},display_name.ilike.${term}`)
      .limit(8);
    setResults((data ?? []) as unknown as Profile[]);
    setLoading(false);
  }

  function open(profileId: string) {
    startTransition(async () => {
      const result = await startConversationAction(profileId);
      if (!result.ok) setError(result.error);
    });
  }

  function toggle(profile: Profile) {
    setSelected((current) =>
      current.some((item) => item.id === profile.id)
        ? current.filter((item) => item.id !== profile.id)
        : current.length >= 24
          ? current
          : [...current, profile],
    );
  }

  function createGroup() {
    setError(null);
    startTransition(async () => {
      const result = await createGroupAction(
        groupName,
        selected.map((profile) => profile.id),
      );
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg bg-surface-2 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("direct")}
            className={cn(
              "rounded-md px-2.5 py-1 font-medium",
              mode === "direct" ? "bg-surface text-ink shadow-sm" : "text-muted",
            )}
          >
            Conversa
          </button>
          <button
            type="button"
            onClick={() => setMode("group")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium",
              mode === "group" ? "bg-surface text-ink shadow-sm" : "text-muted",
            )}
          >
            <Users size={12} /> Grupo
          </button>
        </div>
        <span className="text-[0.68rem] text-muted">
          {mode === "group" ? "Até 25 pessoas" : "Buscar por nome ou @usuário"}
        </span>
      </div>

      {mode === "group" && (
        <div className="mt-2 space-y-2">
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            maxLength={60}
            placeholder="Nome do grupo"
            className="field text-sm"
            aria-label="Nome do grupo"
          />
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((profile) => (
                <span
                  key={profile.id}
                  className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-1 text-xs"
                >
                  @{profile.username}
                  <button
                    type="button"
                    onClick={() => toggle(profile)}
                    className="text-muted hover:text-danger"
                    aria-label={`Remover ${profile.username}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="relative mt-2">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          id="new-chat"
          value={query}
          onChange={(event) => search(event.target.value)}
          placeholder={mode === "group" ? "Adicionar pessoas ao grupo" : "Buscar por nome ou @usuário"}
          className="field pl-9 text-sm"
        />
        {loading && (
          <Loader2
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted"
          />
        )}
      </div>

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-lg border border-line">
          {results.map((profile) => {
            const active = selected.some((item) => item.id === profile.id);
            return (
              <li key={profile.id} className="border-b border-line last:border-0">
                <button
                  type="button"
                  onClick={() =>
                    mode === "group" ? toggle(profile) : open(profile.id)
                  }
                  disabled={pending}
                  className={cn(
                    "flex w-full items-center gap-2.5 bg-surface px-3 py-2 text-left hover:bg-surface-2",
                    active && "bg-accent-soft",
                  )}
                >
                  <Avatar profile={profile} size={30} link={false} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {profile.display_name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      @{profile.username}
                    </span>
                  </span>
                  {mode === "group" ? (
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border",
                        active
                          ? "border-accent bg-accent text-accent-ink"
                          : "border-line text-transparent",
                      )}
                    >
                      <Check size={12} />
                    </span>
                  ) : (
                    <span className="text-xs text-accent">conversar</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {mode === "group" && (
        <button
          type="button"
          onClick={createGroup}
          disabled={pending || selected.length === 0 || groupName.trim().length === 0}
          className="btn btn-primary mt-2 w-full !py-2 text-sm"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
          Criar grupo com {selected.length || "…"}
        </button>
      )}
    </div>
  );
}
