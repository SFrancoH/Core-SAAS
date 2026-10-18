# Core SaaS — Identidad, roles, empresas, verticales y acceso

## Principio base
Una identidad en \`auth.users\` puede trabajar con N empresas, pero **ninguna pertenencia implica acceso universal**. Todo recurso pertenece a una empresa concreta, una vertical licenciada y una acción autorizada. El frontend no constituye un control de seguridad.

\`\`\`text
ÚNICO LOGIN CORE SAAS  →  auth.users  →  core.accounts
                                          ├── core.platform_staff (Super-Admin / Super-User)
                                          └── core.memberships (empresa A: Admin, empresa B: User, ...)
                                                ├── core.membership_permissions (permisos concretos)
                                                └── public.empresas
                                                     └── core.entitlements (PETS, PULSE, ...)
\`\`\`

## Roles (solo cuatro)
| Rol de plataforma | Dónde existe | Puede crear | Límite |
|---|---|---|---|
| Super-Admin | Único propietario global | Super-User, Admin y User; empresas y asociaciones | No puede crear un segundo Super-Admin. Accesos auditados |
| Super-User | Personal interno Core | Ninguno por defecto; solo poderes delegados explícitos | No hereda todos los permisos del propietario |
| Admin | Membresía de una empresa | Admin y User de **esa misma empresa** | No puede añadir personal interno, cambiar licencias o conceder lo que no posee |
| User | Membresía de una empresa | Nadie | Solo permisos individuales de una vertical habilitada |

**Veterinario, vendedor y otros cargos son permisos específicos dentro de una vertical**, no roles globales independientes. Los valores antiguos \`super_admin\`, \`empresa_admin\` y \`veterinario\` se conservan temporalmente en \`public.usuarios.rol\` para que PETS continúe funcionando. No reemplazar el enum antiguo antes del cambio de consultas y RLS.

## Caso PETS (ejemplo)
Empresa «Clínica veterinaria» con producto PETS activo:
- 2 membresías de rol **Admin**, permisos de gestión de miembros y los que la empresa permita.
- 5 membresías **User**, con permisos \`pets.pet.read\`, \`pets.pet.write\`, \`pets.consultation.read\`, \`pets.consultation.write\` según cada veterinario.
- 0 acceso a PULSE si la empresa no tiene licencia PULSE, aunque alguien escriba su URL manualmente.

Una persona con rol Admin en PETS y User en otra empresa con PULSE usa un solo correo y contraseña; el selector muestra las empresas/verticales **para las que tenga licencia y permisos**. Cambiar de empresa requiere validar la membresía en el servidor (no aceptar empresa_id desde el navegador sin comprobar).

## Flujo de autenticación y UX
1. Ruta pública \`/login\`, marca Core SaaS; Supabase Auth verifica credenciales.
2. El servidor consulta una cuenta activa; en el período transitorio puede resolver también \`public.usuarios\`.
3. Super-Admin entra a \`/super-admin\`. Los demás entran al \`/portal\`.
4. El portal lista solo empresas activas con membresía activa, al menos un permiso y licencia de vertical vigente. Con una sola vertical plenamente implementada se podrá abrir directamente; con varias se presenta selector.
5. Al seleccionar empresa y vertical, el servidor establece el contexto autorizado; **cada** API o acción vuelve a comprobar identidad, membresía, permiso, licencia y pertenencia del recurso.
6. Si se pierde la licencia, se desactiva la empresa, usuario o membresía, se deniega en la próxima operación aunque la página anterior siga abierta.

**Compatibilidad existente:** usuarios PETS históricos con una sola empresa continúan accediendo a \`/empresa\`. El portal bloquea la entrada a PETS por una membresía de otra empresa hasta que todas las páginas, acciones y políticas RLS PETS se adapten al contexto multiempresa. No tratar el listado como prueba de aislamiento.

## Modelo de datos propuesto (SQL 010 + 011)
- \`auth.users\`: autenticación e identidad canónica; una cuenta por persona.
- \`core.accounts\`: información global, activo y \`created_by\`.
- \`core.platform_staff\`: Super-Admin único o Super-User; no deriva permisos de un perfil editable en el cliente.
- \`core.memberships\`: relación N:M usuario-empresa, estado y rol Admin/User.
- \`core.membership_permissions\`: permisos concretos de una membresía, incluye actor que los asignó.
- \`core.platform_permission_grants\`: permisos delegados expresamente a personal interno por empresa.
- \`core.entitlements\`: acceso contractual de cada empresa a PETS, PULSE y módulos.
- \`core.audit_events\`: eventos de creación, asociación, asignación de permisos y soporte; actor real + sujeto + empresa + momento.
- \`core.support_sessions\`: identidad real, usuario observado, empresa, motivo, caducidad, revocación y modo de solo lectura.

La versión 011 añade RPC privadas para registrar cuentas existentes en Auth, asignar Super-Users, asociar un usuario a varias empresas de forma transaccional y registrar cambios; sus \`EXECUTE\` se restringen a \`service_role\`. Las APIs deben obtener \`p_actor_id\` de \`supabase.auth.getUser()\`, nunca de los campos de un formulario.

## Selector de permisos (UI pendiente)
Al crear/asignar un usuario:
1. Elegir empresa(s). Cada fila tiene \`company_id\` verificado.
2. Por empresa, mostrar solo verticales licenciadas.
3. Elegir Admin/User **por membresía**, no globalmente.
4. Marcar permisos granularmente: PETS (lectura/escritura mascotas, consultas, etc.), PULSE (proyectos, boletas, pagos, etc.).
5. El servidor valida que la empresa tenga la licencia activa y que quien delega posee esos permisos; Admin no puede otorgarse más derechos ni actuar sobre otra empresa.
6. Guardar en transacción y registrar \`created_by\`/actor en \`core.audit_events\`. Si falla una empresa, se revierte la operación completa.

No se debe mostrar un selector editable como si guardase permisos hasta implementar y verificar su API y migración.

## «Entrar como cualquier usuario» — modo soporte
El propietario puede iniciar una **vista de soporte** para comprobar el contexto y permisos de un usuario, **sin solicitar su contraseña y sin crear un JWT de ese usuario**. Esta primera fase:
- Solo Super-Admin puede iniciar el proceso; selecciona usuario y empresa, explica motivo (mínimo 10 caracteres).
- La RPC crea una sesión de **solo lectura**, 15 minutos y un evento en \`core.audit_events\`.
- En pantalla se ve sujeto, empresa, rol, verticales y permisos; se muestra permanentemente el actor real.
- El proxy impide visitar rutas operativas PETS, APIs y otras pantallas administrativas mientras la cookie de soporte esté activa.
- Al salir se revoca en servidor y se registra un evento. Si no se ha aplicado SQL 011, el modo permanece **bloqueado**.
- Esta **no es todavía** una suplantación funcional completa dentro de PETS/PULSE; permitir «operar como» solo después de autenticar de nuevo con factor fuerte, usar una delegación firmada con permisos **intersección**, integrar contexto de soporte en todas las APIs y validar auditoría/RLS de extremo a extremo.

Jamás cambiar la contraseña del usuario, reemplazar su token Auth, firmar un JWT de usuario arbitrario ni borrar el rastro del operador para lograr «Ver como». Registrar soporte con actor real, sujeto observado y límite temporal.

## Aislamiento real (invariantes)
- El cliente puede solicitar una empresa, **pero nunca decidir que pertenece a ella**.
- \`service_role\` ignora RLS: cada uso requiere actor verificado, empresa, permiso y pertenencia concreta; preferir RPC de alcance controlado.
- RLS en tablas PETS (actuales) y PULSE (futuras), con FK compuestas de empresa y checks de autorización en escritura, no solo selects.
- Toda consulta operativa debe filtrar \`empresa_id\` derivado de la membresía validada; no confiar en botones, URL, cuerpo JSON, metadata Auth ni \`localStorage\`.
- Permisos y licencias se chequean a cada operación, no solo al login.
- Denegar por defecto ante servicio sin migraciones, usuario inactivo, empresa suspendida, licencia vencida, permiso ausente, conflicto de empresa o sesión soporte de solo lectura.
- Negativas E2E: usuario A no lee/escribe empresa B, cambia query/body/header y falla; Admin A no crea miembros B; Super-User sin grant no actúa; empresa solo PETS no entra a PULSE; revocar membresía elimina acceso inmediato; soporte no escribe ni consulta datos clínicos.

## Estado de implementación y orden de despliegue
| Trabajo | Estado |
|---|---|
| Login Core SaaS, rutas de acceso y portal de selección | Implementado en código, sujeto a CI |
| Roles tipados y validación de alcance pura | Implementado en código con tests |
| SQL 011 de cuentas/membresías/roles/auditoría/soporte | Redactado, **NO aplicado** |
| Vista soporte (permisos, sin operar como usuario) | Implementada en código; bloqueada sin SQL 011 |
| UI crear Admin/User/Super-User y asociar cuenta multiempresa | Implementada en código; bloqueada sin SQL 010/011 |
| Invitaciones aceptadas por terceros (cuentas preexistentes) | Pendiente: Admin no puede asociar terceros silenciosamente |
| Adaptación PETS a empresa activa multiempresa en cada ruta/RLS | Pendiente |
| Pruebas E2E de 2 empresas, 2 verticales, permisos y sesión soporte | Pendiente |
| PULSE en Core SaaS | Carpeta preparada; frontend operativo pendiente |

**Despliegue seguro:** C01 preflight real → copia/ensayo → SQL 010 en prueba → SQL 011 en prueba → regresiones PETS + RLS A/B → aprobación y rollout controlado. No ejecutar SQL 011 aislada ni inferir que se aplicó a Supabase por estar en Git.

## Gestión de usuarios Core (PR #7)
- Super-Admin: `app/super-admin/usuarios` permite elegir empresa, crear Admin/User, crear Super-User y asociar una cuenta Core existente a varias empresas por correo. Una cuenta usa una sola identidad `auth.users`; la asociación se registra en `core.memberships` con `created_by` y en `core.audit_events`.
- Admin de empresa: `app/empresa/usuarios` (compatibilidad PETS) y `app/portal/empresa/[id]/usuarios` (membresías Core) solo habilitan operaciones tras una RPC que valida pertenencia y `core.members.manage` en la empresa. No se confía en el ID en la URL ni en el formulario.
- Formulario: permisos por vertical; el rol Admin incluye `core.members.manage` sin que el cliente elija privilegios globales. El backend rechaza permisos no delegables o sin licencia, y niega cualquier intento de crear personal global por parte de Admin.
- Super-User: cuenta global creada solo por Super-Admin. No hereda acceso a ninguna empresa. El propietario puede asociarla expresamente como Admin/User a cada empresa, con permisos específicos, y queda auditado.
- Crear usuario: servidor verifica el actor y el catálogo delegable antes de `auth.admin.createUser`; luego RPC registra la cuenta/actor y asigna membresía. Si algo falla se intenta eliminar la nueva identidad Auth. Se debe monitorear errores de cleanup para resolver posibles cuentas huérfanas.
- Las cuentas Core nuevas **NO reciben automáticamente un perfil PETS legacy**. Por ello la interfaz PETS de una nueva cuenta queda bloqueada hasta completar los filtros y RLS. No afirmar que el selector actual da acceso productivo a PETS de múltiples empresas.
- El login como otro usuario de `/super-admin/soporte` sigue siendo **vista de permisos en modo soporte**: no sustituye la sesión del sujeto ni opera su negocio. La modalidad operativa sólo podrá habilitarse con autorización por contexto efectivo, doble actor en auditoría, protección por base de datos y pruebas E2E.

## Defensa en profundidad del soporte (C12)
La ruta `/super-admin/soporte` es **diagnóstico de permisos y verticales**, no autenticación con las credenciales del usuario observado. Mientras existe su cookie `httpOnly`, el proxy bloquea rutas operativas y `lib/core/support-guard.ts` rechaza las Server Actions de escritura aunque se intenten despachar mediante una URL permitida. La acción de cerrar soporte y logout permanecen disponibles. Es una barrera de la aplicación; el propietario real conserva sus privilegios originales fuera de la vista y no hay suplantación operativa en producción.

## Empresa ≠ sede: UNI-001
El contexto de plataforma contempla **usuario → varias empresas → varias sedes por empresa**, sin repetir cuenta Auth. Empresa es frontera de privacidad/tenant; sede es subdivisión operativa. `core.memberships` define pertenencia a empresa; el diseño `core.sedes` y grants por sede determinará dónde puede operar cada usuario, mientras su licencia y permisos de vertical siguen siendo los de la empresa.
Un empleado con PETS de alcance empresa puede buscar el mismo registro de mascota en sedes A y B, con su historial clínico integrado. Un empleado con permisos de sede restringida no puede ejecutar operaciones locales en sedes fuera de su alcance, aunque cambie URL, body o filtros. Los datos maestros son únicos por empresa y no por sede; no hay «dos cuentas» para dos ubicaciones.
**Estado:** las tablas/grants de sede son diseño pendiente; no añadir autorizaciones ficticias sobre `fuente`. Ver `docs/UNIFICACION_MULTISEDE.md`.
