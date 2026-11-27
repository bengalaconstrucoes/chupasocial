import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AdminPanel } from "@/components/admin-panel";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Administração" };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) notFound();

  const [{ data: reportRows }, { data: userRows }, { data: feedbackRows }, { data: flagRows }] =
    await Promise.all([
    supabase
      .from("reports")
      .select("id, reporter_id, target_type, target_id, reason, details, status, created_at")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_verified, is_admin, muted_until, created_at")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("feedback")
        .select("id, user_id, mood, body, status, created_at")
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("moderation_flags")
        .select(
          "id, post_id, reason, severity, created_at, post:posts(id, content, hidden_at, author:profiles!posts_author_id_fkey(username, display_name))",
        )
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  const peopleIds = [
    ...new Set([
      ...(reportRows ?? []).map((row: any) => row.reporter_id as string),
      ...(feedbackRows ?? []).map((row: any) => row.user_id as string),
    ]),
  ].filter(Boolean);

  const { data: people } =
    peopleIds.length > 0
      ? await supabase.from("profiles").select("id, username, display_name").in("id", peopleIds)
      : { data: [] as any[] };

  const peopleMap = new Map<string, { username: string; display_name: string }>(
    (people ?? []).map((row: any) => [row.id, { username: row.username, display_name: row.display_name }]),
  );

  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <h1 className="inline-flex items-center gap-1.5 text-base font-semibold">
          <ShieldCheck size={16} className="text-accent" /> Administração
        </h1>
        <p className="text-xs text-muted">Denúncias, verificação de contas e recados da caixinha.</p>
      </div>

      <div className="px-4 py-5 sm:px-5">
        <AdminPanel
          reports={(reportRows ?? []).map((row: any) => ({
            id: row.id,
            target_type: row.target_type,
            target_id: row.target_id,
            reason: row.reason,
            details: row.details,
            status: row.status,
            created_at: row.created_at,
            reporter: peopleMap.get(row.reporter_id) ?? null,
          }))}
          users={(userRows ?? []) as any}
          feedback={(feedbackRows ?? []).map((row: any) => ({
            id: row.id,
            mood: row.mood,
            body: row.body,
            status: row.status,
            created_at: row.created_at,
            username: peopleMap.get(row.user_id)?.username ?? "removido",
          }))}
          flags={(flagRows ?? []).map((row: any) => ({
            id: row.id,
            post_id: row.post_id,
            reason: row.reason,
            severity: row.severity,
            created_at: row.created_at,
            hidden: Boolean(row.post?.hidden_at),
            content: (row.post?.content as string | null) ?? "",
            author: (row.post?.author as { username: string; display_name: string } | null) ?? null,
          }))}
        />
      </div>
    </AppShell>
  );
}
