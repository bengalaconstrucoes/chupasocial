import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Ducky } from "@/components/ducky";
import { PATCHES } from "@/lib/patches";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Novidades" };

export default function PatchesPage() {
  return (
    <AppShell>
      <div className="border-b border-line bg-surface px-4 py-3 sm:px-5">
        <h1 className="inline-flex items-center gap-1.5 text-base font-semibold">
          <Sparkles size={16} className="text-accent" /> Novidades
        </h1>
        <p className="text-xs text-muted">
          O que mudou no ChupaSocial, versão por versão. Sem letra miúda.
        </p>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <div className="mb-4">
          <Ducky tip="Cada patch lista o que entrou de novo. Se algo quebrar, avisa na caixinha de feedback." />
        </div>

        <ol className="space-y-3">
          {PATCHES.map((patch) => (
            <li key={patch.version} className="chupa-card p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.68rem] font-bold text-accent">
                  v{patch.version}
                </span>
                <h2 className="text-sm font-semibold">{patch.title}</h2>
                <span className="ml-auto text-[0.68rem] text-muted">
                  {formatDate(patch.date)}
                </span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {patch.highlights.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-muted">
                    <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </AppShell>
  );
}
