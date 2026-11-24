import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/forms";
import { safeNext } from "@/lib/utils";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; aviso?: string; erro?: string; email?: string }>;
}) {
  const params = await searchParams;
  const notice =
    params.aviso === "confirme"
      ? "Conta criada. Enviamos um link de confirmação para o seu e-mail — confirme para entrar."
      : params.erro === "link-invalido"
        ? "O link expirou ou já foi usado. Solicite um novo e-mail."
        : params.erro === "sessao"
          ? "Sua sessão expirou. Entre novamente."
          : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Entrar no ChupaSocial</h1>
        <p className="mt-1 text-sm text-muted">
          Bom te ver de volta. Entre para continuar a conversa.
        </p>
      </div>
      <LoginForm
        next={safeNext(params.next)}
        notice={notice}
        initialEmail={params.email ?? ""}
      />
      <p className="text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
