export const SUPPORT_COOKIE = "core_support_view";
export const SUPPORT_DURATION_SECONDS = 15 * 60;

/** Vista como usuario: bloquear cualquier acceso a módulos operativos,
 * endpoints o administración con el privilegio real del propietario.
 * La única ruta autorizada durante soporte es /super-admin/soporte. */
export function isBlockedDuringSupport(pathname: string): boolean {
  const path = pathname.split("?")[0];
  if (path === "/super-admin/soporte" || path.startsWith("/super-admin/soporte/")) return false;
  return /^\/(?:api|mascotas|propietarios|registros|empresa|super-admin)(?:\/|$)/.test(path);
}
