import { createHash, randomBytes } from "node:crypto";

/**
 * As contas não usam e-mail de verdade: o Supabase Auth exige um endereço,
 * então geramos um determinístico e não entregável a partir do username.
 * Nunca sai do servidor como algo que se possa "enviar".
 */
export const SYNTHETIC_EMAIL_DOMAIN = "chupasocial.invalid";

/** Cookie que carrega o código recém-gerado até a tela de confirmação. */
export const RECOVERY_CODE_COOKIE = "chupa_recovery_code";

export function syntheticEmail(username: string) {
  return `${username.trim().toLowerCase()}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export function isSyntheticEmail(email: string | null | undefined) {
  return Boolean(email && email.toLowerCase().endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`));
}

/** Código no formato XXXX-XXXX-XXXX-XXXX-XXXX-XXXX (24 caracteres hex). */
export function generateRecoveryCode() {
  const raw = randomBytes(12).toString("hex").toUpperCase();
  return raw.match(/.{1,4}/g)?.join("-") ?? raw;
}

export function normalizeRecoveryCode(code: string) {
  return code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}
