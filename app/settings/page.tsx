import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProfileForm } from "@/components/settings/profile-form";
import { AccountSection, PrivacySection } from "@/components/settings/account-section";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings");

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!data) redirect("/login?erro=sessao");
  const profile = data as Profile;

  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <h1 className="text-base font-semibold">Configurações</h1>
        <p className="text-xs text-muted">Perfil, privacidade e conta.</p>
      </div>

      <div className="space-y-6 px-4 py-5 sm:px-5">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Perfil</h2>
            <Link
              href={`/u/${profile.username}`}
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              ver perfil público <ExternalLink size={11} />
            </Link>
          </div>
          <div className="chupa-card p-4 sm:p-5">
            <ProfileForm profile={profile} />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Privacidade</h2>
          <div className="chupa-card p-4 sm:p-5">
            <PrivacySection isPrivate={profile.is_private} />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Conta</h2>
          <div className="chupa-card space-y-4 p-4 text-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted">E-mail</p>
                <p className="font-medium">{user.email}</p>
              </div>
              <p className="text-xs text-muted">Membro desde {formatDate(profile.created_at)}</p>
            </div>
            <div className="border-t border-line pt-4">
              <Link href="/forgot-password" className="text-sm text-accent hover:underline">
                Alterar senha por e-mail
              </Link>
            </div>
            <div className="border-t border-line pt-4">
              <AccountSection />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
