import Link from "next/link";
import { ArrowRight, Bell, Lock, MessageSquare, Users } from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const features = [
  {
    icon: MessageSquare,
    title: "Feed cronológico",
    text: "O que você publica aparece na ordem em que aconteceu. Sem ranking invisível decidindo por você.",
  },
  {
    icon: Users,
    title: "Comunidades com assunto",
    text: "Crie espaços com nome, capa e moderadores. Publique para quem realmente quer ler sobre aquilo.",
  },
  {
    icon: Bell,
    title: "Notificações honestas",
    text: "Curtidas, comentários, respostas, novos seguidores e mensagens. Você escolhe o que abrir.",
  },
  {
    icon: Lock,
    title: "Privacidade de verdade",
    text: "Perfil privado com solicitações de seguir. As regras são aplicadas no banco, não só na tela.",
  },
];

export function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <Link href="/login" className="btn btn-quiet">
            Entrar
          </Link>
          <Link href="/signup" className="btn btn-primary">
            Criar conta
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:pt-20">
          <div>
            <p className="chip mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Rede social independente
            </p>
            <h1 className="max-w-xl text-[2.6rem] font-semibold leading-[1.04] sm:text-6xl">
              Conversa boa tem
              <br />
              <span className="text-accent">gosto próprio.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[1.05rem] leading-relaxed text-muted">
              ChupaSocial é uma rede social feita para publicar, seguir quem interessa, entrar em
              comunidades com assunto e conversar por mensagem. Tudo em um só lugar — e sem
              algoritmo no meio.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn btn-primary !px-6 !py-3 text-[0.95rem]">
                Criar minha conta
                <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="btn btn-ghost !px-6 !py-3 text-[0.95rem]">
                Já tenho conta
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted">
              Cadastro com usuário e senha · perfil privado opcional · sem anúncios
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
            <div className="chupa-panel rotate-[-1.5deg] p-4">
              <div className="flex items-center gap-2.5">
                <LogoMark className="h-9 w-9" />
                <div>
                  <p className="text-sm font-semibold">ChupaSocial</p>
                  <p className="text-[0.7rem] text-muted">feito para conversar de verdade</p>
                </div>
              </div>
              <div className="mt-4 space-y-2.5">
                <div className="rounded-lg border border-line bg-bg p-3">
                  <p className="text-[0.7rem] font-medium text-muted">Publicações · cronológico</p>
                  <p className="mt-1 text-sm">
                    Texto, imagens e comunidades. Na ordem em que as coisas acontecem.
                  </p>
                </div>
                <div className="rounded-lg border border-line bg-bg p-3">
                  <p className="text-[0.7rem] font-medium text-muted">Seguindo</p>
                  <p className="mt-1 text-sm">
                    Um feed só com quem você escolheu acompanhar.
                  </p>
                </div>
                <div className="rounded-lg border border-line bg-bg p-3">
                  <p className="text-[0.7rem] font-medium text-muted">Mensagens</p>
                  <p className="mt-1 text-sm">Conversas privadas que atualizam na hora.</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[0.7rem] text-muted">
                <span>Perfis privados</span>
                <span className="chip !py-0.5">com solicitação</span>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-4 -left-3 hidden h-16 w-16 rotate-12 rounded-2xl bg-accent-soft sm:block" />
          </div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-px sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="p-6">
                <feature.icon size={20} className="text-accent" />
                <h2 className="mt-3 text-base font-semibold">{feature.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-line bg-surface p-7 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-semibold">Comece pelo seu arroba.</h2>
              <p className="mt-1.5 max-w-md text-sm text-muted">
                Crie a conta, escolha o nome de usuário e publique. Leva menos de
                um minuto.
              </p>
            </div>
            <Link href="/signup" className="btn btn-primary !px-6 !py-3">
              Criar conta grátis
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} ChupaSocial</span>
          <span>Feito para conversar de verdade.</span>
        </div>
      </footer>
    </div>
  );
}
