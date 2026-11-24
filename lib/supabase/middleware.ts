import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Rotas que exigem sessão: redirecionadas antes de qualquer renderização. */
const PROTECTED_PREFIXES = [
  "/notifications",
  "/settings",
  "/messages",
  "/search",
  "/communities",
  "/post",
  "/u",
];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Renova o token e identifica a sessão atual.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  // Sessão de uma conta que não existe mais (excluída) ou revogada: limpa os
  // cookies para não repetir chamadas 401/403 à API de auth a cada navegação.
  if (userError) {
    const status = (userError as { status?: number }).status;
    if (status === 400 || status === 401 || status === 403) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      response.cookies.getAll().forEach(({ name }) => {
        if (name.startsWith("sb-") && name.includes("auth-token")) {
          response.cookies.delete(name);
        }
      });
    }
  }

  const { pathname } = request.nextUrl;

  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}
