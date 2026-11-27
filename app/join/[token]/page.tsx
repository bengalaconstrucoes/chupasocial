import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Compass, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { JoinInviteButton } from "@/components/join-invite";
import { createClient } from "@/lib/supabase/server";
import { formatCount } from "@/lib/utils";

export const metadata: Metadata = { title: "Convite de comunidade" };

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/join/${token}`);

  const { data: community } = await supabase
    .from("communities")
    .select("id, slug, name, description, image_url, requires_approval, members:community_members(count)")
    .eq("invite_token", token)
    .maybeSingle();

  if (!community) notFound();

  const { data: membership } = await supabase
    .from("community_members")
    .select("status")
    .eq("community_id", community.id)
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <AppShell>
      <div className="px-4 py-10 sm:px-6">
        <div className="chupa-card mx-auto max-w-md p-6 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-accent-soft text-accent">
            {community.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={community.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Compass size={26} />
            )}
          </span>
          <h1 className="mt-3 text-lg font-semibold">{community.name}</h1>
          {community.description && (
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{community.description}</p>
          )}
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted">
            <Users size={12} /> {formatCount(Number((community as any).members?.[0]?.count ?? 0))} membros
          </p>

          <div className="mt-5 flex flex-col items-center gap-2">
            {membership ? (
              <>
                <p className="text-sm text-ok">
                  {membership.status === "pending"
                    ? "Seu pedido está aguardando aprovação."
                    : "Você já participa desta comunidade."}
                </p>
                <Link href={`/communities/${community.slug}`} className="btn btn-primary">
                  abrir comunidade
                </Link>
              </>
            ) : (
              <>
                <JoinInviteButton token={token} />
                {community.requires_approval && (
                  <p className="text-xs text-muted">Esta comunidade aprova novos membros manualmente.</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
