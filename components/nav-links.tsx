"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Bookmark,
  Compass,
  Home,
  Mail,
  Megaphone,
  Search,
  Sparkles,
  Settings,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavProps = {
  username: string;
  unreadNotifications: number;
  unreadMessages: number;
};

const baseItems = [
  { href: "/", label: "Início", icon: Home, exact: true },
  { href: "/search", label: "Buscar", icon: Search, exact: false },
  { href: "/communities", label: "Comunidades", icon: Users, exact: false },
  { href: "/notifications", label: "Notificações", icon: Bell, exact: false },
  { href: "/messages", label: "Mensagens", icon: Mail, exact: false },
  { href: "/avisos", label: "Avisos", icon: Megaphone, exact: false },
  { href: "/patches", label: "Novidades", icon: Sparkles, exact: false },
  { href: "/saved", label: "Salvos", icon: Bookmark, exact: false },
];

function isActive(pathname: string, href: string, exact: boolean) {
  if (href === "/") return exact ? pathname === "/" : pathname.startsWith("/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ username, unreadNotifications, unreadMessages }: NavProps) {
  const pathname = usePathname();

  const items = [
    ...baseItems,
    { href: `/u/${username}`, label: "Meu perfil", icon: User, exact: false },
    { href: "/settings", label: "Configurações", icon: Settings, exact: false },
  ];

  return (
    <nav aria-label="Navegação principal" className="mt-6 space-y-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href, item.exact);
        const badge =
          item.href === "/notifications"
            ? unreadNotifications
            : item.href === "/messages"
              ? unreadMessages
              : 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-medium transition-colors",
              active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <item.icon size={19} strokeWidth={active ? 2.4 : 2} />
            <span className="flex-1">{item.label}</span>
            {badge > 0 && (
              <span className="min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-[0.68rem] font-bold text-accent-ink">
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({ username, unreadNotifications, unreadMessages }: NavProps) {
  const pathname = usePathname();

  const items = [
    { href: "/", label: "Início", icon: Home },
    { href: "/search", label: "Buscar", icon: Search },
    { href: "/communities", label: "Comunidades", icon: Users },
    { href: "/notifications", label: "Alertas", icon: Bell, badge: unreadNotifications },
    { href: "/messages", label: "Mensagens", icon: Mail, badge: unreadMessages },
  ];

  return (
    <nav
      aria-label="Navegação"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {items.map((item) => {
          const active = isActive(pathname, item.href, item.href === "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-medium",
                active ? "text-accent" : "text-muted",
              )}
            >
              <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span>{item.label}</span>
              {(item.badge ?? 0) > 0 && (
                <span className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-surface" />
              )}
            </Link>
          );
        })}
        <Link
          href={`/u/${username}`}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-medium",
            pathname.startsWith("/u/") ? "text-accent" : "text-muted",
          )}
        >
          <User size={20} strokeWidth={2} />
          <span>Perfil</span>
        </Link>
      </div>
    </nav>
  );
}

export function ExploreShortcut() {
  return (
    <Link
      href="/search"
      className="flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
    >
      <Compass size={16} />
      Encontrar pessoas e assuntos
    </Link>
  );
}
