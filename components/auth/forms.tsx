"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  requestPasswordResetAction,
  resendConfirmationAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
  type AuthState,
} from "@/lib/actions/auth";
import { usernameFromEmail } from "@/lib/utils";

const initial: AuthState = {};

function Alert({ state }: { state: AuthState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-3 py-2 text-sm text-danger"
      >
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p
        role="status"
        className="rounded-lg border border-[color-mix(in_srgb,var(--ok)_35%,transparent)] bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] px-3 py-2 text-sm text-ok"
      >
        {state.success}
      </p>
    );
  }
  return null;
}

function PasswordField({ name = "password", label = "Senha" }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={8}
          autoComplete={name === "confirm" ? "new-password" : "current-password"}
          className="field pr-11"
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted hover:text-ink"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function Submit({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending && <Loader2 size={16} className="animate-spin" />}
      {pending ? "Enviando…" : label}
    </button>
  );
}

export function LoginForm({
  next = "/",
  notice,
  initialEmail = "",
}: {
  next?: string;
  notice?: string;
  initialEmail?: string;
}) {
  const [state, action, pending] = useActionState(signInAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {notice && (
        <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-muted">
          {notice}
        </p>
      )}
      <Alert state={state} />
      <div>
        <label className="field-label" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={initialEmail}
          className="field"
          placeholder="voce@exemplo.com"
        />
      </div>
      <PasswordField />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-accent hover:underline">
          Esqueci minha senha
        </Link>
      </div>
      <Submit label="Entrar" pending={pending} />
      <ResendConfirmation />
    </form>
  );
}

function ResendConfirmation() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(resendConfirmationAction, initial);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-center text-xs text-muted hover:text-ink"
      >
        Não recebeu o e-mail de confirmação? Reenviar
      </button>
    );
  }

  return (
    <form action={action} className="space-y-2 rounded-lg border border-line p-3">
      <Alert state={state} />
      <input
        name="email"
        type="email"
        required
        placeholder="E-mail da conta"
        className="field text-sm"
      />
      <button className="btn btn-ghost w-full" disabled={pending}>
        {pending ? "Reenviando…" : "Reenviar confirmação"}
      </button>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signUpAction, initial);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [touchedUsername, setTouchedUsername] = useState(false);

  function suggest(handle: string) {
    if (touchedUsername) return;
    setUsername(usernameFromEmail(handle).slice(0, 20));
  }

  return (
    <form action={action} className="space-y-4">
      <Alert state={state} />
      <div>
        <label className="field-label" htmlFor="display_name">
          Nome
        </label>
        <input
          id="display_name"
          name="display_name"
          required
          maxLength={50}
          autoComplete="name"
          className="field"
          placeholder="Como quer ser chamado"
        />
      </div>
      <div>
        <label className="field-label" htmlFor="username">
          Nome de usuário
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
            @
          </span>
          <input
            id="username"
            name="username"
            required
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_]{3,20}"
            value={username}
            onChange={(event) => {
              setTouchedUsername(true);
              setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
            }}
            className="field pl-8"
            placeholder="seu_arroba"
          />
        </div>
        <p className="mt-1 text-xs text-muted">Letras, números e _ (3 a 20 caracteres).</p>
      </div>
      <div>
        <label className="field-label" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            suggest(event.target.value);
          }}
          className="field"
          placeholder="voce@exemplo.com"
        />
      </div>
      <PasswordField />
      <Submit label="Criar conta" pending={pending} />
      <p className="text-center text-xs text-muted">
        Ao criar a conta você concorda em manter o respeito nas conversas. Sem spam, sem
        assédio.
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initial);
  return (
    <form action={action} className="space-y-4">
      <Alert state={state} />
      <div>
        <label className="field-label" htmlFor="email">
          E-mail da conta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="field"
          placeholder="voce@exemplo.com"
        />
      </div>
      <Submit label="Enviar link de recuperação" pending={pending} />
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-accent hover:underline">
          Voltar para o login
        </Link>
      </p>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, initial);
  return (
    <form action={action} className="space-y-4">
      <Alert state={state} />
      <PasswordField />
      <div>
        <label className="field-label" htmlFor="confirm">
          Confirmar nova senha
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="field"
          placeholder="••••••••"
        />
      </div>
      <Submit label="Salvar nova senha" pending={pending} />
    </form>
  );
}
