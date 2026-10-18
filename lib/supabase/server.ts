import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getAuthCookieOptions } from "@/lib/supabase/cookie-options";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase authentication environment variables are missing.");
  }

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, getAuthCookieOptions(options));
          });
        } catch {
          // Server Components cannot always write cookies. proxy.js refreshes them.
        }
      }
    }
  });
}
