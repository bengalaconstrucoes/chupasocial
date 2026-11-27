import Link from "next/link";
import { Fragment } from "react";

/**
 * Texto de publicação com #hashtags, @menções e links clicáveis.
 * Sem HTML: nada de dangerouslySetInnerHTML.
 */
const TOKEN = /(#[\p{L}\p{N}_]{2,40}|@[a-z0-9_]{3,20}|https?:\/\/[^\s<]+)/giu;

export function RichText({ text }: { text: string }) {
  if (!text) return null;

  const parts: React.ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));

    const token = match[0];
    if (token.startsWith("#")) {
      parts.push(
        <Link
          href={`/hashtag/${encodeURIComponent(token.slice(1).toLowerCase())}`}
          className="font-medium text-accent hover:underline"
        >
          {token}
        </Link>,
      );
    } else if (token.startsWith("@")) {
      parts.push(
        <Link
          href={`/u/${token.slice(1).toLowerCase()}`}
          className="font-medium text-accent hover:underline"
        >
          {token}
        </Link>,
      );
    } else {
      parts.push(
        <a
          href={token}
          target="_blank"
          rel="noreferrer noopener nofollow"
          className="break-all text-accent hover:underline"
        >
          {token.replace(/^https?:\/\//, "").slice(0, 48)}
          {token.replace(/^https?:\/\//, "").length > 48 ? "…" : ""}
        </a>,
      );
    }

    last = index + token.length;
  }

  if (last < text.length) parts.push(text.slice(last));

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </>
  );
}
