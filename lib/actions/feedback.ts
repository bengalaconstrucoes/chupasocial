"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const MOODS = new Set(["idea", "bug", "love", "other"]);

export async function sendFeedbackAction(
  mood: string,
  body: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou." };

  const clean = body.trim();
  if (clean.length < 3) return { ok: false, error: "Escreva um pouco mais." };
  if (clean.length > 500) return { ok: false, error: "O recado pode ter até 500 caracteres." };
  if (!MOODS.has(mood)) return { ok: false, error: "Escolha um tipo de recado." };

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    mood,
    body: clean,
  });

  if (error) return { ok: false, error: "Não foi possível enviar o recado." };

  return { ok: true, message: "Recado enviado. Valeu por ajudar a melhorar o ChupaSocial!" };
}
