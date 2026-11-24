"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('chupa-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t? t==='dark' : m;document.documentElement.setAttribute('data-theme', d? 'dark':'light');}catch(e){}})();`;

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("chupa-theme", next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      title={theme === "dark" ? "Tema claro" : "Tema escuro"}
      className={
        compact
          ? "btn btn-quiet h-9 w-9 !p-0"
          : "btn btn-ghost w-full justify-start !rounded-xl"
      }
    >
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
      {!compact && <span>{theme === "dark" ? "Tema claro" : "Tema escuro"}</span>}
    </button>
  );
}
