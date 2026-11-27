import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Cliente com a sessão do usuário (cookies). Toda escrita passa por RLS.
 *
 * O `cache` do React reaproveita o mesmo cliente durante um render, e o
 * `getUser` fica memoizado: o shell e a página não consultam a API de auth
 * duas vezes na mesma navegação.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  const client = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components não podem escrever cookies; o middleware renova a sessão.
        }
      },
    },
  });

  const getUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = cache(getUser) as typeof client.auth.getUser;

  return client;
});
