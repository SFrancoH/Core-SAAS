# AGENTS — Core SaaS

**Estas reglas son obligatorias para cualquier IA o desarrollador.** Core SaaS es el producto; PETS, PULSE y las demás son verticales integradas. No describir este repositorio como una migración.

## Norma obligatoria de lenguaje — TypeScript
- **Todo código nuevo de aplicación, servidor, Core, verticales, módulos, integraciones y pruebas automatizadas se escribe en TypeScript**: `.ts` y `.tsx`. No crear nuevos archivos `.js`, `.jsx` ni `.mjs` para funcionalidades.
- El proyecto usa `tsconfig.json` con `strict: true`, `allowJs: false` y `noEmit: true`. El código de aplicación es TypeScript.
- Antes de finalizar un cambio: `npm ci`, `npm test`, `npm run typecheck` y `npm run build`. La CI usa Node.js 22 para ejecutar pruebas TypeScript; si el cambio requiere un runtime distinto, documentarlo.
- Al modificar lógica PETS, preservar el comportamiento y agregar pruebas; todas las rutas, componentes y servicios son TypeScript.
- No hay adaptadores `.js` dentro del código de aplicación. Los contratos entre módulos llevan tipos explícitos, validaciones de entradas externas en runtime y pruebas.
- Excepciones: SQL `.sql`, documentación `.md`, JSON y archivos de configuración exigidos por herramientas; no se consideran código de funcionalidad.

## Lectura antes de modificar código
1. Leer `README.md`, `PLAN_DESARROLLO.md`, `BITACORA.md`, `docs/ARQUITECTURA.md`, `docs/MODELO_DATOS_PERMISOS_LICENCIAS.md` y `docs/CONTRATOS_INTEGRACIONES.md`.
2. Si se trabaja en una vertical, leer también `docs/verticales/PETS.md` o `docs/verticales/PULSE.md`. Para crear otra, documentarla primero.
3. Consultar el código y migraciones reales. Un documento no prueba que exista una tabla ni que una función esté desplegada.
4. Registrar alcance, archivos, permisos, licencias, validaciones, contrato API y pruebas antes de implementar.

## Reglas de arquitectura
- Un Core compartido: empresas, identidad, autorizaciones, catálogo de productos, licencias, integraciones y auditoría. Las verticales tienen datos y casos de uso separados; los módulos comunes (inventario, facturación, agenda y reportes) son independientes de cualquier vertical.
- Conservar inicialmente Next.js/React y Supabase Auth/PostgreSQL. No sustituir toda la aplicación ni dividirla en microservicios por preferencia técnica.
- La identidad de empresa es `public.empresas.id uuid` y la de usuario `auth.users.id uuid`. `public.usuarios` ya existe y debe reutilizarse. **Prohibido crear otra tabla de empresas o copiar esquemas con empresa_id text como si fueran compatibles.**
- Nuevas tablas de Core: esquema `core`. Nuevas tablas exclusivas de PULSE: esquema `pulse`. PETS mantiene inicialmente sus tablas actuales `public`. No alterar tablas en la base de datos sin migración versionada, preflight y verificación.
- Una vertical no importa repositorios ni tablas internas de otra. Los complementos se consumen mediante casos de uso/contratos.
- Autorización en servidor: sesión, empresa/membresía, rol/permiso, módulo licenciado y pertenencia del recurso. Ocultar botones no autoriza operaciones.
- `service_role` solo en servidor y detrás de autorizaciones expresas. Prohibido guardar secretos, historias clínicas, PII de compradores o webhooks privados en Git, URLs y logs.

## Contrato GLOBAL de webhooks
- Para GHL, aceptar JSON raíz, `customData`, `custom_data`, `custom_fields`, claves con prefijos y mezclas. El parser global normaliza; la vertical valida sus propios campos.
- Rechazar contradicciones de identidad/empresa/proyecto; credencial Bearer o firma vinculada a la empresa, validación de datos, correlación de eventos e idempotencia.
- **Lectura flexible no significa permiso de escritura.** Tests reales de raíz, Custom Data, mezclas, alias, nulos, valores inválidos, credencial equivocada y acceso entre empresas.
- Política de entrega pertenece al caso de uso: ciertas reservas PULSE tienen un solo POST saliente y alerta manual, sin reintento automático; otras sincronizaciones pueden usar reintentos idempotentes.
- No modificar contratos conocidos de integración sin pruebas y decisión explícita.

## Regla al incorporar código de referencia
Nunca copiar archivos completos sin auditar. Seguir `docs/COMO_AGREGAR_FUNCIONALIDAD.md`: una función, un dominio propietario, un contrato, migración diseñada contra el esquema Core, permisos, pruebas y bitácora. No instalar automáticamente nuevas dependencias, RLS o SQL por copiar una función.

## Entrega y evidencia
Actualizar `PLAN_DESARROLLO.md` y `BITACORA.md` en el mismo PR. Estados: DEFINIDO, IMPLEMENTADO, BD APLICADA, PROBADO LOCAL, DESPLEGADO, VERIFICADO EN PRODUCCIÓN. Informar qué se verificó, qué quedó pendiente y a qué entorno afectó. No asumir que un commit equivalga a producción.

## Frontend, Core Admin y estilos compartidos
- La plataforma tiene dos contextos: Core Admin global (ruta /super-admin, rol super_admin) y portales operativos por vertical, empezando por PETS.
- La estética de todas las verticales viene exclusivamente de styles/tokens.css. No usar nuevos colores HEX o rgba fuera de ese archivo.
- Los componentes compartidos viven en components/ui y los layouts en components/layouts. Usar accesibilidad, responsive y mensajes de error/carga.
- /super-admin/apariencia es una página informativa del diseño. No persiste cambios ni ofrece temas dinámicos por empresa.
- Está prohibido presentar como operativas licencias, auditoría o facturación Core sin tener API, DB y autorización verificadas.

## Conversión real de PETS a TypeScript
- Las rutas, acciones, componentes y utilidades de PETS se renombraron a .ts/.tsx conservando URLs y lógica.
- Los archivos PETS se verifican con `strict: true`, **sin `@ts-nocheck` ni `@ts-ignore`**. La prueba automática bloquea regresiones. Un único límite pendiente es la definición tipada de tablas/RPC de Supabase real (requiere C01); no extender `any` del adaptador administrativo a nuevas funciones.
- No crear archivos JavaScript dentro de app, components o lib. El núcleo nuevo permanece en TypeScript estricto.

## Identidad, cuatro roles y aislamiento (IDENT-001)
- Fuente normativa: `docs/IDENTIDAD_ACCESO_MULTIEMPRESA.md`. Un login global; membresía N:M usuario-empresa; licencias por empresa; permisos por membresía **y vertical**.
- Los roles canónicos son `super_admin` (único propietario), `super_user` (personal Core sin privilegios heredados), `admin` y `user`. «Veterinario» y «vendedor» se expresan como permisos de vertical. Las etiquetas legacy del enum PETS solo se conservan por compatibilidad; no crear más super_admin.
- Super-Admin puede asignar Super-User/Admin/User y empresas; Admin **solo** Admin/User en su empresa, sin delegar privilegios ausentes. Cada creación/edición guarda `created_by` y evento en `core.audit_events`.
- Ningún botón, selector de empresa, pathname, URL, sesión Auth metadata ni parámetro del body concede acceso. En servidor validar usuario activo + membresía activa + empresa activa + permiso + entitlement vigente + recurso del tenant. RLS y FKs compuestas protegen la base; service_role jamás se expone a cliente.
- `/super-admin/soporte` es vista diagnóstica auditada, **solo lectura**, con actor real y plazo máximo 15 min; prohíbe navegar o escribir en rutas operativas mientras esté activa. NO es autenticación real del sujeto ni una función «operar como» completa.
- Migración 011 requiere 010 y preflight real de Supabase; no afirmar que hay membresías/permisos seguros o suplantación operativa hasta integrar RLS y ejecutar E2E.

## PETS C13: migración multiempresa sin fuga de datos
- Ninguna ruta PETS nueva usa public.usuarios.empresa_id como única autorización; el contexto es un UUID empresa validado con sesión real, licencia y permiso mediante public.core_pets_tenant_access.
- Ninguna consulta PETS con getSupabaseAdmin()/service_role omite el filtro empresarial .eq('empresa_id',ctx.companyId). En comprobaciones de lectura se validan los resultados con ensureTenantRows. Filtrar un botón o un menú NO es autorización.
- Las rutas C13 bajo /portal/empresa/[id]/pets/* son SOLO LECTURA y requieren la bandera CORE_PETS_MULTI_TENANT_READ_ENABLED=true tras instalar y validar 010/011/012 con RLS A/B.
- Mantener el flag apagado por defecto. NO habilitar segundo tenant, writes, exports ni consultas antiguas hasta completar C14/C15/C16 y la prueba de regresión PostgreSQL.
- Revisar cualquier política nueva junto con las políticas permisivas existentes: PostgreSQL puede unirlas por OR. El despliegue de 012 debe fallar si identifica políticas de terceros desconocidas.
- Fuente del plan, preflight y casos E2E: docs/MIGRACION_PETS_MULTIEMPRESA.md.

## Regla transversal OBLIGATORIA — Unificación y operación multisede (UNI-001)
- **Fuente normativa:** `docs/UNIFICACION_MULTISEDE.md`. Toda nueva vertical, complemento, API, integración, migración o interfaz debe cumplirla. Core SaaS reemplaza la necesidad de tener software aislado por sede: **una empresa, una plataforma, varias sedes y registros maestros compartidos**, con control de acceso real.
- `empresa_id` delimita el tenant y el aislamiento entre clientes; `sede_id` señala una ubicación operativa dentro de ese tenant. Una sede NUNCA es una empresa nueva, una licencia de producto independiente, un segundo login o una copia de tablas. Crear sede no crea duplicados de mascotas, propietarios, clientes, productos, proyectos o usuarios.
- El contexto de autorización es: sesión real → membresía de empresa → producto/módulo licenciado → permiso específico → sede(s) autorizadas **si la operación las requiere** → recurso de la misma empresa. Un filtro o selector de sede no sustituye autorizaciones del servidor ni RLS.
- Lecturas de maestros compartidos pueden ser de **toda la empresa** cuando el permiso concedido lo permita. Los usuarios autorizados a A+B consultan desde ambas sedes la misma ficha e historial; pueden filtrar A, B o «Todas». Las escrituras operativas de sede deben indicar UNA sede autorizada y conservar su procedencia y autor.
- Los maestros se identifican por UUID/clave empresarial, **no por (empresa,sede)**. Evitar duplicados al trasladar atención entre sedes con constraints por empresa, lookup normalizado e idempotencia transaccional. No fusionar automáticamente identidades ambiguas ni mezclar registros entre empresas distintas.
- Inventario, agenda, caja, órdenes y movimientos pueden tener saldo/horario por sede, sin duplicar sus catálogos maestros. Los traslados entre sedes son movimientos auditados, no nuevas fichas o cantidades fantasma.
- **PETS legado:** `mascotas.fuente` y `propietarios.fuente` son texto histórico utilizado para mostrar sede; NO es una entidad de sede ni permiso. `SEDE NORTE/SUR` sigue fijo en catálogos y SQL 006/009; migrarlo por empresa con preflight/conciliación, sin reemplazos destructivos ni habilitar nuevas sedes todavía.
- Antes de entregar cualquier feature: documentar si cada dato es maestro de empresa, evento/recurso de sede o global transversal; definir deduplicación, permisos por sede, filtro consolidado, estado offline/concurrencia, pruebas A/B y A/B-sedes; actualizar plan y bitácora.
- **Estado:** principio obligatorio DEFINIDO, NO IMPLEMENTADO aún como modelo de tablas `core.sedes`. Jamás afirmar que las sedes dinámicas, grants, RLS o la deduplicación están funcionando hasta probarlas en Supabase.

## Rollout C19 — Multisede/PETS y arquitectura INVENTORY
- Fuente normativa de INVENTORY: `docs/modules/INVENTORY_PLAN.md`. El módulo es transversal y comparte empresa/sede/maestros; no crear esquema/tabletas de inventario ni endpoints hasta completar fase I0 y autorizar implementación.
- SQL 013 crea catálogo `core.sedes`, grants de sedes, procedencia conservadora y RPC autorizadas; el bundle para **una ejecución atómica** en STAGING es `supabase/deploy/CORE_UNA_EJECUCION_STAGING.sql`, NO está probado en Supabase real, NO es automáticamente seguro en producción ni apto para Core instalado parcialmente.
- Activación exige preflight 001–009 y esquema existente, backup restaurable, PostgreSQL staging, pruebas JWT/RLS A/B de empresa/sede y validación de regresiones PETS.
- Nuevas vistas por tenant, historial multi-sede y exportaciones requieren `CORE_PETS_MULTI_TENANT_READ_ENABLED=true` después de validación, OFF por defecto. Las escrituras clínicas C15 y eliminación de dependencia legacy C16 **aún no están migradas**. No permitir que un mensaje de entrega afirme «solo falta SQL» hasta que esos flujos tengan pruebas E2E.

## C21 — Reglas aprobadas PETS + INVENTORY
- Estado por hitos, pruebas y decisiones **DEC-001–007** en `docs/SEGUIMIENTO_EJECUCION_PETS_INVENTORY.md`; actualizar seguimiento, PLAN_DESARROLLO.md y BITACORA.md con cada avance. No crear nuevas ramas: desarrollo para trabajar, main estable.
- Cinco clasificaciones estándar **iniciales** (Producto, Medicamento, Vacuna, Desparasitante, Insumo), ampliables por Super-Admin global. Diferenciar de tags personalizados por empresa y subcategorías propias de Producto. Nunca cerrar categorías en enum rígido que impida crecer.
- SKU **único por empresa**, compartido entre sedes. Existencias por sede/bodega/ubicación provienen del ledger, nunca contador independiente editable.
- Compras y ventas NO actualizan stock automáticamente por ahora; entradas, salidas y ajustes se hacen con movimiento MANUAL autorizado/auditado. Integración futura con venta exige idempotencia y evitar doble descuento.
- Formularios clínicos PETS guardan referencia a artículos incluso con stock CERO, y NUNCA disparan venta, reserva o consumo por seleccionar. «Sin inventario» no implica cambio de stock ni pantalla comercial.
- El usuario confirmó ejecución correcta 001–013 en Supabase; **no equivale a pruebas reales JWT/RLS/postcheck**, ni confirma que 014/015 estén aplicadas.

