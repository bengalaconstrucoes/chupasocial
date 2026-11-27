"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Ban,
  CalendarClock,
  EyeOff,
  Loader2,
  MailOpen,
  Search,
  ShieldCheck,
  ShieldOff,
  VolumeX,
  X,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import {
  banUserAction,
  markFeedbackReadAction,
  resolveReportAction,
  setPostHiddenAction,
  setUserAdminAction,
  setUserMutedAction,
  setUserVerifiedAction,
  suspendUserAction,
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
  target_author?: { id: string; username: string; display_name: string } | null;
  target_excerpt?: string | null;
  evidence_urls?: string[];
};

export type AdminUser = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  is_admin: boolean;
  muted_until?: string | null;
  created_at: string;
};

export type AdminFlag = {
  id: string;
  post_id: string;
  reason: string;
  severity: string;
  created_at: string;
  hidden: boolean;
  content: string;
  author: { username: string; display_name: string } | null;
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

const MUTE_OPTIONS = [
  { value: 60, label: "1 hora" },
  { value: 1440, label: "24 horas" },
  { value: 10080, label: "7 dias" },
];

const SUSPEND_OPTIONS = [
  { value: 1, label: "1 dia" },
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
];

function ReportRow({
  report,
  pending,
  onResolve,
  onMute,
  onSuspend,
  onBan,
}: {
  report: AdminReport;
  pending: boolean;
  onResolve: (report: AdminReport, status: "reviewed" | "dismissed") => void;
  onMute: (userId: string, minutes: number) => void;
  onSuspend: (userId: string, days: number) => void;
  onBan: (userId: string) => void;
}) {
  const [muteMinutes, setMuteMinutes] = useState(1440);
  const [suspendDays, setSuspendDays] = useState(7);
  const [confirmBan, setConfirmBan] = useState(false);
  const author = report.target_author ?? null;
  const targetLink =
    report.target_type === "post"
      ? `/post/${report.target_id}`
      : author
        ? `/u/${author.username}`
        : null;

  return (
    <li className="chupa-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="chip !py-0.5">{REASON_LABEL[report.reason] ?? report.reason}</span>
        <span>{report.target_type === "post" ? "publicação" : report.target_type === "profile" ? "perfil" : "mensagem"}</span>
        {targetLink && (
          <Link href={targetLink} className="text-accent hover:underline">
            ver conteúdo
          </Link>
        )}
        <span className="ml-auto">{formatDate(report.created_at)}</span>
      </div>

      {author && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-muted">denunciado:</span>
          <Link href={`/u/${author.username}`} className="font-semibold hover:underline">
            {author.display_name}
          </Link>
          <span className="text-xs text-muted">@{author.username}</span>
        </p>
      )}

      {report.target_excerpt && (
        <p className="mt-1 line-clamp-2 rounded-lg border border-line bg-surface-2/60 px-2.5 py-1.5 text-[0.8rem] text-muted">
          {report.target_excerpt}
        </p>
      )}

      {report.details && (
        <p className="mt-1.5 text-sm">
          <span className="text-muted">justificativa: </span>“{report.details}”
        </p>
      )}

      {(report.evidence_urls ?? []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(report.evidence_urls ?? []).map((url, index) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              title="Abrir print"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Print enviado ${index + 1}`}
                className="h-16 w-16 rounded-lg border border-line object-cover transition-transform hover:scale-105"
              />
            </a>
          ))}
        </div>
      )}

      <p className="mt-1.5 text-[0.7rem] text-muted">
        denunciado por{" "}
        {report.reporter ? (
          <Link href={`/u/${report.reporter.username}`} className="hover:underline">
            @{report.reporter.username}
          </Link>
        ) : (
          "conta removida"
        )}
      </p>

      {author && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
          <select
            value={muteMinutes}
            onChange={(event) => setMuteMinutes(Number(event.target.value))}
            aria-label="Duração do silêncio"
            className="rounded-lg border border-line bg-surface px-2 py-1 text-[0.7rem]"
          >
            {MUTE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onMute(author.id, muteMinutes)}
            disabled={pending}
            className="btn btn-ghost !px-2.5 !py-1 text-[0.7rem]"
          >
            <VolumeX size={12} /> silenciar
          </button>

          <select
            value={suspendDays}
            onChange={(event) => setSuspendDays(Number(event.target.value))}
            aria-label="Duração da suspensão"
            className="rounded-lg border border-line bg-surface px-2 py-1 text-[0.7rem]"
          >
            {SUSPEND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onSuspend(author.id, suspendDays)}
            disabled={pending}
            className="btn btn-ghost !px-2.5 !py-1 text-[0.7rem]"
            title="Suspender: a pessoa lê, mas não publica"
          >
            <CalendarClock size={12} /> suspender
          </button>

          {confirmBan ? (
            <span className="flex items-center gap-1.5 rounded-lg border border-danger/40 px-2 py-1 text-[0.7rem]">
              <span>excluir a conta de @{author.username}?</span>
              <button
                type="button"
                onClick={() => onBan(author.id)}
                disabled={pending}
                className="font-semibold text-danger hover:underline"
              >
                confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirmBan(false)}
                className="text-muted hover:text-ink"
              >
                cancelar
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmBan(true)}
              disabled={pending}
              className="btn btn-quiet ml-auto !px-2.5 !py-1 text-[0.7rem] text-danger"
              title="Banir: exclui a conta e o conteúdo"
            >
              <Ban size={12} /> banir
            </button>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        {report.status === "open" ? (
          <>
            <button
              type="button"
              onClick={() => onResolve(report, "reviewed")}
              disabled={pending}
              className="btn btn-ghost !px-2.5 !py-1 text-[0.7rem]"
            >
              <BadgeCheck size={12} /> revisada
            </button>
            <button
              type="button"
              onClick={() => onResolve(report, "dismissed")}
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
  );
}

export function AdminPanel({
  reports: initialReports,
  users: initialUsers,
  feedback: initialFeedback,
  flags: initialFlags = [],
  viewerId,
  searchQuery = "",
}: {
  reports: AdminReport[];
  users: AdminUser[];
  feedback: AdminFeedback[];
  flags?: AdminFlag[];
  viewerId: string;
  searchQuery?: string;
}) {
  const router = useRouter();
  const [reports, setReports] = useState(initialReports);
  const [users, setUsers] = useState(initialUsers);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [flags, setFlags] = useState(initialFlags);
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

  function toggleAdmin(user: AdminUser) {
    setError(null);
    startTransition(async () => {
      const result = await setUserAdminAction(user.id, !user.is_admin);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id ? { ...item, is_admin: !item.is_admin } : item,
        ),
      );
      router.refresh();
    });
  }

  function muteReported(userId: string, minutes: number) {
    setError(null);
    startTransition(async () => {
      const result = await setUserMutedAction(userId, minutes);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function suspendReported(userId: string, days: number) {
    setError(null);
    startTransition(async () => {
      const result = await suspendUserAction(userId, days);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function banReported(userId: string) {
    setError(null);
    startTransition(async () => {
      const result = await banUserAction(userId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
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

  function toggleHidden(flag: AdminFlag) {
    setError(null);
    startTransition(async () => {
      const result = await setPostHiddenAction(flag.post_id, !flag.hidden, flag.reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const hidden = !flag.hidden;
      setFlags((current) =>
        current.map((item) =>
          item.post_id === flag.post_id ? { ...item, hidden } : item,
        ),
      );
      router.refresh();
    });
  }

  function toggleMute(user: AdminUser) {
    setError(null);
    const muted = Boolean(
      user.muted_until && new Date(user.muted_until).getTime() > Date.now(),
    );
    startTransition(async () => {
      const result = await setUserMutedAction(user.id, muted ? 0 : 1440);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? {
                ...item,
                muted_until: muted
                  ? null
                  : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              }
            : item,
        ),
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
          Moderação — denúncias abertas ({reports.filter((report) => report.status === "open").length})
        </h2>
        {reports.length === 0 ? (
          <p className="chupa-card p-4 text-xs text-muted">Nenhuma denúncia registrada.</p>
        ) : (
          <ul className="space-y-3">
            {reports.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                pending={pending}
                onResolve={resolve}
                onMute={muteReported}
                onSuspend={suspendReported}
                onBan={banReported}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Fila de moderação ({flags.length})
        </h2>
        {flags.length === 0 ? (
          <p className="chupa-card p-4 text-xs text-muted">
            Nada sinalizado automaticamente. A moderação está em dia.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {flags.map((flag) => (
              <li key={flag.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span
                    className={
                      flag.severity === "high"
                        ? "chip !py-0.5 !border-danger/40 !text-danger"
                        : "chip !py-0.5"
                    }
                  >
                    {flag.reason}
                  </span>
                  {flag.author ? (
                    <Link href={`/u/${flag.author.username}`} className="hover:underline">
                      @{flag.author.username}
                    </Link>
                  ) : (
                    <span>conta removida</span>
                  )}
                  {flag.hidden && <span className="text-danger">oculto</span>}
                  <span className="ml-auto">{formatDate(flag.created_at)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm">
                  {flag.content || "(publicação sem texto)"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Link
                    href={`/post/${flag.post_id}`}
                    className="text-[0.7rem] text-accent hover:underline"
                  >
                    ver publicação
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleHidden(flag)}
                    disabled={pending}
                    className="btn btn-ghost ml-auto !px-2.5 !py-1 text-[0.7rem]"
                  >
                    <EyeOff size={12} /> {flag.hidden ? "restaurar" : "ocultar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Contas</h2>
        <form action="/admin" method="get" className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              name="q"
              defaultValue={searchQuery}
              placeholder="Buscar por @usuário ou nome"
              className="field pl-8 text-sm"
              aria-label="Buscar conta"
            />
          </div>
          <button type="submit" className="btn btn-ghost text-xs">
            buscar
          </button>
          {searchQuery && (
            <Link href="/admin" className="btn btn-quiet text-xs">
              limpar
            </Link>
          )}
        </form>
        <p className="mb-2 text-[0.7rem] text-muted">
          {searchQuery
            ? `${users.length} resultado(s) para “${searchQuery}”.`
            : `${users.length} contas mais recentes. Busque qualquer pessoa para dar selo ou admin.`}
        </p>
        {users.length === 0 ? (
          <p className="chupa-card p-4 text-xs text-muted">Nenhuma conta encontrada.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {users.map((user) => {
              const isMuted = Boolean(
                user.muted_until && new Date(user.muted_until).getTime() > Date.now(),
              );
              return (
                <li key={user.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <Avatar
                    profile={{
                      username: user.username,
                      display_name: user.display_name,
                      avatar_url: user.avatar_url,
                    }}
                    size={34}
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/u/${user.username}`}
                      className="flex flex-wrap items-center gap-1 text-sm font-medium hover:underline"
                    >
                      <span className="truncate">{user.display_name}</span>
                      {user.is_admin && (
                        <span className="chip !py-0 !text-[0.58rem]">
                          <ShieldCheck size={9} /> admin
                        </span>
                      )}
                      {user.is_verified && <BadgeCheck size={12} className="text-accent" />}
                    </Link>
                    <p className="truncate text-xs text-muted">@{user.username}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => verify(user)}
                      disabled={pending}
                      className="btn btn-ghost !px-2.5 !py-1 text-[0.7rem]"
                    >
                      {user.is_verified ? <ShieldOff size={12} /> : <BadgeCheck size={12} />}
                      {user.is_verified ? "tirar selo" : "verificar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAdmin(user)}
                      disabled={pending || user.id === viewerId}
                      className="btn btn-quiet !px-2.5 !py-1 text-[0.7rem]"
                      title={
                        user.id === viewerId
                          ? "Você não pode alterar o seu próprio acesso"
                          : user.is_admin
                            ? "Remover acesso de administrador"
                            : "Dar acesso de administrador"
                      }
                    >
                      <ShieldCheck size={12} />
                      {user.is_admin ? "tirar admin" : "dar admin"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMute(user)}
                      disabled={pending}
                      className={
                        isMuted
                          ? "btn btn-ghost !px-2.5 !py-1 text-[0.7rem] text-danger"
                          : "btn btn-quiet !px-2.5 !py-1 text-[0.7rem]"
                      }
                      title="Silenciar por 24 h"
                    >
                      <VolumeX size={12} /> {isMuted ? "remover silêncio" : "silenciar 24h"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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
