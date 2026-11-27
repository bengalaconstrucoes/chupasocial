import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/forms";
import { createCaptcha } from "@/lib/captcha";

export const metadata: Metadata = { title: "Criar conta" };

// O desafio anti-bot precisa ser sorteado a cada visita, nunca no build.
export const dynamic = "force-dynamic";

export default function SignupPage() {
  const captcha = createCaptcha();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Criar sua conta</h1>
        <p className="mt-1 text-sm text-muted">
          Escolha seu arroba e uma senha. Sem e-mail, sem confirmação: entra direto.
        </p>
      </div>
      <SignupForm captcha={captcha} />
      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
