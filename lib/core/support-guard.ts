import "server-only";
import { cookies } from "next/headers";
import { SUPPORT_COOKIE } from "@/lib/core/support-policy";

/** Segunda barrera en TODOS los Server Actions que escriben:
 * protege incluso si Next permite enviar un action-ID por POST a una URL
 * distinta de la página donde se generó la acción. */
export async function assertNoSupportMode(): Promise<void> {
  if ((await cookies()).has(SUPPORT_COOKIE)) {
    throw new Error("SUPPORT_VIEW_READ_ONLY");
  }
}
