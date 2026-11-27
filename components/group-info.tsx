"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Search, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { createClient } from "@/lib/supabase/client";
import {
  addGroupMembersAction,
  leaveGroupAction,
  renameGroupAction,
} from "@/lib/actions/messages";
import type { Profile } from "@/lib/types";

export function GroupInfo({
  conversationId,
  title,
  createdBy,
  viewerId,
  members,
  onClose,
}: {
  conversationId: string;
  title: string;
  createdBy: string | null;
  viewerId: string;
  members: Profile[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(title);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [pending, startTransition] = useTransition();

  const isCreator = createdBy === viewerId;

  async function searchPeople(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const supabase = createClient();
    const term = `%${value.trim()}%`;
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, name_font, accent_color")
      .or(`username.ilike.${term},display_name.ilike.${term}`)
      .neq("id", viewerId)
      .limit(6);
    setResults(
      ((data ?? []) as unknown as Profile[]).filter(
        (profile) => !members.some((member) => member.id === profile.id),
      ),
    );
    setSearching(false);
  }

  function add(profile: Profile) {
    setError(null);
    startTransition(async () => {
      const result = await addGroupMembersAction(conversationId, [profile.id]);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`${profile.display_name} entrou no grupo.`);
      setQuery("");
      setResults([]);
      router.refresh();
    });
  }

  function rename() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await renameGroupAction(conversationId, name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Nome atualizado.");
      router.refresh();
    });
  }

  function leave() {
    setError(null);
    startTransition(async () => {
      const result = await leaveGroupAction(conversationId);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-pop max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-surface p-4 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Informações do grupo</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Fechar"
          >
            <X size={17} />
          </button>
        </div>

        {message && <p className="mb-2 text-xs text-ok">{message}</p>}
        {error && <p className="mb-2 text-xs text-danger">{error}</p>}

        <label className="field-label" htmlFor="group-name">
          Nome do grupo
        </label>
        <div className="flex gap-2">
          <input
            id="group-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            disabled={!isCreator}
            className="field text-sm disabled:opacity-70"
          />
          {isCreator && (
            <button
              type="button"
              onClick={rename}
              disabled={pending || name.trim() === title}
              className="btn btn-ghost !px-3 text-xs"
            >
              Salvar
            </button>
          )}
        </div>
        {!isCreator && (
          <p className="mt-1 text-[0.68rem] text-muted">
            Só quem criou o grupo pode mudar o nome e adicionar pessoas.
          </p>
        )}

        <h3 className="mt-5 text-sm font-semibold">
          Participantes <span className="text-muted">({members.length})</span>
        </h3>
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-2.5 px-3 py-2">
              <Avatar profile={member} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.display_name}</p>
                <p className="truncate text-xs text-muted">@{member.username}</p>
              </div>
              {member.id === createdBy && (
                <span className="chip !py-0.5 !text-[0.6rem]">criador</span>
              )}
              {member.id === viewerId && (
                <span className="text-[0.65rem] text-muted">você</span>
              )}
            </li>
          ))}
        </ul>

        {isCreator && (
          <div className="mt-4">
            <label className="field-label" htmlFor="group-add">
              Adicionar pessoa
            </label>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                id="group-add"
                value={query}
                onChange={(event) => searchPeople(event.target.value)}
                placeholder="Buscar por nome ou @usuário"
                className="field pl-8 text-sm"
              />
              {searching && (
                <Loader2
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted"
                />
              )}
            </div>
            {results.length > 0 && (
              <ul className="mt-2 overflow-hidden rounded-lg border border-line">
                {results.map((profile) => (
                  <li key={profile.id} className="border-b border-line last:border-0">
                    <button
                      type="button"
                      onClick={() => add(profile)}
                      disabled={pending}
                      className="flex w-full items-center gap-2 bg-surface px-3 py-2 text-left hover:bg-surface-2"
                    >
                      <Avatar profile={profile} size={28} link={false} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{profile.display_name}</span>
                        <span className="block truncate text-xs text-muted">
                          @{profile.username}
                        </span>
                      </span>
                      <UserPlus size={14} className="text-accent" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-5 border-t border-line pt-4">
          {!confirmLeave ? (
            <button
              type="button"
              onClick={() => setConfirmLeave(true)}
              className="btn btn-danger w-full"
            >
              <LogOut size={14} /> Sair do grupo
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={leave}
                disabled={pending}
                className="btn btn-danger flex-1"
              >
                {pending && <Loader2 size={13} className="animate-spin" />}
                Confirmar saída
              </button>
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="btn btn-ghost flex-1"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
