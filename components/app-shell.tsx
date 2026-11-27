import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { CallProvider } from "@/components/call/call-provider";
import { Logo } from "@/components/logo";
import { MobileNav, SidebarNav } from "@/components/nav-links";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";
import { signOutAction } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import {
  fetchUnreadMessageCount,
  fetchUnreadNotificationCount,
} from "@/lib/queries";
import type { Profile } from "@/lib/types";

export async function AppShell({
  children,
  aside,
  header,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  header?: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?erro=sessao");

  const [{ data: profileData }, unreadNotifications, unreadMessages] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    fetchUnreadNotificationCount(user.id),
    fetchUnreadMessageCount(user.id),
  ]);

  const profile = profileData as Profile | null;
  if (!profile) redirect("/login?erro=sessao");

  const shell = (
    <div className="mx-auto flex w-full max-w-[1120px] gap-6 px-0 sm:px-4 lg:px-6">
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col justify-between py-6 lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
          <Link href="/" aria-label="ChupaSocial, início">
            <Logo />
          </Link>
          <SidebarNav
            username={profile.username}
            unreadNotifications={unreadNotifications}
            unreadMessages={unreadMessages}
            isAdmin={Boolean(profile.is_admin)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2.5">
            <Avatar profile={profile} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{profile.display_name}</p>
              <p className="truncate text-xs text-muted">@{profile.username}</p>
            </div>
            <Link
              href="/settings"
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
              aria-label="Configurações"
            >
              <Settings size={16} />
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-danger"
                aria-label="Sair da conta"
                title="Sair"
              >
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 pb-20 lg:pb-10">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/85 px-4 py-3 backdrop-blur sm:px-0 lg:hidden">
          <Link href="/" aria-label="Início">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/patches"
              className="btn btn-quiet h-9 w-9 !p-0"
              aria-label="Patches e avisos"
              title="Patches e avisos"
            >
              <Sparkles size={17} />
            </Link>
            {profile.is_admin && (
              <Link
                href="/admin"
                className="btn btn-quiet h-9 w-9 !p-0"
                aria-label="Administração"
                title="Administração"
              >
                <ShieldCheck size={17} />
              </Link>
            )}
            <form action={signOutAction}>
              <button
                type="submit"
                className="btn btn-quiet h-9 w-9 !p-0"
                aria-label="Sair da conta"
              >
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </header>

        {header}
        {children}
      </div>

      {aside && (
        <aside className="sticky top-0 hidden h-screen w-[300px] shrink-0 space-y-4 overflow-y-auto py-6 xl:block">
          {aside}
        </aside>
      )}

      <MobileNav
        username={profile.username}
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
        isAdmin={Boolean(profile.is_admin)}
      />
    </div>
  );

  return (
    <CallProvider viewer={profile}>
      <PresenceHeartbeat />
      {shell}
    </CallProvider>
  );
}
