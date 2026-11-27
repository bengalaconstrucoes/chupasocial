"use client";

import { useEffect } from "react";
import { profileAccentStyle } from "@/lib/profile-style";

/**
 * Aplica a cor de destaque do perfil no documento inteiro enquanto a página do
 * perfil está aberta. Antes a cor ficava presa ao wrapper interno e algumas
 * superfícies (header, thread, cartões) continuavam com a cor padrão.
 */
export function ProfileAccent({ color }: { color: string | null }) {
  useEffect(() => {
    const style = profileAccentStyle(color) as Record<string, string> | undefined;
    if (!style) return;

    const root = document.documentElement;
    const keys = Object.keys(style);
    const previous = keys.map((key) => [key, root.style.getPropertyValue(key)] as const);

    for (const [key, value] of Object.entries(style)) {
      root.style.setProperty(key, value);
    }

    return () => {
      for (const [key, value] of previous) {
        if (value) root.style.setProperty(key, value);
        else root.style.removeProperty(key);
      }
    };
  }, [color]);

  return null;
}
