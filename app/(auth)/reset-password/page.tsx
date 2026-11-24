import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Nova senha" };

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Criar nova senha</h1>
        <p className="mt-1 text-sm text-muted">
          Escolha uma senha com pelo menos 8 caracteres. Você continuará conectado após salvar.
        </p>
      </div>
      <ResetForm />
    </div>
  );
}
