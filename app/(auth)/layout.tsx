import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-surface p-12 lg:flex lg:flex-col lg:justify-between">
        <Logo />
        <div className="max-w-md">
          <p className="chip mb-5">Rede social independente</p>
          <h1 className="text-4xl font-semibold leading-[1.1]">
            Conversa boa tem <span className="text-accent">gosto próprio</span>.
          </h1>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-muted">
            Um feed cronológico de verdade, comunidades com assunto e mensagens que chegam na
            hora. Sem algoritmo decidindo o que você vê.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Feed cronológico e feed de quem você segue",
              "Comunidades com moderação e papéis",
              "Mensagens privadas com atualização em tempo real",
              "Perfis privados com solicitações de seguir",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span className="text-muted">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted">
          ChupaSocial · feito para conversar de verdade
        </p>
      </aside>

      <main className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <Link href="/" className="lg:hidden">
            <Logo />
          </Link>
          <ThemeToggle compact />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-14">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
