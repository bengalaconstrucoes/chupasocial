import Link from "next/link";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Criar sua conta</h1>
        <p className="mt-1 text-sm text-muted">
          Escolha seu arroba, confirme o e-mail e comece a publicar.
        </p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
