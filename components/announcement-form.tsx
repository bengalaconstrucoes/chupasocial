"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Pin } from "lucide-react";
import { createAnnouncementAction } from "@/lib/actions/announcements";

export function AnnouncementForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    const formData = new FormData();
    formData.set("title", title);
    formData.set("body", body);
    if (pinned) formData.set("pinned", "on");

    startTransition(async () => {
      const result = await createAnnouncementAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTitle("");
      setBody("");
      setPinned(false);
      router.refresh();
    });
  }

  return (
    <form
      className="chupa-card mb-4 space-y-2 p-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
        <Megaphone size={13} /> novo aviso (administração)
      </p>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={120}
        placeholder="Título do aviso"
        className="field text-sm"
        aria-label="Título do aviso"
        required
      />
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={4000}
        rows={3}
        placeholder="O que a galera precisa saber?"
        className="field resize-none text-sm"
        aria-label="Texto do aviso"
        required
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(event) => setPinned(event.target.checked)}
            className="accent-[var(--accent)]"
          />
          <Pin size={12} /> fixar no topo
        </label>
        <button type="submit" disabled={pending} className="btn btn-primary ml-auto !px-3.5 !py-1.5 text-xs">
          {pending ? "Publicando…" : "Publicar aviso"}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}
