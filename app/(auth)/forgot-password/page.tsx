import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Recuperar senha</h1>
        <p className="mt-1 text-sm text-muted">
          Informe o e-mail da conta e enviaremos um link para você criar uma nova senha.
        </p>
      </div>
      <ForgotForm />
    </div>
  );
}
