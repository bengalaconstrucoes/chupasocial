import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { RecoveryCodeBox } from "@/components/copy-code";
import { createClient } from "@/lib/supabase/server";
import { dismissRecoveryCodeAction } from "@/lib/actions/auth";
import { RECOVERY_CODE_COOKIE } from "@/lib/account-recovery";

export const metadata: Metadata = { title: "Guarde seu código" };

export default async function AccountCreatedPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const jar = await cookies();
  const code = jar.get(RECOVERY_CODE_COOKIE)?.value;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <Logo />

        <div className="chupa-card space-y-4 p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-accent">
              <KeyRound size={17} />
            </span>
            <div>
              <h1 className="text-lg font-semibold">Conta criada!</h1>
              <p className="text-xs text-muted">Última etapa: guardar seu código.</p>
            </div>
          </div>

          {code ? (
            <>
              <p className="text-sm leading-relaxed text-muted">
                Este é o seu <span className="font-medium text-ink">código secreto</span>. É a
                única vez que ele aparece. Se você esquecer a senha, é com ele que você recupera a
                conta — então salve num lugar seguro (gerenciador de senhas, bloco de notas, papel).
              </p>
              <RecoveryCodeBox code={code} />
              <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">
                Ninguém do ChupaSocial consegue ver esse código nem recuperá-lo por você. Sem e-mail,
                ele é a sua única chave de volta.
              </p>
            </>
          ) : (
            <p className="rounded-lg border border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-3 py-2 text-sm text-danger">
              {params.erro === "codigo"
                ? "Sua conta foi criada, mas não conseguimos gerar o código agora. Gere um em Configurações → Conta."
                : "O código já foi exibido e não fica salvo aqui. Se precisar de um novo, gere em Configurações → Conta."}
            </p>
          )}

          <form action={dismissRecoveryCodeAction}>
            <button className="btn btn-primary w-full">
              {code ? "Já salvei, continuar" : "Continuar"}
            </button>
          </form>

          <p className="text-center text-xs text-muted">
            Dá para gerar um código novo quando quiser em{" "}
            <Link href="/settings" className="text-accent hover:underline">
              Configurações
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
