import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CommunityForm } from "@/components/community-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nova comunidade" };

export default async function NewCommunityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/communities/new");

  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <Link href="/communities" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
          <ArrowLeft size={16} /> Comunidades
        </Link>
        <h1 className="mt-2 text-base font-semibold">Criar comunidade</h1>
      </div>

      <div className="px-4 py-5 sm:px-5">
        <div className="chupa-card p-4 sm:p-5">
          <CommunityForm mode="create" userId={user.id} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Você entra automaticamente como dono e pode nomear moderadores depois.
        </p>
      </div>
    </AppShell>
  );
}
