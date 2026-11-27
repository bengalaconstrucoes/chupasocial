import type { Metadata } from "next";
import { RecoveryForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Recuperar senha</h1>
        <p className="mt-1 text-sm text-muted">
          Entre com seu usuário e o código secreto que você guardou no cadastro para definir uma
          nova senha.
        </p>
      </div>
      <RecoveryForm />
    </div>
  );
}
