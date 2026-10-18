import "server-only";

import { createClient } from "@supabase/supabase-js";

let adminClient: ReturnType<typeof createClient> | undefined;

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

// TODO(C01): generar los tipos de la base Supabase real antes de tipar todas las consultas.
// Compatibilidad temporal: las tablas dinámicas PETS no tienen aún tipos Database generados.
export function getSupabaseAdmin(): any {
  if (adminClient) {
    return adminClient;
  }

  const url = getRequiredEnvironmentVariable("SUPABASE_URL");
  const secretKey = getRequiredEnvironmentVariable("SUPABASE_SECRET_KEY");

  adminClient = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });

  return adminClient;
}

export async function checkSupabaseConnection() {
  const url = getRequiredEnvironmentVariable("SUPABASE_URL");
  const secretKey = getRequiredEnvironmentVariable("SUPABASE_SECRET_KEY");
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
    headers: {
      apikey: secretKey
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Supabase connection failed with status ${response.status}`);
  }

  return true;
}
