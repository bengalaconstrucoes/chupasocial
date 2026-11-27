"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";
import {
  recoverPasswordAction,
  signInAction,
  signUpAction,
  type AuthState,
} from "@/lib/actions/auth";

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

function PasswordField({
  name = "password",
  label = "Senha",
  autoComplete = "current-password",
}: {
  name?: string;
  label?: string;
  autoComplete?: string;
}) {
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
          autoComplete={autoComplete}
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
  initialIdentifier = "",
}: {
  next?: string;
  notice?: string;
  initialIdentifier?: string;
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
        <label className="field-label" htmlFor="identifier">
          Usuário ou e-mail
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={initialIdentifier}
          className="field"
          placeholder="seu_arroba"
        />
        <p className="mt-1 text-xs text-muted">
          Contas criadas antes da mudança entram com o e-mail.
        </p>
      </div>
      <PasswordField />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-accent hover:underline">
          Esqueci minha senha
        </Link>
      </div>
      <Submit label="Entrar" pending={pending} />
    </form>
  );
}

export function SignupForm({
  captcha,
}: {
  captcha: { question: string; nonce: string; token: string };
}) {
  const [state, action, pending] = useActionState(signUpAction, initial);
  const [username, setUsername] = useState("");
  const startedAt = useRef(Date.now());
  const elapsedRef = useRef<HTMLInputElement>(null);

  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={() => {
        if (elapsedRef.current) {
          elapsedRef.current.value = String(Date.now() - startedAt.current);
        }
      }}
    >
      <Alert state={state} />

      <div className="flex gap-2.5 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-muted" />
        <p className="text-xs leading-relaxed text-muted">
          <span className="font-medium text-ink">Opa, chupas: login por e-mail desativado.</span>{" "}
          Enviar e-mail custa dinheiro e ainda não temos verba pro serviço, então o cadastro é só
          com nome de usuário e senha. No fim você recebe um{" "}
          <span className="font-medium text-ink">código secreto</span> — guarde ele, é com ele que
          você troca a senha se esquecer.
        </p>
      </div>

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
            onChange={(event) =>
              setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
            }
            className="field pl-8"
            placeholder="seu_arroba"
          />
        </div>
        <p className="mt-1 text-xs text-muted">Letras, números e _ (3 a 20 caracteres).</p>
      </div>
      <PasswordField autoComplete="new-password" />

      {/* Honeypot: humano não vê nem preenche. */}
      <div className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor="company">Empresa</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <input ref={elapsedRef} type="hidden" name="elapsed_ms" defaultValue="0" />
      <input type="hidden" name="captcha_nonce" value={captcha.nonce} />
      <input type="hidden" name="captcha_token" value={captcha.token} />

      <div className="rounded-lg border border-line bg-surface-2 p-3">
        <label className="field-label" htmlFor="captcha_answer">
          Verificação anti-bot
        </label>
        <div className="flex items-center gap-2">
          <span className="chip shrink-0 !py-1.5 font-mono text-sm text-ink">
            {captcha.question}
          </span>
          <input
            id="captcha_answer"
            name="captcha_answer"
            type="text"
            inputMode="numeric"
            required
            autoComplete="off"
            maxLength={2}
            className="field max-w-[5.5rem] text-center"
            placeholder="?"
            aria-describedby="captcha-hint"
          />
          <p id="captcha-hint" className="text-[0.68rem] leading-snug text-muted">
            Resolva a conta para confirmar que você é gente.
          </p>
        </div>
      </div>

      <Submit label="Criar conta" pending={pending} />
      <p className="text-center text-xs text-muted">
        Ao criar a conta você concorda em manter o respeito nas conversas. Sem spam, sem
        assédio.
      </p>
    </form>
  );
}

export function RecoveryForm() {
  const [state, action, pending] = useActionState(recoverPasswordAction, initial);

  return (
    <form action={action} className="space-y-4">
      <Alert state={state} />
      <div>
        <label className="field-label" htmlFor="username">
          Nome de usuário
        </label>
        <input
          id="username"
          name="username"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className="field"
          placeholder="seu_arroba"
        />
      </div>
      <div>
        <label className="field-label" htmlFor="code">
          Código de recuperação
        </label>
        <input
          id="code"
          name="code"
          required
          autoComplete="off"
          spellCheck={false}
          className="field font-mono tracking-wider"
          placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
        />
        <p className="mt-1 text-xs text-muted">
          O código que aparece uma única vez (no cadastro ou em Configurações → Conta).
        </p>
      </div>
      <PasswordField label="Nova senha" autoComplete="new-password" />
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
      <Submit label="Trocar senha" pending={pending} />
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-accent hover:underline">
          Voltar para o login
        </Link>
      </p>
    </form>
  );
}
