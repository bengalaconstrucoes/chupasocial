"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, RefreshCw, UserCheck, UserX } from "lucide-react";
import { Avatar } from "@/components/avatar";
import {
  approveMemberAction,
  declineMemberAction,
  regenerateInviteAction,
  updateCommunityExtrasAction,
} from "@/lib/actions/communities";
import type { Profile } from "@/lib/types";

type PendingMember = { user: Profile; joined_at: string };

export function CommunityExtras({
  communityId,
  requiresApproval,
  isPrivate,
  emojis,
  inviteToken,
  pendingMembers,
}: {
  communityId: string;
  requiresApproval: boolean;
  isPrivate: boolean;
  emojis: string[];
  inviteToken: string;
  pendingMembers: PendingMember[];
}) {
  const router = useRouter();
  const [approval, setApproval] = useState(requiresApproval);
  const [privateMode, setPrivateMode] = useState(isPrivate);
  const [emojiList, setEmojiList] = useState(emojis.join(" "));
  const [token, setToken] = useState(inviteToken);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const inviteLink = origin ? `${origin}/join/${token}` : `/join/${token}`;

  function save() {
    setError(null);
    setMessage(null);
    const list = emojiList
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    startTransition(async () => {
      const result = await updateCommunityExtrasAction(communityId, approval, list, privateMode);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Salvo.");
      router.refresh();
    });
  }

  function regenerate() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await regenerateInviteAction(communityId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
      setMessage("Link novo gerado. Recarregue para ver o token atualizado.");
    });
  }

  function decide(member: PendingMember, approve: boolean) {
    setError(null);
    startTransition(async () => {
      const result = approve
        ? await approveMemberAction(communityId, member.user.id)
        : await declineMemberAction(communityId, member.user.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Não foi possível copiar. Selecione o link manualmente.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={privateMode}
            onChange={(event) => setPrivateMode(event.target.checked)}
            className="mt-0.5 accent-[var(--accent)]"
          />
          <span>
            <span className="font-medium">Comunidade privada</span>
            <span className="block text-xs text-muted">
              As publicações ficam visíveis só para quem foi aceito na comunidade.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={approval}
            onChange={(event) => setApproval(event.target.checked)}
            className="mt-0.5 accent-[var(--accent)]"
          />
          <span>
            <span className="font-medium">Aprovar novos membros</span>
            <span className="block text-xs text-muted">
              Quem entrar fica pendente até um administrador aprovar.
            </span>
          </span>
        </label>
      </div>

      <div>
        <span className="field-label">Emojis da comunidade</span>
        <input
          value={emojiList}
          onChange={(event) => setEmojiList(event.target.value)}
          placeholder="🔥 🎧 🌊"
          className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <p className="mt-1 text-[0.68rem] text-muted">
          Até 12 emojis, separados por espaço. Eles aparecem como atalhos no composer da comunidade.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={save} disabled={pending} className="btn btn-primary text-xs">
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          salvar preferências
        </button>
      </div>

      <div className="border-t border-line pt-4">
        <span className="field-label">Convite por link</span>
        <div className="flex items-center gap-1.5">
          <input
            readOnly
            value={inviteLink}
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-muted"
          />
          <button
            type="button"
            onClick={copy}
            className="btn btn-ghost !px-2.5 !py-1.5 text-xs"
            aria-label="Copiar convite"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          <button
            type="button"
            onClick={regenerate}
            disabled={pending}
            className="btn btn-ghost !px-2.5 !py-1.5 text-xs"
            aria-label="Gerar novo link"
          >
            <RefreshCw size={13} />
          </button>
        </div>
        <p className="mt-1 text-[0.68rem] text-muted">
          Quem abrir o link entra direto (ou pede aprovação, se estiver ativada).
        </p>
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="mb-2 text-sm font-semibold">
          Pedidos pendentes ({pendingMembers.length})
        </h3>
        {pendingMembers.length === 0 ? (
          <p className="text-xs text-muted">Ninguém aguardando aprovação.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {pendingMembers.map((member) => (
              <li key={member.user.id} className="flex items-center gap-2.5 px-3 py-2.5">
                <Avatar profile={member.user} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.user.display_name}</p>
                  <p className="truncate text-xs text-muted">@{member.user.username}</p>
                </div>
                <button
                  type="button"
                  onClick={() => decide(member, true)}
                  disabled={pending}
                  className="btn btn-ghost !px-2 !py-1 text-[0.7rem]"
                  aria-label={`Aprovar ${member.user.username}`}
                >
                  <UserCheck size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => decide(member, false)}
                  disabled={pending}
                  className="btn btn-quiet !px-2 !py-1 text-[0.7rem] text-danger"
                  aria-label={`Recusar ${member.user.username}`}
                >
                  <UserX size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      {message && <p className="text-xs text-ok">{message}</p>}
      <p className="text-[0.68rem] text-muted">
        O token atual é <code>{token}</code>.
      </p>
    </div>
  );
}
