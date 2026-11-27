import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AdminPanel } from "@/components/admin-panel";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Administração" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const rawQuery = (await searchParams).q?.trim().replace(/^@/, "") ?? "";
  const query = rawQuery.replace(/[%,()*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
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

  const [{ data: reportRows }, { data: feedbackRows }, { data: flagRows }] = await Promise.all([
    supabase
      .from("reports")
      .select(
        "id, reporter_id, target_type, target_id, reason, details, status, created_at, evidence_paths",
      )
      .order("created_at", { ascending: false })
      .limit(40),
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

  let userQuery = supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, is_verified, is_admin, muted_until, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (query) {
    userQuery = userQuery.or(`username.ilike.%${query}%,display_name.ilike.%${query}%`);
  }

  const { data: userRows } = await userQuery;

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

  // Contexto para a moderação julgar: autor denunciado e prints anexados.
  const reports = (reportRows ?? []) as any[];
  const postTargetIds = [...new Set(reports.filter((row) => row.target_type === "post").map((row) => row.target_id as string))];
  const profileTargetIds = [...new Set(reports.filter((row) => row.target_type === "profile").map((row) => row.target_id as string))];

  const [{ data: reportedPosts }, { data: reportedProfiles }] = await Promise.all([
    postTargetIds.length > 0
      ? supabase
          .from("posts")
          .select("id, content, author:profiles!posts_author_id_fkey(id, username, display_name)")
          .in("id", postTargetIds)
      : Promise.resolve({ data: [] as any[] }),
    profileTargetIds.length > 0
      ? supabase.from("profiles").select("id, username, display_name").in("id", profileTargetIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const postMap = new Map<string, any>((reportedPosts ?? []).map((row: any) => [row.id, row]));
  const profileMap = new Map<string, any>(
    (reportedProfiles ?? []).map((row: any) => [row.id, row]),
  );

  const evidencePaths = [
    ...new Set(reports.flatMap((row) => ((row.evidence_paths ?? []) as string[]))),
  ];
  const signedMap = new Map<string, string>();
  if (evidencePaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("report-evidence")
      .createSignedUrls(evidencePaths, 3600);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) signedMap.set(item.path, item.signedUrl);
    }
  }

  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <h1 className="inline-flex items-center gap-1.5 text-base font-semibold">
          <ShieldCheck size={16} className="text-accent" /> Administração
        </h1>
        <p className="text-xs text-muted">
          Denúncias, selo de verificado, acesso de administrador e recados da caixinha.
        </p>
      </div>

      <div className="px-4 py-5 sm:px-5">
        <AdminPanel
          reports={reports.map((row: any) => {
            const post = postMap.get(row.target_id);
            const targetAuthor =
              row.target_type === "post"
                ? post?.author ?? null
                : row.target_type === "profile"
                  ? profileMap.get(row.target_id) ?? null
                  : null;

            return {
              id: row.id,
              target_type: row.target_type,
              target_id: row.target_id,
              reason: row.reason,
              details: row.details,
              status: row.status,
              created_at: row.created_at,
              reporter: peopleMap.get(row.reporter_id) ?? null,
              target_author: targetAuthor,
              target_excerpt: row.target_type === "post" ? post?.content ?? null : null,
              evidence_urls: ((row.evidence_paths ?? []) as string[])
                .map((path) => signedMap.get(path))
                .filter((url): url is string => Boolean(url)),
            };
          })}
          users={(userRows ?? []) as any}
          viewerId={user.id}
          searchQuery={query}
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
