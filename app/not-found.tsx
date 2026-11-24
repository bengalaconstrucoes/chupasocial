import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <Logo />
      <h1 className="mt-4 text-3xl font-semibold">Essa página escapou</h1>
      <p className="max-w-sm text-sm text-muted">
        O endereço não existe ou o conteúdo foi removido. Volte para o feed e continue de onde
        parou.
      </p>
      <Link href="/" className="btn btn-primary mt-2">
        Voltar ao início
      </Link>
    </div>
  );
}
