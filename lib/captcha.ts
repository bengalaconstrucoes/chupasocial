import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Captcha aritmético assinado no servidor. Não depende de serviço externo:
 * a conta é sorteada na renderização do formulário, o resultado é assinado com
 * HMAC e só a assinatura viaja com o formulário.
 */
const SECRET = process.env.CAPTCHA_SECRET ?? "chupasocial-captcha-v1";

export type Captcha = { question: string; nonce: string; token: string };

function sign(nonce: string, answer: number) {
  return createHmac("sha256", SECRET).update(`${nonce}:${answer}`).digest("hex");
}

export function createCaptcha(): Captcha {
  const a = randomInt(2, 9);
  const b = randomInt(2, 9);
  const useSum = randomInt(0, 2) === 0;
  const answer = useSum ? a + b : Math.max(a, b) - Math.min(a, b);
  const question = useSum
    ? `Quanto é ${a} + ${b}?`
    : `Quanto é ${Math.max(a, b)} − ${Math.min(a, b)}?`;
  const nonce = crypto.randomUUID();

  return { question, nonce, token: sign(nonce, answer) };
}

export function verifyCaptcha(nonce: string, token: string, answer: string) {
  if (!nonce || !token) return false;
  const parsed = Number(answer.trim());
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 99) return false;

  const expected = Buffer.from(sign(nonce, parsed), "hex");
  const received = Buffer.from(token, "hex");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
