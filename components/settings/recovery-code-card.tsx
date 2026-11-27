"use client";

import { useActionState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { RecoveryCodeBox } from "@/components/copy-code";
import { regenerateRecoveryCodeAction, type RecoveryState } from "@/lib/actions/auth";

const initial: RecoveryState = {};

export function RecoveryCodeCard({ hasCode }: { hasCode: boolean }) {
  const [state, action, pending] = useActionState(regenerateRecoveryCodeAction, initial);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-muted">
          <KeyRound size={17} />
        </span>
        <div>
          <p className="text-sm font-medium">Código de recuperação</p>
          <p className="mt-0.5 max-w-md text-xs leading-relaxed text-muted">
            {hasCode
              ? "Você já tem um código salvo. Gerar um novo invalida o antigo na hora."
              : "Sua conta ainda não tem código. Sem e-mail, ele é a única forma de trocar a senha se você esquecer."}
          </p>
        </div>
      </div>

      {state.error && <p className="text-xs text-danger">{state.error}</p>}
      {state.success && <p className="text-xs text-ok">{state.success}</p>}
      {state.code && <RecoveryCodeBox code={state.code} />}

      {!state.code && (
        <form action={action} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="field-label" htmlFor="recovery-password">
              Senha atual
            </label>
            <input
              id="recovery-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="field"
              placeholder="••••••••"
            />
          </div>
          <button className="btn btn-ghost" disabled={pending}>
            {pending && <Loader2 size={14} className="animate-spin" />}
            {hasCode ? "Gerar novo código" : "Gerar código"}
          </button>
        </form>
      )}

      {state.code && (
        <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">
          Anote agora. Ao sair desta página o código não aparece mais.
        </p>
      )}
    </div>
  );
}
