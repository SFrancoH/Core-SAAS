# SEGUIMIENTO — PETS y módulo INVENTORY (Core SaaS)

**Inicio:** 2026-10-19. **Código:** rama `desarrollo` (única de trabajo), rama `main` estable.
**Fuentes:** [Plan integrado](PLAN_EJECUCION_PETS_INVENTORY_2026_10.md) · [Inventario I0–I9](modules/INVENTORY_PLAN.md) · [Fuente PETS](especificaciones/ESPECIFICACION_FORMULARIOS_PETS.md) · [Bitácora](../BITACORA.md).
**Norma:** este archivo registra el ESTADO ACTUAL. El texto cronológico antiguo de la bitácora documenta la situación de su fecha original; una entrada antigua que diga «013 no aplicada» no invalida esta actualización.

## Estados de seguimiento
PENDIENTE = no iniciado; EN ANÁLISIS = definición incompleta; EN DESARROLLO = código preparándose; IMPLEMENTADO EN GIT = no implica base aplicada; SQL EJECUTADO (REPORTE USUARIO) = usuario confirma ejecución sin prueba directa aquí; VALIDADO STAGING = SQL + RLS JWT y E2E verificadas con entorno; LISTO MAIN = revisión/aprobación; DESPLEGADO = verificación del entorno final. Usar evidencia; CI verde no implica validación Supabase.

## Estado de SQL (2026-10-19)
| Migración | Estado | Próxima verificación |
|---|---|---|
| 001–012 | **Ejecutadas manualmente sin errores, según usuario** | Preflight/postcheck, backup y aislamiento real |
| 013_core_sedes.sql | **Ejecutada manualmente sin errores, según usuario** (tras corrección 42601) | Comprobar tablas, RPC, constraints y RLS empresas/sedes; entorno de DB no especificado |
| 014_core_license_admin.sql | **No confirmada** | Verificar existencia ANTES de ejecutar; depende de Core existente |
| 015_pulse_core_schema.sql | **No confirmada; independiente de PETS** | No afectar PULSE productivo ni ejecutar por inferencia |
| INVENTORY y diez formularios nuevos | **No existe SQL implementado ni aplicado** | Diseñar nueva migración y pruebas tras E0/E1 |

**No ejecutar nuevamente 001–013 ni bundle 010–013** por rutina. SQL futuro se mantiene versionado y lo ejecuta manualmente el usuario con preflight y rollback.

## Decisiones vinculantes (usuario, 2026-10-19)

| ID | Definición aprobada | Comprobación obligatoria |
|---|---|---|
| DEC-001 | Las clasificaciones **iniciales** son **Producto, Medicamento, Vacuna, Desparasitante, Insumo**. El administrador global de Core podrá agregar otras clasificaciones para nuevos negocios. **No son los tags personalizados** de cada usuario/empresa ni las subcategorías Producto | Catálogo estándar ampliable sin alterar código ni renombrar los cinco códigos base; solo Super-Admin autorizado; tags libres no aparecen como clases de los selectores clínicos |
| DEC-002 | **SKU único por empresa**, compartido por todas las sedes; mismo artículo / ID | SKU-0012 Dogshow: sede A **25**, sede B **45**, consolidado **70**. Ninguna ficha duplicada. Otra empresa puede usar SKU-0012 con aislamiento |
| DEC-003 | Existencia por sede deriva de **bodegas, posiciones y movimientos**; no hay segundo contador independiente | A/B/total cuadran con ledger; alta y ajustes usan movimiento con actor, sede, ubicación |
| DEC-004 | **Descuento de stock manual** en la etapa actual. Las compras y ventas NO crean movimientos automáticos; automatizar venta/descuento será integración posterior | Guardar venta no descuenta; salida explícita manual sí; integración futura no descontará dos veces |
| DEC-005 | Seleccionar artículo en formulario clínico **NO es consumo ni venta** | Servicio registra artículo vinculado pero no crea entrada/salida/reserva |
| DEC-006 | Formulario clínico permite seleccionar artículo aun con **stock 0** (incluyendo sede con cero) | Selector no filtra por cantidad disponible ni bloquea guardado; stock no cambia |
| DEC-007 | Texto «sin inventario» **sin proceso asociado por ahora** porque aún no hay flujo de venta de producto | No crear interruptor, venta, movimiento o descuento por ese texto |

**Interpretación de permisos para DEC-001:** en este MVP «yo como admin» se implementaría mediante **Super-Admin global** de Core, no un Admin de empresa que pudiera cambiar el estándar para todos. Delegaciones futuras quedan para otra decisión. Implementar clasificaciones como tabla global con códigos inmutables, no SQL ENUM cerrado; categorías nuevas no generan selectores PETS automáticamente. Los tags siguen siendo catálogo libre por empresa.

**Diferencia clave DEC-004/006:** selección clínica con stock 0 es posible porque NO altera saldo. Una SALIDA MANUAL real debe validar disponibilidad, ubicación, lote, caducidad y permiso; mantener ledger inmutable, transacciones e idempotencia. Venta y salida manual son eventos diferenciados y, si se asocian, no se contabilizan dos veces.

## Orden obligatorio y seguimiento

| Orden | Fase | Estado actual | Entregable / evidencia de cierre |
|---|---|---|---|
| 00 | **E0 / I0 — Cerrar reglas** | EN ANÁLISIS, DEC-001–007 aprobadas | Acordar cardinalidad de clasificación, SKU obligatorio/formato, unidades/conversiones, stock inicial por sede-bodega-lote, movimientos manuales, stock negativo y pendientes clínicos |
| 01 | **E1 — Core + PETS C14–C16** | EN DESARROLLO (postcheck SQL preparado; no ejecutado) | Postcheck 013/estado 014; permisos/licencias, JWT RLS empresas A/B y sedes A/B, GET/export, Server Actions, login multiempresa y regresión |
| 02 | **E2 — Contratos y UX** | PENDIENTE | Tipos TS para clasificaciones, tags, SKU, existencias, clínica, licencias; especificaciones de los 10 formularios; pruebas |
| 03 | **E3 — SQL incremental** | PENDIENTE | Diseño de inventory.* y servicios PETS; migration SQL, FKs compuestas, RLS, preflight/postcheck en staging y respaldo |
| 04 | **E4 — Catálogo INVENTORY** | PENDIENTE | CRUD empresas, clasificación dinámica Super-Admin, tags distintos, subcategorías Producto, SKU único empresa, imagen, ficha popup, totales por sede |
| 05 | **E5 — Motor manual de stock** | PENDIENTE | Apertura, entradas, salidas manuales, transferencias, ajustes, lotes/FEFO/FIFO, ledger, concurrencia/idempotencia |
| 06 | **E6 — Movimiento / Compras / Ventas** | PENDIENTE | Tres vistas con fecha, responsable real, cantidad/proveedor/propietario/total, movimientos MANUALES separados de registro comercial |
| 07 | **E7 — Componentes PETS** | PENDIENTE | Identidad paciente/sede, adjuntos seguros, filas de medicamentos/insumos, selección dinámica por clase con stock 0 |
| 08 | **E8 — Diez formularios** | PENDIENTE | Diez formularios fieles a fuente, relación clínica, historial, permisos/sede, sin nuevos campos inferidos |
| 09 | **E9 — Vinculación clínica con Inventario** | PENDIENTE | Relaciones ID artículo, snapshot histórico, cero consumo/venta/reserva al registrar servicio |
| 10 | **E10 — Operación avanzada** | PENDIENTE | Semáforos stock/vencimiento, JIT, búsqueda ubicaciones, informes, proveedores y pruebas |
| 11 | **E11 — Validación y promoción** | PENDIENTE | E2E multiempresa/multisede, concurrencia, restauración, permisos, CI, piloto y autorización explícita main |

**Instrumento E1 de lectura:** `supabase/design/POSTCHECK_CORE_013_SEDES_READONLY.sql` (archivo creado en Git, **no ejecutado**). Ejecutarlo manualmente en Supabase, revisar salida y luego JWT/RLS antes de habilitar flujo multiempresa.

**Próximo trabajo concreto:** E1: verificación del SQL 013 real, estado 014, auditoría C14 GET/export → C15 escrituras/consultas → C16 roles/perfil multiempresa. E2 se puede diseñar en paralelo sin activar endpoints de escritura mientras falten controles de seguridad.

**Fuera del MVP:** POS y descuento automático por venta, compras automáticas, web comercial; requieren otra integración formal, triggers, reversión e idempotencia. No activarlos por seleccionar artículo o completar un formulario clínico.

## Historial de ejecución / evidencia incremental

| Fecha | Hito | Código / SQL | Evidencia disponible | Resultado | Pendiente |
|---|---|---|---|---|---|
| 2026-10-19 | 001–013 | SQL Editor manual usuario | Confirmación explícita usuario «013 ya quedó ejecutado sin errores»; 001–012 confirmadas en turnos anteriores | SQL EJECUTADO (REPORTADO) | RLS/JWT A-B, postcheck real, entorno, backup, 014 |
| 2026-10-19 | DEC-001–007 + E0 parcial | Esta matriz / plan Git | Reglas expresas comunicadas por usuario | DOCUMENTADO | E0 residual; registrar SHA CI del cambio en BITACORA |


| 2026-10-19 | Postcheck 013: corrección sintaxis | `supabase/design/POSTCHECK_CORE_013_SEDES_READONLY.sql` · commit `3377224` | Error SQLSTATE 42601 en alias reservado `constraint`; sustituido por `nombre_constraint` | CORREGIDO EN GIT; **sin resultado de Supabase todavía** | Ejecutar postcheck completo en SQL Editor, conservar sus 8 juegos de resultados, validar RLS/JWT A/B |
| 2026-10-19 | Auditoría inicial C14 | Rutas `app/api/export/{mascotas,propietarios}`, `app/mascotas/page.tsx`, `app/api/core/empresas/[id]/pets/export/mascotas` | Legacy usa `profile.empresa_id` y super_admin puede exportar transversalmente; rutas Core ya requieren `requirePetTenant` | BRECHA IDENTIFICADA; sin refactor funcional aún | Migrar enlaces/GET/export hacia rutas Core autenticadas por tenant, eliminar exports globales sin propósito explícito y probar joins por empresa/sede |

**Protocolo obligatorio por entrega:** elegir 1 hito; leer fuente/código/migraciones actuales; registrar alcance y contrato; crear cambios TypeScript/SQL versionados en desarrollo; ejecutar `npm ci`, `npm test`, `npm run typecheck`, `npm run build`; verificar DB staging si corresponde; documentar resultado, fecha, entorno, SHA, PR y pruebas en **este archivo, PLAN_DESARROLLO.md y BITACORA.md**. No tocar main hasta los criterios.
