import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LiveRoom } from "@/components/live-room";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Sala ao vivo" };

export default async function LiveRoomPage({
  params,
}: {
  params: Promise<{ slug: string; roomId: string }>;
}) {
  const { slug, roomId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/communities/${slug}/rooms/${roomId}`);

  const { data: community } = await supabase
    .from("communities")
    .select("id, slug, name")
    .ilike("slug", slug)
    .maybeSingle();
  if (!community) notFound();

  const { data: room } = await supabase
    .from("live_rooms")
    .select("id, title, status, host_id, community_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room || room.community_id !== community.id) notFound();

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profileData) redirect("/login?erro=sessao");

  const viewer = profileData as Profile;

  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-4 py-2.5 sm:px-5">
        <Link
          href={`/communities/${community.slug}?tab=salas`}
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
        >
          <ArrowLeft size={14} /> {community.name}
        </Link>
      </div>

      <LiveRoom
        roomId={room.id}
        title={room.title}
        communitySlug={community.slug}
        viewer={viewer}
        isHost={room.host_id === viewer.id}
        isLive={room.status === "live"}
      />
    </AppShell>
  );
}
