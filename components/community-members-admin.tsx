"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Shield, ShieldOff, UserMinus } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { removeMemberAction, updateMemberRoleAction } from "@/lib/actions/communities";
import type { Profile } from "@/lib/types";

type Member = { role: "owner" | "moderator" | "member"; joined_at: string; user: Profile };

export function CommunityMembersAdmin({
  communityId,
  members,
  viewerRole,
}: {
  communityId: string;
  members: Member[];
  viewerRole: "owner" | "moderator" | "member" | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function changeRole(userId: string, role: "moderator" | "member") {
    setError(null);
    startTransition(async () => {
      const result = await updateMemberRoleAction(communityId, userId, role);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function remove(userId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeMemberAction(communityId, userId);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  const canManageRoles = viewerRole === "owner";

  return (
    <div>
      {error && <p className="mb-2 text-xs text-danger">{error}</p>}
      {pending && <Loader2 size={14} className="mb-2 animate-spin text-muted" />}

      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {members.map((member) => (
          <li key={member.user.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
            <Avatar profile={member.user} size={36} />
            <div className="min-w-0 flex-1">
              <Link href={`/u/${member.user.username}`} className="block truncate text-sm font-semibold hover:underline">
                {member.user.display_name}
              </Link>
              <p className="truncate text-xs text-muted">
                @{member.user.username} · {member.role}
              </p>
            </div>

            {member.role !== "owner" && (
              <div className="flex items-center gap-1.5">
                {canManageRoles && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      changeRole(member.user.id, member.role === "moderator" ? "member" : "moderator")
                    }
                    className="btn btn-ghost !px-2.5 !py-1 text-[0.7rem]"
                  >
                    {member.role === "moderator" ? <ShieldOff size={12} /> : <Shield size={12} />}
                    {member.role === "moderator" ? "remover mod" : "tornar mod"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(member.user.id)}
                  className="btn btn-quiet !px-2 !py-1 text-[0.7rem] hover:text-danger"
                  aria-label={`Remover ${member.user.username}`}
                >
                  <UserMinus size={13} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
