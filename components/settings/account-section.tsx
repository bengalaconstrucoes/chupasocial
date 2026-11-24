"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Unlock } from "lucide-react";
import {
  deactivateAccountAction,
  deleteAccountAction,
  updatePrivacyAction,
} from "@/lib/actions/profile";
import { signOutAction } from "@/lib/actions/auth";

export function PrivacySection({ isPrivate }: { isPrivate: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(isPrivate);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggle() {
    const next = !value;
    setValue(next);
    startTransition(async () => {
      const result = await updatePrivacyAction(next);
      if (!result.ok) {
        setValue(!next);
        setMessage(result.error);
        return;
      }
      setMessage(result.message ?? null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-muted">{value ? <Lock size={17} /> : <Unlock size={17} />}</span>
        <div>
          <p className="text-sm font-medium">{value ? "Perfil privado" : "Perfil público"}</p>
          <p className="mt-0.5 max-w-sm text-xs text-muted">
            {value
              ? "Só seguidores aprovados veem suas publicações, seguidores e seguindo. Novos seguidores precisam de solicitação."
              : "Qualquer pessoa no ChupaSocial pode ver seu perfil e suas publicações."}
          </p>
          {message && <p className="mt-1 text-xs text-ok">{message}</p>}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={toggle}
        disabled={pending}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          value ? "bg-accent" : "bg-surface-2 border border-line"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all ${
            value ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export function AccountSection() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  return (
    <div className="space-y-4">
      {message && <p className="text-xs text-danger">{message}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Sair da conta</p>
          <p className="text-xs text-muted">Encerra a sessão neste dispositivo.</p>
        </div>
        <form action={signOutAction}>
          <button className="btn btn-ghost">Sair</button>
        </form>
      </div>

      <div className="border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Desativar conta</p>
            <p className="max-w-md text-xs text-muted">
              Seu perfil e publicações ficam ocultos. Entre novamente para reativar.
            </p>
          </div>
          {!confirmDeactivate ? (
            <button className="btn btn-ghost" onClick={() => setConfirmDeactivate(true)}>
              Desativar
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                className="btn btn-danger"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deactivateAccountAction();
                    if (result && !result.ok) setMessage(result.error);
                  })
                }
              >
                {pending && <Loader2 size={13} className="animate-spin" />} Confirmar
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirmDeactivate(false)}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line pt-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-danger">Excluir conta</p>
            <p className="max-w-md text-xs text-muted">
              Remove permanentemente seu perfil, publicações, comentários, mensagens e comunidades.
              Não há como desfazer.
            </p>
          </div>
          {!confirmDelete ? (
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              Excluir conta
            </button>
          ) : (
            <div className="w-full max-w-sm space-y-2">
              <label className="field-label" htmlFor="delete-confirmation">
                Digite EXCLUIR para confirmar
              </label>
              <input
                id="delete-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="field"
                placeholder="EXCLUIR"
              />
              <div className="flex gap-2">
                <button
                  className="btn btn-danger"
                  disabled={pending || confirmation.trim().toUpperCase() !== "EXCLUIR"}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteAccountAction(confirmation);
                      if (result && !result.ok) setMessage(result.error);
                    })
                  }
                >
                  {pending && <Loader2 size={13} className="animate-spin" />}
                  Excluir definitivamente
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setConfirmDelete(false);
                    setConfirmation("");
                  }}
                >
                  Cancelar
                </button>
              </div>
              <button
                type="button"
                onClick={() => router.refresh()}
                className="text-[0.7rem] text-muted hover:text-ink"
              >
                atualizar dados da conta
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
