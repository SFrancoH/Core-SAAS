# UNI-001 — Principio de unificación y operación multisede de Core SaaS

**Estado: REGLA ARQUITECTÓNICA OBLIGATORIA / DISEÑO DE DESTINO.** Este documento no declara que las tablas, políticas RLS o pantallas multisede ya estén implementadas. Toda implementación requiere preflight, migración versionada, pruebas con datos reales de staging y despliegue controlado.

## 1. Propuesta de valor: una sola plataforma
- Una empresa con una o muchas sedes utiliza **un solo Core SaaS, una identidad de usuarios, un registro maestro por entidad de negocio y una fuente de verdad**. No se crea un segundo software, repositorio, base de datos, cliente, mascota, proyecto o producto para operar otra sede.
- Las verticales (PETS, PULSE y futuras) y complementos (inventario, agenda, facturación, reportes, integraciones) comparten empresa, identidad, sedes y permisos. Cada dominio conserva su responsabilidad; unificación **no** implica mezclar tablas clínicas con boletas, ni replicar datos de otro módulo.
- La licencia/contratación nace de la empresa y sus productos/módulos habilitados. Un nuevo establecimiento no obliga a contratar, autenticar o administrar **otra instancia independiente** de la plataforma. Podrán existir límites comerciales por cantidad de sedes si el plan los define, sin separar los datos o el software.
- Un usuario autenticado cambia de empresa únicamente si pertenece a varias empresas. Dentro de una empresa, selecciona una sede o «Todas las sedes» cuando sus permisos lo permitan, **sin cerrar sesión ni cambiar de sistema**.

## 2. Jerarquía canónica y vocabulario
```text
auth.users (identidad global)
  -> core.memberships (usuario ↔ empresa; roles/permisos/licencias)
    -> public.empresas (tenant; frontera máxima de datos)
      -> core.sedes (0..N sedes de UNA empresa)
      -> core.membership_sedes / grants (usuario ↔ sedes autorizadas)
      -> registro maestro de la empresa (mascotas, propietarios, contactos,
         proyectos, productos, proveedores y otras entidades según dominio)
      -> transacciones y recursos operativos asociados a sede cuando corresponda
         (consultas, turnos, stock físico, caja, movimientos, órdenes, etc.)
```
- **Empresa (`empresa_id`):** frontera de aislamiento jurídico y de datos. Nunca usar sede como sustituto de empresa. Un usuario puede pertenecer a varias empresas, pero sus datos no se mezclan automáticamente.
- **Sede (`sede_id`):** ubicación/unidad operativa subordinada a una empresa. Tiene UUID interno, nombre/código legible único **dentro de esa empresa**, estado, información operativa y auditoría. No exige una nueva cuenta Auth ni nueva base de datos.
- **Registro maestro:** identidad de negocio que pertenece a una empresa, no a una sede. Ej.: mascota `id`, propietario `id`, SKU de catálogo. Su origen en A no limita su existencia a A.
- **Evento/operación:** conserva `empresa_id`, `sede_id` operativo (cuando aplique), actor, fecha/hora e identificadores de recursos. La sede del evento es histórica; no reescribirla porque después se atiende en otra sede.
- **Origen, sede de atención y sede habitual** son conceptos distintos. Una mascota puede tener visitas en A y B sin duplicarse ni cambiar de identidad. No confundirlos con `fuente` histórica.

## 3. Modelo propuesto de datos y relaciones (NO DDL aplicado)
- `core.sedes`: `id uuid`, `empresa_id uuid` FK a `public.empresas`, `codigo`, `nombre`, `activa`, campos operativos necesarios y auditoría. UNIQUE `(empresa_id,codigo_normalizado)` y UNIQUE `(empresa_id,id)` para FKs compuestas. La empresa determina qué sedes existen, no un catálogo fijo para todas.
- `core.membership_sedes` o conjunto equivalente de grants: membresía N:M a sedes de la **misma empresa**; modo explícito «todas las sedes autorizadas» versus selección de `sede_id`. Concesiones de sede son independientes del rol Core y de la licencia del módulo.
- Tablas de operación por sede: `empresa_id` siempre obligatorio; `sede_id` FK compuesta a `(empresa_id,id)` de `core.sedes` cuando el proceso pertenece a una sede. `UNIQUE` y otras relaciones compuestas deben impedir vincular recursos de empresas distintas.
- Entidades maestras globales de empresa NO tienen una sede como parte de su PK o UNIQUE de identidad. Si necesitan registrar sede de creación, usar campo de **procedencia**; para disponibilidad en varias sedes, usar asociación N:M explícita o derivarla de operaciones.
- Implementación gradual: mantener IDs actuales de PETS, diseñar migración de `fuente` legado, prevenir colisiones y duplicados, NO borrar ni mover registros automáticamente. Las tablas Core multisede todavía son propuesta, no presentes en Supabase verificado.

## 4. Visibilidad, permisos y búsqueda
- Autorizar en este orden: usuario autenticado → empresa activa/membresía → licencia → permiso de vertical/complemento → sede solicitada **si aplica** → recurso y su empresa. Validación en servidor/RLS, nunca solo ocultar UI o filtrar en cliente.
- Un veterinario con permiso de lectura clínica **para toda la empresa** puede buscar cualquier mascota y revisar su historial de A y B, aunque atienda físicamente en una sede. «Todas las sedes» permite buscar y obtener vistas consolidadas.
- Si se concede acceso limitado a ciertas sedes, las acciones sobre inventario, agenda, caja y demás recursos de sede solo pueden operar allí. La lectura clínica compartida, cuando se habilite, tiene un permiso explícito de alcance empresa; no conceder datos sensibles por una relación de sede implícita.
- El filtro de sede **no fabrica ni duplica** entidades. El identificador de mascota/propietario sigue siendo el mismo; un filtro puede limitar eventos/consultas según `sede_id`, mientras la ficha maestra sigue perteneciendo a la empresa.
- El contexto elegido de empresa/sede puede viajar en URL o estado del servidor como **petición**, nunca como autorización. Toda API comprueba membership, permiso y la pertenencia de cada sede/recurso; service_role requiere comprobación previa y filtro explícito.
- Para operaciones que requieren una sola sede (consulta, movimiento de caja/stock, cita) se debe escoger una sede autorizada. «Todas» sirve para lectura/reportes y no es un destino válido de escritura.

## 5. Identidad, deduplicación e historial
- **Una mascota = un registro maestro por empresa** con UUID estable. Su carnet es identificador alternativo con UNIQUE por empresa (actualmente existe en PETS), no PK global ni llave que cambie según sede. Una misma mascota atendida en A y B mantiene dueño(s), ficha e historial.
- **Un propietario = un registro maestro por empresa**; documento normalizado es clave fuerte de coincidencia cuando exista y sea confiable; teléfono puede ser pista secundaria y necesita validación para evitar fusionar personas distintas. No crear otro propietario por cada sede ni hacer merges automáticos basados solo en nombre/teléfono.
- Al registrar una consulta en B: buscar la mascota en toda la empresa según permisos, seleccionar el mismo `mascota_id`, crear un **nuevo evento** con `sede_id=B`, médico y fecha. No clonar mascota ni reescribir la sede histórica de eventos de A.
- La deduplicación debe ser transaccional: constraints en DB, búsqueda de identidad normalizada, comportamiento idempotente en integraciones y un proceso de conciliación/auditoría para duplicados anteriores. Ante coincidencias ambiguas, revisión humana antes de fusionar.
- Nunca deduplicar automáticamente entre empresas distintas, aunque compartan número, correo, documento o nombre: la frontera de privacidad es `empresa_id`.

## 6. Regla para cada módulo y vertical
| Dominio | Compartido por empresa | Lo que se registra/filtra por sede | Regla de unicidad y operación |
|---|---|---|---|
| PETS | Mascotas, propietarios, historial longitudinal, catálogos clínicos | Sede que atendió consulta, agenda, profesional/turno | Ficha única; la consulta registra sede y actor, sin duplicar la mascota |
| PULSE | Empresa, proyecto y boletas; clientes/usuarios según su dominio | Oficina, punto de venta, vendedor o actividad presencial si existe sede | Una boleta es única por proyecto, NO por sucursal; no duplicar el proyecto al operar en otra sede |
| Inventario | Productos/SKU, unidades, proveedores | Existencias por almacén/sede, reservas, ajustes y traslados | Misma referencia SKU; stock NO se suma como si estuviera físicamente en todas las sedes. Transferencias auditadas/atómicas |
| Agenda | Contactos, profesionales y configuración aplicable | Sede, recurso/consultorio, disponibilidad y citas | No permitir doble reserva de recurso/profesional en horarios incompatibles entre sedes |
| Facturación/caja | Catálogo, cliente y entidad legal de la empresa | Emisión, caja, turno/sede de operación cuando proceda | Documentos únicos según numeración fiscal/serie aplicable; no inventar obligaciones fiscales comunes |
| Analítica/reportes | Indicadores consolidados de toda la empresa | Desglose A, B, todas; filtros consistentes | Agregaciones sin duplicar entidades maestras ni transacciones |
| Integraciones | Configuración y credenciales por empresa | Sede operativa si el evento corresponde a una | Un evento lleva companyId + siteId cuando aplica, clave idempotente y validación de origen |
- Las verticales nuevas deben clasificar cada tabla y función como «maestro de empresa», «operación de sede» o «transversal global» y documentar las excepciones antes de construirlas.

## 7. Brecha real de PETS y plan de transición
- En PETS, la migración `005_fuente_sede.sql` creó `public.mascotas.fuente` y `public.propietarios.fuente` **como texto**, y `lib/verticals/pets/sede-display.ts` lo presenta como sede. Esto NO es una tabla de sedes ni permiso de acceso por sede.
- `lib/verticals/pets/pet-catalogs.ts` define `SEDE NORTE` / `SEDE SUR` en un arreglo; las migraciones `006_registro_directo_y_tamano.sql` y `009_asociar_propietario_mascota.sql` también validan esos textos. Estas reglas rígidas deben sustituirse por catálogo de sedes por empresa ANTES de habilitar sedes configurables.
- Evitar migrar `fuente` a `sede_id` por simple texto sin mapear empresa y resolver ambigüedades. Mantener el valor legacy como procedencia para compatibilidad, construir relación nueva y verificar filas con nombre desconocido, nulo o incoherente.
- Las constraints actuales de carnet `(empresa_id, lower(numero_carnet))` y documento del propietario por empresa constituyen un buen punto de partida; **no** introducir `sede_id` en esas claves porque permitiría duplicar la misma entidad entre A y B.
- Fase de producto: catálogo de sedes → grants de usuario por sede → selector/filtros → transacciones con sede → migración de consultas, agenda, inventario e integraciones → conciliación de duplicados históricos. Todo sujeto al contexto multiempresa C13-C16 y pruebas de datos reales.

## 8. Pruebas obligatorias de aceptación
1. Empresa E con A/B: usuario autorizado busca la misma mascota en ambas sedes y recibe **un único ID**, sus propietarios asociados y consultas cronológicas de A/B.
2. Registrar consulta en B de una mascota originada en A: se agrega evento B al historial común, conserva creador/fecha/sede original de eventos en A, sin insertar otra mascota.
3. Filtrar «A», «B» y «Todas»: cada consulta/evento aparece en el filtro correcto; el consolidado no suma la mascota dos veces.
4. Admin crea sede C: no crea nueva empresa, usuarios Auth, vertical/licencia ni tablas clínicas nuevas; el selector incorpora C si se tiene acceso.
5. Usuario autorizado a A pero no B no modifica stock/caja/agenda B por UI, URL ni API. Usuario autorizado a A+B puede operar ambas y la operación queda auditada.
6. Empresa X distinta de E nunca lee, deduplica ni modifica entidades de E aunque nombre/documento/carnet coincidan.
7. Dos altas concurrentes de una mascota/propietario de E no crean duplicado; el segundo intento reutiliza o reporta conflicto sin pérdida de historial.
8. Transferencia de inventario A→B registra salida/entrada balanceada sin duplicar stock; agenda detecta solapamientos del profesional cuando atiende en A y B.
9. Revocar permiso/empresa/sede/licencia impide acceso de inmediato; consultas SQL/RLS y APIs fallan cerradas.
10. Probar retrocompatibilidad de valores `fuente` existentes en PETS; no borrar registros ni asignar masivamente sedes sin trazabilidad.

## 9. Decisiones NO implementadas
- No se han creado tablas `core.sedes` ni grants de sede; no se ha ejecutado SQL sobre Supabase.
- No se modificaron registros, restricciones, lógica de consulta, rutas, facturación ni inventarios existentes. Son requisitos para próximos PR y migraciones reales.
- No se define en este documento una tarifa por sede, restricciones legales por país ni una estrategia de fusión automática entre empresas.

## Avance C19: sedes centrales preparadas (no aplicadas)
`supabase/migrations/013_core_sedes.sql` define catálogo Core, grants por membresía, mapeo conservador de `fuente`, control de sede y auditoría; **no se ha ejecutado en Supabase**. Los usuarios autorizados podrán consultar historial por sede y exportar maestros desde rutas Core aisladas tras el feature flag, pero las operaciones clínicas legacy seguirán sujetas a C15/C16. No se duplica ninguna entidad maestra. El plan de Inventario como complemento UNI-001 está en `docs/modules/INVENTORY_PLAN.md`.
