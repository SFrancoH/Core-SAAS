# Modelo de datos, permisos y licencias — Core SaaS

**Estado: ESPECIFICACIÓN. NO ES DDL PARA EJECUTAR.** El repositorio ya contiene migraciones PETS 001–009. Antes de añadir SQL verificar tablas, tipos, constraints, triggers, RLS y esquema **real** en el Supabase conectado a Core.

## 1. Fuente canónica
| Existente en el repositorio | Identidad | Responsabilidad |
|---|---|---|
| `auth.users` | `id uuid` | Sesiones y credenciales |
| `public.empresas` | `id uuid` | Empresa única para todas las verticales |
| `public.usuarios` | `id uuid` FK auth.users | Perfil/rol PETS actual, empresa y activo |
| `public.mascotas`, `public.propietarios`, `public.propietarios_mascotas` | UUID y empresa | Entidades clínicas veterinarias |
| `public.consultas_controles`, `public.eventos_mascota` | UUID y empresa | Consultas e historial, según migraciones aplicadas |

**Nunca crear `pulse.empresas` ni otra tabla `public.empresas`.** Los IDs de empresa usados por cualquier vertical son UUID de esta tabla. El rol de `public.usuarios` pertenece al código existente y no deberá confundirse con el nuevo modelo global de permisos.

## 2. Entidades Core propuestas
| Tabla | Claves/contenido mínimo |
|---|---|
| `core.memberships` | UUID PK, `empresa_id uuid` FK, `user_id uuid` FK auth.users, estado, UNIQUE(empresa_id,user_id) |
| `core.roles` | UUID PK, código y ámbito plataforma/empresa/vertical |
| `core.permissions` | PK código de permiso, dominio y acción |
| `core.role_permissions` | PK compuesta (role_id,permission_code) |
| `core.membership_roles` | PK compuesta (membership_id,role_id) |
| `core.products` | PK código: PETS/AURA/VISION/DRIVE/NEURO/PULSE/LENS |
| `core.modules` | PK código, tipo vertical/transversal y estado |
| `core.product_modules` | UNIQUE(product_code,module_code) y relación obligatorio/opcional |
| `core.entitlements` | UUID PK, empresa, producto/módulo, vigencia, estado, límites; unicidad de concesiones activas según diseño |
| `core.subscriptions` | Contrato comercial, empresa, proveedor, período, estado; no es por sí solo permiso API |
| `core.integrations` | Empresa, proveedor, scopes, configuración protegida y referencia a secreto |
| `core.webhook_events` | Empresa, integración, event_key idempotente, estado, timestamps |
| `core.outbox_events` | Empresa, evento, agregado, política de entrega, estado |
| `core.audit_events` | Empresa, actor, operación, recurso, hora, metadatos saneados |

**No duplicar `auth.users` creando `core.users` sin un caso justificado.** Roles dinámicos permitirán `veterinario`, `vendedor`, `empresa_admin` y otros sin alterar el enum histórico de PETS para incorporar cada rol.

## 3. Datos de PULSE: esquema exclusivo `pulse`
Tablas previstas según funcionalidad, no todas de inmediato: `proyectos`, `boletas`, `asignaciones_vendedores`, `seller_sales_links`, `ganadores`, `reservas`, `movimientos_pago`, `eventos_reserva`, `alertas_oportunidades`.

Cada entidad operativa contiene `empresa_id uuid NOT NULL` FK a `public.empresas`. `pulse.proyectos` tiene UUID interno, slug único por empresa, flyer, precio, configuración del premio mayor y anticipados, token único, estado. `pulse.boletas` tiene UUID interno, proyecto de su misma empresa, número como texto de **cuatro dígitos** (conserva ceros iniciales), estado, asignación, comprador y saldo. UNIQUE por `(proyecto_id,numero)` o composite equivalente; FKs compuestas impiden cruzar empresas/proyectos. Los enlaces públicos no deben exponer información personal.

**Numeración:** `0000` a `9999` son 10.000 posibles números; si el proyecto crea 9.999 se debe definir cuál excluye. La reserva y actualización de pago son atómicas; saldo financiero necesita movimientos auditables, no depender únicamente del valor agregado visible.

## 4. Autorización obligatoria
1. Validar identidad.
2. Resolver empresa activa de membresía autorizada; nunca confiar solo en `empresa_id` del body.
3. Verificar rol/permiso específico, por ejemplo `pulse.project.create` o `pets.consultation.write`.
4. Verificar que la empresa tenga entitlement vigente del producto/módulo.
5. Verificar que el recurso pertenece a la empresa, proyecto y rol/vendedor correspondiente.
6. Transaccionar escritura y auditar.

Sin licencia/permiso, **deny by default** (aunque el menú esté visible o se invoque API directamente). El superadministrador único del código PETS es una regla que debe conservarse hasta rediseño y prueba formal. Cambios de privilegios y operaciones financieras deben auditarse.

### Permisos iniciales sugeridos
- Core: `core.company.read`, `core.company.manage`, `core.members.manage`, `core.entitlements.manage`.
- PETS: `pets.pet.read`, `pets.pet.write`, `pets.consultation.read`, `pets.consultation.write`.
- PULSE: `pulse.project.create`, `pulse.project.read`, `pulse.ticket.reserve`, `pulse.ticket.pay`, `pulse.ticket.assign`, `pulse.project.delete`.
- Compartidos: `inventory.stock.read`, `inventory.stock.move`, `billing.invoice.issue`.

## 5. Licenciamiento
Catálogo de productos y complementos, activaciones por empresa, fecha, cuota, límites y estado. Ejemplo: empresa con PETS+historias clínicas+inventario, sin PULSE. La UI lee licencias, pero cada acción protegida verifica entitlement en servidor. La suspensión no autoriza eliminar historias clínicas o pagos.

## 6. Seguridad PostgreSQL
RLS + grants de mínimos privilegios para tablas expuestas; servicio privilegiado solo server-side y con TenantContext explícito. FKs compuestas e índices por empresa. Pruebas negativas A/B y restauración de copia. Ningún SQL de otro sistema con tipos incompatibles se ejecuta directamente.

## 7. Relaciones conceptuales
```
auth.users -> core.memberships -> public.empresas
                |                     |-> PETS: mascotas, propietarios, consultas
                |                     |-> PULSE: proyectos -> boletas -> pagos
                |                     |-> core.entitlements -> core.modules/products
                -> membership_roles -> roles -> permissions
public.empresas -> core.integrations -> core.webhook_events / outbox_events
```

## 8. Canon de roles y multiempresa (C11)
Solo cuatro roles de Core: `super_admin` (único propietario), `super_user` (personal interno con grants explícitos), `admin` y `user` (por membresía). Los cargos veterinario/vendedor no crean nuevos roles globales: son conjuntos de permisos sobre PETS/PULSE.

`core.accounts` referencia `auth.users`. `core.memberships` permite múltiples empresas; `core.membership_permissions` tiene permiso concreto y creador; `core.entitlements` decide verticales con licencia. El RPC `public.core_autorizar_operacion` se actualizará al aplicar 011, **solo desde service_role en servidor**. Las tablas Core están cerradas a `anon/authenticated` y sus métodos son RPC expresamente autorizadas.

La compatibilidad con `public.usuarios.empresa_id` y las políticas RLS PETS actuales es temporal. Prohibido habilitar la selección de una segunda empresa para operaciones PETS hasta que todas las consultas, acciones y RLS respeten la membresía activa. La DB real sigue sin comprobarse; no se ejecutó 011. Consulta `docs/IDENTIDAD_ACCESO_MULTIEMPRESA.md`.

## 9. UNI-001 — Multisede integrada (diseño, NO DDL aplicado)
`public.empresas` continúa como **único tenant** de todas las verticales. Cada empresa tendrá un catálogo central único de sedes, propuesto como `core.sedes(id uuid,empresa_id uuid,codigo,nombre,activa,...)`, con UNIQUE por `(empresa_id,codigo)` normalizado y restricción compuesta `(empresa_id,id)`. Los nombres no son valores codificados en la aplicación; cada empresa puede tener 1, 2 o N sedes.

Permisos por empresa no equivalen a permisos por sede: `core.memberships` define acceso a empresa, `core.membership_sedes`/grants equivalentes definen sedes autorizadas (una selección o todas). El permiso de lectura de datos maestros puede otorgarse para toda la empresa; una operación local requiere `sede_id` autorizado y RLS/validación de pertenencia empresarial. Nunca confiar en un selector como autorización.

**Identidad y unicidad:** maestros compartidos (mascota, propietario, SKU, proyecto) tienen identidad UUID y constraints por empresa, no por sede. En PETS ya existen UNIQUE de carnet y documento en ámbito `empresa_id`; conservarlos. No insertar otra mascota al visitar otra sede; las consultas guardan la sede donde ocurrieron. Los datos históricos de `fuente` exigen mapping por empresa y conciliación antes de pasar a identificadores de sede; no convertirlos con un simple rename.

**Operación:** citas, consultas, cajas, inventarios físicos y stock se atribuyen a sede cuando aplique; inventario usa movimientos/transferencias balanceadas entre sedes, no duplicación del catálogo. PULSE conserva unicidad de boleta por proyecto y empresa; asignar oficina/punto de venta no duplica proyecto ni boleta. Reportes ofrecen A, B y consolidado sin doble conteo de maestros.

**Licencias:** una empresa con varias sedes opera en **la misma plataforma y con el mismo contrato de producto**; cuotas por sede, si existieran, son límites comerciales del mismo entitlement, no instalaciones aisladas. **Privacidad:** empresas distintas jamás comparten o fusionan registros maestros por coincidencia de nombres, documentos, carnets o teléfonos.

**Estado:** estas entidades y reglas son requisitos de diseño, no tablas ejecutadas. Requisitos, casos de uso y pruebas completas: `docs/UNIFICACION_MULTISEDE.md`.
