"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, MailOpen, ShieldOff, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import {
  markFeedbackReadAction,
  resolveReportAction,
  setUserVerifiedAction,
} from "@/lib/actions/admin";
import { formatDate } from "@/lib/utils";

export type AdminReport = {
  id: string;
  target_type: "post" | "message" | "profile";
  target_id: string;
  reason: string;
  details: string | null;
  status: "open" | "reviewed" | "dismissed";
  created_at: string;
  reporter: { username: string; display_name: string } | null;
};

export type AdminUser = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  is_admin: boolean;
  created_at: string;
};

export type AdminFeedback = {
  id: string;
  mood: string;
  body: string;
  status: string;
  created_at: string;
  username: string;
};

const REASON_LABEL: Record<string, string> = {
  spam: "spam",
  harassment: "assédio",
  hate: "ódio",
  nudity: "nudez",
  violence: "violência",
  misinformation: "desinformação",
  other: "outro",
};

export function AdminPanel({
  reports: initialReports,
  users: initialUsers,
  feedback: initialFeedback,
}: {
  reports: AdminReport[];
  users: AdminUser[];
  feedback: AdminFeedback[];
}) {
  const router = useRouter();
  const [reports, setReports] = useState(initialReports);
  const [users, setUsers] = useState(initialUsers);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function verify(user: AdminUser) {
    setError(null);
    startTransition(async () => {
      const result = await setUserVerifiedAction(user.id, !user.is_verified);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id ? { ...item, is_verified: !item.is_verified } : item,
        ),
      );
      router.refresh();
    });
  }

  function resolve(report: AdminReport, status: "reviewed" | "dismissed") {
    setError(null);
    startTransition(async () => {
      const result = await resolveReportAction(report.id, status);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReports((current) =>
        current.map((item) => (item.id === report.id ? { ...item, status } : item)),
      );
      router.refresh();
    });
  }

  function readFeedback(item: AdminFeedback) {
    setError(null);
    startTransition(async () => {
      const result = await markFeedbackReadAction(item.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFeedback((current) =>
        current.map((row) => (row.id === item.id ? { ...row, status: "read" } : row)),
      );
    });
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-xs text-danger">{error}</p>}

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Denúncias abertas ({reports.filter((report) => report.status === "open").length})
        </h2>
        {reports.length === 0 ? (
          <p className="chupa-card p-4 text-xs text-muted">Nenhuma denúncia registrada.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {reports.map((report) => (
              <li key={report.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="chip !py-0.5">{REASON_LABEL[report.reason] ?? report.reason}</span>
                  <span>{report.target_type}</span>
                  {report.target_type === "post" && (
                    <Link
                      href={`/post/${report.target_id}`}
                      className="text-accent hover:underline"
                    >
                      ver conteúdo
                    </Link>
                  )}
                  <span className="ml-auto">{formatDate(report.created_at)}</span>
                </div>
                <p className="mt-1.5 text-sm">
                  Denunciado por{" "}
                  {report.reporter ? (
                    <Link
                      href={`/u/${report.reporter.username}`}
                      className="font-medium hover:underline"
                    >
                      @{report.reporter.username}
                    </Link>
                  ) : (
                    "conta removida"
                  )}
                  {report.details ? `: “${report.details}”` : ""}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {report.status === "open" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => resolve(report, "reviewed")}
                        disabled={pending}
                        className="btn btn-ghost !px-2.5 !py-1 text-[0.7rem]"
                      >
                        <BadgeCheck size={12} /> revisada
                      </button>
                      <button
                        type="button"
                        onClick={() => resolve(report, "dismissed")}
                        disabled={pending}
                        className="btn btn-quiet !px-2.5 !py-1 text-[0.7rem]"
                      >
                        <X size={12} /> dispensar
                      </button>
                    </>
                  ) : (
                    <span className="text-[0.7rem] text-muted">
                      {report.status === "reviewed" ? "revisada" : "dispensada"}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Contas recentes</h2>
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {users.map((user) => (
            <li key={user.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar
                profile={{ username: user.username, display_name: user.display_name, avatar_url: user.avatar_url }}
                size={34}
              />
              <div className="min-w-0 flex-1">
                <Link href={`/u/${user.username}`} className="block truncate text-sm font-medium hover:underline">
                  {user.display_name}
                  {user.is_admin && <span className="ml-1 text-[0.65rem] text-muted">admin</span>}
                </Link>
                <p className="truncate text-xs text-muted">@{user.username}</p>
              </div>
              <button
                type="button"
                onClick={() => verify(user)}
                disabled={pending}
                className="btn btn-ghost !px-2.5 !py-1 text-[0.7rem]"
              >
                {user.is_verified ? <ShieldOff size={12} /> : <BadgeCheck size={12} />}
                {user.is_verified ? "remover selo" : "verificar"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Caixinha de feedback</h2>
        {feedback.length === 0 ? (
          <p className="chupa-card p-4 text-xs text-muted">Nenhum recado ainda.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {feedback.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="chip !py-0.5">{item.mood}</span>
                  <span>@{item.username}</span>
                  <span className="ml-auto">{formatDate(item.created_at)}</span>
                </div>
                <p className="mt-1.5 text-sm">{item.body}</p>
                {item.status === "open" ? (
                  <button
                    type="button"
                    onClick={() => readFeedback(item)}
                    disabled={pending}
                    className="mt-2 inline-flex items-center gap-1 text-[0.7rem] text-accent hover:underline"
                  >
                    <MailOpen size={11} /> marcar como lido
                  </button>
                ) : (
                  <span className="mt-2 inline-block text-[0.7rem] text-muted">lido</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {pending && <Loader2 size={14} className="animate-spin text-muted" />}
    </div>
  );
}
