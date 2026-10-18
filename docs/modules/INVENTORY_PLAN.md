# INVENTORY — Plan maestro del complemento transversal de Inventario

**Estado:** DEFINIDO / PLANIFICADO. **No se implementan tablas, endpoints, frontend ni movimientos de Inventario en esta entrega.** Este documento transforma el alcance aportado por el propietario en un plan de desarrollo verificable, sin confundir requisitos originales con decisiones técnicas recomendadas.

**Reglas superiores:** \`AGENTS.md\`, \`docs/UNIFICACION_MULTISEDE.md\`, \`docs/ARQUITECTURA.md\`, \`docs/MODELO_DATOS_PERMISOS_LICENCIAS.md\` y \`docs/IDENTIDAD_ACCESO_MULTIEMPRESA.md\`.

## 1. Propósito y límites

**Alcance aportado:** varias bodegas, ubicaciones de altillaje (pasillo/rack/nivel/casilla), proveedores N:M con productos y costos propios, tags, lotes/caducidad, semáforos de stock y vencimiento, reorden JIT, búsqueda multi-criterio, formularios de productos y movimientos, FEFO/FIFO, bloqueo de stock insuficiente, posibilidad configurable de stock negativo.

**Principio UNI-001 (obligatorio):** **una empresa, un solo módulo Inventario**, aunque tenga varias sedes, bodegas y verticales. Los mismos productos, proveedores y categorías se reutilizan en PETS, PULSE y otros módulos habilitados. Las existencias se desglosan por sede → bodega → ubicación y lote. Una transferencia no duplica el producto ni sus unidades disponibles agregadas.

**No incluido en el primer entregable funcional:** compras y facturas contables/fiscales completas, ventas/POS, descuentos automáticos, pedidos automáticos a proveedores, valoraciones contables complejas, seriales individualizados, dispositivos IoT, cross-docking, sincronización offline con resolución de conflictos y trazabilidad de cadena de frío. Se definirán como interfaces/extensiones, no se prometerán ya implementados.

## 2. Jerarquía de propiedad, ubicaciones y datos maestros

\`\`\`text
auth.users ── membresía/grants ──> public.empresas (tenant)
                                    |
                          core.sedes (0..N)
                                    |
                          inventory.bodegas (0..N por sede)
                                    |
                          inventory.ubicaciones (pasillo/rack/nivel/casilla)
                                    |
                          inventory.existencias (producto/lote/ubicación)

EMPRESA ──> inventory.productos (SKU único por empresa)
        ├─> inventory.proveedores (empresa, N:M productos)
        ├─> inventory.etiquetas (N:M productos)
        ├─> inventory.lotes (producto + código; fecha caducidad)
        └─> inventory.movimientos + líneas + asientos inmutables
\`\`\`

**Decisión técnica propuesta:** esquema PostgreSQL separado \`inventory\` bajo el mismo proyecto Supabase; \`empresa_id uuid\` en **todas** las tablas operativas y FKs compuestas que impidan asociar ubicaciones/lotes/productos de otra empresa. No crear \`inventory.empresas\`, \`inventory.usuarios\` ni \`inventory.sedes\` redundantes. El producto es maestro empresarial y **no pertenece exclusivamente a una bodega**.

**Bodega ≠ sede ≠ ubicación.** Una sede puede tener cero o varias bodegas; una bodega pertenece a una sede (decisión inicial; documentar bodega externa o compartida cuando exista caso real), y las posiciones internas corresponden a esa bodega. El altillaje es direccionamiento discreto de posiciones, no medidas físicas en milímetros; dimensiones reales se incorporan como campos aparte si hacen falta.

## 3. Modelo lógico y restricciones propuestas (NO SQL aplicado)

| Entidad | Campos/restricciones esenciales | Consideraciones |
|---|---|---|
| \`inventory.bodegas\` | \`id uuid\`, \`empresa_id uuid\`, \`sede_id uuid\`, \`codigo\`, \`nombre\`, \`es_principal\`, \`activa\`, timestamps | Código único por empresa; FKs compuestas sede-empresa; **a lo sumo una principal por empresa** (o por sede si se decide; pendiente). No eliminar con movimientos. |
| \`inventory.ubicaciones\` | \`id\`, \`empresa_id\`, \`bodega_id\`, \`pasillo\`, \`rack\`, \`nivel\`, \`posicion\`, \`codigo_completo\`, \`estado\` | \`UNIQUE(empresa_id,bodega_id,pasillo,rack,nivel,posicion)\`; normalizar segmentos/códigos para que no colisionen por guiones, espacios, mayúsculas o cambios del código de bodega. Código completo derivado, no identificador primario. |
| \`inventory.proveedores\` | \`id\`, \`empresa_id\`, \`nombre_empresa\`, \`nit_rut\`, contactos, \`lead_time_dias\`, \`activo\` | Normalizar NIT/documento por tipo y país; índice por empresa, tratamiento de PII y duplicados. Plazos promedio medidos por órdenes reales en el futuro. |
| \`inventory.productos\` | \`id\`, \`empresa_id\`, \`sku\`, \`codigo_barras\`, \`nombre\`, \`descripcion\`, \`unidad_medida\`, flags lote/caducidad, mínimos/máximos de referencia, \`activo\` | \`UNIQUE(empresa_id,sku_normalizado)\` (no global). Barcode único por empresa **si el catálogo exige una única coincidencia**; excepciones de empaques/alias con tabla de códigos. \`controla_caducidad => controla_lotes\`. |
| \`inventory.producto_proveedores\` | \`producto_id\`, \`proveedor_id\`, \`empresa_id\`, \`sku_proveedor\`, \`costo_compra\`, \`moneda\`, \`principal\`, vigencia | FK compuestas; UNIQUE producto/proveedor; máximo un proveedor principal por producto activo. Costo por proveedor como referencia; congelar costo real en recepción para históricos. |
| \`inventory.etiquetas\` / \`producto_etiquetas\` | ID, empresa, nombre normalizado, color desde tokens/paleta aceptada; pivote empresa/producto/tag | Etiquetas globales de empresa, no copiadas por sede. Las políticas de caducidad pueden heredar defaults por etiqueta con prioridad explícita. |
| \`inventory.lotes\` | ID, empresa, producto, código de lote, fabricación, caducidad, estado calidad | \`UNIQUE(empresa_id,producto_id,lote_codigo_normalizado)\` cuando hay código. Los lotes no son la posición física; uno puede estar repartido entre varias ubicaciones. Fecha no obligatoria para productos sin caducidad; obligatoria para \`controla_caducidad\`. |
| \`inventory.existencias\` | Empresa, producto, bodega, ubicación, lote opcional, cantidades: \`on_hand\`, \`reserved\`, \`quarantined\` (o ledger más vistas) | No usar \`NULL\` sin tratar en claves únicas; índice único por combinación exacta mediante clave de posición normalizada o \`NULLS NOT DISTINCT\` con PostgreSQL compatible. Ninguna cantidad negativa físicamente. |
| \`inventory.movimientos\` / \`movimiento_lineas\` | ID, empresa, tipo, estado, motivo, origen/destino, actor, referencia/idempotency-key, fechas; líneas por producto, lote, ubicación y cantidad decimal | Estados borrador→confirmado/anulado por compensación, no borrar movimientos confirmados. Auditoría y transacciones. |
| \`inventory.ledger\` | Asientos inmutables con empresa, ubicación, producto, lote, delta, movimiento_linea, autor, fecha, costo de recepción | Fuente de verdad de stock transaccionado. Un traslado confirmado genera salida y entrada balanceadas. Prohibido UPDATE destructivo del libro. |
| \`inventory.politicas_reposicion\` | Empresa + producto + ámbito (bodega/sede o total), mínimo, seguridad, máximo, demanda promedio, lead time efectivo, punto de reorden | Los límites globales del enunciado son defaults; la decisión de comprar se toma por ubicación de abastecimiento, sin sumar físicamente sedes sin traslado posible. |
| \`inventory.politicas_caducidad\` | Empresa; opcional producto/etiqueta; días amarillo/rojo, mínimo de vida útil para salida, tratamiento de lotes | Precedencia inequívoca: producto > etiqueta priorizada > empresa. Evitar conflictos si un producto tiene varias etiquetas. |
| \`inventory.cuarentenas\` | Empresa, lote, ubicación, cantidad, motivo, actor, resolución y fechas | Una alerta o umbral **no es** automáticamente una merma. Movimiento a cuarentena bloquea disponibilidad y exige resolución auditada. |
| \`inventory.consumos_externos\` | Fuente vertical/módulo, ID del evento externo, línea origen, empresa, clave idempotente, movimiento generado | Contrato para consumo PETS y otros módulos, evita descontar dos veces por reintento. |

**Tipos numéricos:** cantidades y costos con \`numeric\` de escala/política explícitas; nunca \`float\` para dinero ni convertir kilos/litros/dosis a unidades sin regla. Decidir \`NUMERIC(18,6)\` para cantidades y \`NUMERIC(18,4)\` para costos como **propuesta**, no imponer hasta auditar unidades/currency. Los productos pueden requerir unidades base y conversiones controladas (caja → unidades, frasco → dosis); sin eso hay riesgo de sobreventa.

**Estados del inventario:** \`on_hand\` físico, \`reserved\`, \`quarantined\` y \`available = on_hand - reserved - quarantined\`. La cantidad disponible usada por FEFO/JIT nunca incluye cuarentena. Diferenciar pedido futuro (backorder) de stock físico negativo.

## 4. Reglas de integridad y transacciones

1. Alta de producto: validación empresa, SKU/código de barras, unidad, flags, proveedores N:M, tags y proveedor principal dentro de una sola transacción. No registrar stock inicial alterando directamente el producto: utilizar movimiento de apertura.
2. Entrada: seleccionar empresa, sede/bodega autorizada, posición, producto, lote si corresponde, costo real, cantidad positiva, motivo/documento; confirmar atómicamente ledger + saldo y auditoría.
3. Salida: autorizar permiso, empresa, sede/bodega, reserva/consumo, stock **disponible**, calidad/lote y vida útil; asignar desde posiciones exactas mediante FEFO/FIFO y locks; fallar íntegramente si insuficiente. Generar movimientos e idempotency key por petición.
4. Transferencia: empresa única; origen y destino pueden ser sedes diferentes; validar ambas sedes, bodega y posiciones, descontar y agregar dentro de **la misma transacción**; no cambiar stock total empresarial y no exponer resultado parcial. Definir stock en tránsito si operación física toma tiempo.
5. Ajuste/merma: requiere permiso separado, motivo obligatorio y auditoría; nunca alterar o eliminar movimientos anteriores. Se conserva el historial físico y financiero.
6. Concurrencia: índices, constraints y locks \`SELECT ... FOR UPDATE\`/actualización condicional; dos operadores no pueden consumir simultáneamente el mismo disponible. No realizar FEFO solo en React ni ejecutar movimientos con varias llamadas HTTP independientes.
7. Idempotencia: fuente/sistema, \`empresa_id\`, \`id_evento\` y operación; reenvíos no generan doble entrada/salida. Webhooks se validan con secreto, se deduplican y se auditan.
8. Referencias siempre tienen \`empresa_id\`, FKs compuestas y validaciones de pertenencia; no mover stock cruzando empresas mediante una transferencia (es proceso comercial independiente).
9. No editar/eliminar SKU/lotes/bodegas con movimientos; usar inactivación o reconciliación autorizada. Cambios de lote/fecha con justificación y log.

## 5. Estrategia FEFO/FIFO (resolución de tu propuesta)

**Regla de negocio aportada:** lotes con caducidad salen por **FEFO**, productos sin caducidad por **FIFO**; el operador no puede saltarse un lote anterior solo por comodidad.

**Implementación propuesta:**
- FEFO: candidatos elegibles del almacén/sede/ubicación, con \`available > 0\`, no bloqueados ni caducados; ordenar por \`fecha_caducidad ASC\`, luego fecha de entrada y ID estable. La salida puede partirse en **varios lotes y posiciones**; registrar cada asignación real.
- FIFO: ordenar por fecha/capa real de entrada; si se requiere FIFO riguroso, la identidad de capas de recepción debe persistirse incluso sin lotes. No equivale a ordenar por fecha de creación del producto.
- El operador ve la ruta sugerida (picking) y el lote elegido. Cualquier excepción de FEFO/FIFO (recall, caducidad mínima exigida por cliente, lote dañado, cadena de frío, restricción de ubicación o bloqueo regulatorio) requiere criterio formal y permiso de override auditado; no imponer FEFO ciego cuando existe un lote más antiguo **no apto**.
- Antes de confirmar validar de nuevo el orden y disponibilidad **dentro de la transacción**. Escaneo de código de barras solo identifica producto; escaneo de lote/ubicación cuando aplique.
- **Stock negativo:** el enunciado lo plantea como opción. Recomendación: stock físico nunca negativo; permitir **backorder/reserva preventiva** autorizada en un registro separado, sin vender/consumir unidades que no existen ni ocultar déficit. Si se exige stock negativo por modelo comercial, decisión explícita posterior con impacto contable, permisos y pruebas, no un interruptor genérico que rompa FEFO.

## 6. Semáforo de cantidad y JIT

**Fórmula aportada:** \`punto_reorden = (consumo_diario_promedio × plazo_entrega_proveedor_días) + stock_seguridad\`.

**Decisión propuesta para límites, con prioridad crítica sobre amarillo:**
- **Rojo (crítico):** \`disponible < stock_seguridad\` o \`disponible = 0\`, según política acordada. Caso de borde \`disponible = seguridad\` requiere decisión; recomiendo \`<= stock_seguridad\` para rojo.
- **Amarillo (reorden):** \`stock_seguridad < disponible <= punto_reorden\`.
- **Verde:** \`disponible > punto_reorden\` con inventario en parámetros.
- Stock por encima de máximo muestra estado **sobreinventario** independiente, no verde indiferenciado.
- Si seguridad/reorden no están configurados o no hay consumo suficiente, mostrar \`Sin datos / No calculable\` en lugar de inventar demanda.
- El consumo diario se calcula de salidas elegibles, ventana configurable y estacionalidad/devoluciones; demanda no equivale automáticamente a todas las mermas/traslados.
- Lead time real por combinación proveedor-producto y, si aplica, sede/entrega. Un proveedor puede tener costos distintos y plazos diferentes. La sugerencia JIT indica cantidad/fecha de pedido; **no envía una orden automáticamente** en la primera versión.
- Definir ámbito del semáforo: empresa consolidada, sede, bodega y producto. El reporte global no sustituye necesidad de reordenar en B aunque A tenga stock.

## 7. Semáforo de caducidad: contradicción detectada y regla completa propuesta

**El enunciado original tiene tramos incompatibles/incompletos:** «verde = vida útil >50% (o >60 días)», «amarillo = entre 15 y 30 días», «rojo = <15 días o vencido». Deja **31–60 días** sin clasificar y compara porcentaje versus días sin criterio. Tampoco toda unidad con <15 días debe convertirse en merma automáticamente.

**Propuesta de política parametrizable por empresa/producto/etiqueta:**
- **Vencido/bloqueado:** \`fecha_caducidad < fecha_operativa\` (definir si caduca al final del día en zona de la sede). NO disponible para venta/consumo; requiere cuarentena o retiro por calidad.
- **Rojo — crítico:** de 0 a 14 días **inclusive** restantes, según umbral \`rojo_dias = 14\`. Alertar y aplicar reglas de liberación; no borrar stock ni registrar merma automática.
- **Amarillo — próximo:** 15 a 30 días **inclusive**, con \`amarillo_dias = 30\`. Proponer rotación FEFO/acción comercial opcional; descuentos requieren integración comercial y aprobación, no activación automática.
- **Verde:** más de 30 días, salvo política diferente. Si se desea aviso temprano >60 días o porcentaje de vida útil, configurar una categoría adicional \`Observación\` o una política exclusiva con precedencia definida.
- **Sin fecha / no aplica / fecha inválida:** estado separado; producto que obliga caducidad no puede ingresar sin fecha válida.
- Evaluar periódicamente por fecha de la sede, recálculo en consulta o job diario con zona horaria adecuada. Nunca usar una fecha importada sin validar y no mezclar semáforos: cada producto tiene **señal de cantidad** y **señal de caducidad** independientes.
- **Cuarentena y merma no son lo mismo:** cuarentena = bloqueo de disponible y resolución; merma = salida definitiva con motivo, responsable y costo. Si producto regulado requiere retirada inmediata, aplicar su política específica.

## 8. Formularios y experiencia de usuario (frontend Core)

### Catálogo
- \`Productos\`: tabla paginada de SKU, barcode, nombre, unidad, etiquetas, proveedores, disponible consolidado, cantidad en riesgo, alerta stock, caducidad y estado; permisos de lectura sin mostrar costos a quien carezca de permiso.
- \`Nuevo/editar producto\`: datos básicos, tags multi-selector con alta controlada, switches lote/caducidad, límites referencia y tabla de proveedores repetible (proveedor, SKU externo, moneda, costo, lead time opcional, principal).
- Cambiar \`controla_lotes\` o \`controla_caducidad\` con stock existente exige migración guiada/transacción, no toggle que elimine lotes.
- Barcode: EAN/UPC solo si es código autorizado/validable; un generador interno debe distinguir etiqueta interna de GTIN emitido bajo normas del organismo correspondiente. Evitar inventar un EAN empresarial válido a nivel comercial sin autorización.

### Bodegas/altillaje
- CRUD de bodegas por sede y ubicaciones normalizadas: pasillo, rack/estante, nivel/altura, casilla. Vista de ubicación \`BOD-CLO-01-P03-R12-N02-C05\`; la cadena es **derivada** y se recalcula si cambia el código legible.
- Opcional importar layout desde plantilla, validar duplicados por bodega y rangos de capacidad/temperatura si el caso requiere refrigeración.
- Visualización de saldos en ubicación; nunca permitir crear dos posiciones con el mismo código normalizado.

### Movimientos
- Documento de tipo \`Entrada/Salida/Transferencia/Ajuste/Merma/Devolución\` con origen/destino según tipo, sede, bodega, productos y cantidad. Selector de lote muestra fecha, saldo disponible, condición/calidad y posición.
- Para salidas FEFO/FIFO, mostrar propuesta de asignación por lote/ubicación; no permitir elegir manualmente un lote inadecuado salvo override autorizado.
- Para transferencias entre sedes, confirmar las dos patas y dejar trazabilidad por línea. Confirmación en servidor con resultado único, número de movimiento y ledger; sin optimismo de UI si falla.
- Estados: borrador, validando, confirmado, rechazado, compensado; auditoría de quién preparó/confirmó/corrigió.

### Buscador y filtros
- Búsqueda indexada por SKU, barcode, nombre, referencia proveedor; \`tenant_id\` proviene del contexto autenticado, no de la cadena buscada.
- Filtros combinables: sede, bodega, ubicación/pasillo/rack/nivel, etiquetas, proveedor principal, estado stock, estado caducidad, lote, estado calidad. \`Todas las sedes\` para vistas permitidas; no elegir «Todas» como destino de un movimiento.
- El consolidador suma saldos por producto evitando duplicar la misma ficha. Mostrar diferenciado \`disponible\`, \`físico\`, \`reservado\` y \`cuarentena\`.
- Paginación/filtros en PostgreSQL, no cargar todas las filas al cliente; índices adecuados y soporte para lector de códigos como teclado USB/Bluetooth.

### Perfiles y permisos (propuesta de códigos)
\`inventory.product.read\`, \`inventory.product.manage\`, \`inventory.supplier.read\`, \`inventory.supplier.manage\`, \`inventory.warehouse.manage\`, \`inventory.stock.read\`, \`inventory.stock.receive\`, \`inventory.stock.consume\`, \`inventory.stock.transfer\`, \`inventory.stock.adjust\`, \`inventory.stock.override_fefo\`, \`inventory.cost.read\`, \`inventory.policy.manage\`, \`inventory.audit.read\`.
Todos exigen membership, \`core.entitlements\` al módulo \`INVENTORY\`, empresa del recurso y grants de sede cuando aplica; usuario sin permiso de costos no puede leer costos ni por API/export.

## 9. Integración transversal con verticales

**Contrato de consumo:** PETS y otras verticales solicitan a Inventario reservar/consumir/devolver un producto por \`empresa_id\`, \`sede_id\`, referencia de evento (ej. \`consulta_id\`), \`producto_id\`, unidad/cantidad, actor e idempotency key. Inventario devuelve \`movimiento_id\` y líneas realmente consumidas con lotes/ubicaciones. La vertical NO modifica \`inventory.existencias\` directamente.

- **PETS:** administrar medicamentos, vacunas, alimentación e insumos en un catálogo compartido. En una consulta en sede B, el consumo descuenta del stock de B; el historial clínico conserva lote y trazabilidad de lote-vacuna si aplica. No duplicar mascota/cliente/producto.
- **PULSE:** solo cuando el organizador gestione insumos, premios físicos o mercancía: consumo/reserva por proyecto y sede autorizada. **No mezclar inventario con estados de boletas ni crear stock de una boleta.**
- **Facturación/POS:** un evento comercial confirmado emite pedido/consumo idempotente; si hay cancelación, devolución documentada/compensación, no borrar ledger.
- **Agenda:** opcional planificar stock para citas futuras mediante reservas con vencimiento y liberación auditada.
- **Reportes:** dimensión producto, proveedor, lote, sede, bodega, ubicación, fecha, vertical originadora; métricas sin doble contabilizar traslados.

**Aislamiento:** Core, PETS, PULSE y otros comparten **la misma identidad y empresa**, pero Inventario posee sus tablas y expone interfaces versionadas/casos de uso, no SQL cruzado por cualquier vertical.

## 10. Plan de ejecución por etapas y criterios de cierre

| Fase | Entregables mínimos | Pruebas obligatorias / criterio de aprobación |
|---|---|---|
| I0 — Discovery y reglas | Casos reales de 2 sedes/3 bodegas, catálogo de unidad/costo, políticas de caducidad, flujos PETS, matriz de permisos; decisiones abiertas firmadas | Riesgos y términos ambiguos resueltos; alcance MVP cerrado |
| I1 — Base Core | Core 010–013+ sedes/grants y módulo INVENTORY licenciado; RLS/permiso empresa/sede | JWT usuario A no lee B, A-only no puede operar B, sin licencia denegado |
| I2 — Modelo DB | SQL versionado de productos, proveedores, pivotes, tags, bodegas, ubicaciones, lotes, ledger, saldos y constraints | SQL en staging, concurrencia, FKs compuestas, claves únicas, reversión y backups |
| I3 — Catálogos | CRUD de productos, proveedores, tags, bodegas/altillaje y permisos; UI con tokens Core | SKU repetido en otra sede NO duplica producto; cambios auditan actor; costos restringidos |
| I4 — Entradas | Movimientos recepción y devolución documentados; lote/caducidad, costo real | Idempotencia, saldo/ledger coherentes, cantidad decimal, bloqueo de ubicaciones ajenas |
| I5 — Salidas y transferencias | Selección FEFO/FIFO transaccional por ubicación, movimientos A→B, cuarentena y override auditado | Concurrencia, stock insuficiente, balances origen/destino, vencidos bloqueados |
| I6 — Alertas/JIT | Semáforo stock/caducidad, configuración umbrales, consumo diario, sugerencias de compra | Límites 0/14/15/30/31, huecos corregidos, sin datos, lead time y stock de seguridad |
| I7 — Búsqueda y reportes | Filtros combinables/escáner, estado por sede/bodega/lote, consolidación | Paginación DB, índice rendimiento, sin doble conteo, filtros y permisos |
| I8 — Integración PETS | Interfaz de insumos clínicos, consumir/compensar por consulta y sede | No descuento doble, cancelación, mismos productos entre sedes, lote en historial |
| I9 — Operación | Logs, alertas, backup/restore, observabilidad, conciliación inventario físico, manuales y despliegue gradual | Pruebas E2E A/B, fallos parciales, rollback y piloto en empresa seleccionada |

**Orden:** no comenzar I2 antes de validar Core y cerrar I0. No conectar PETS I8 antes de tener movimientos I4/I5 auditados. Cada fase tiene su PR, tests CI y actualización de BITACORA/PLAN.

## 11. Escenarios de prueba imprescindibles

1. Misma empresa, dos sedes y tres bodegas: **un producto SKU**, stock distinto por bodega y consolidado correcto.
2. Otra empresa con mismo SKU/nombre proveedor: cero acceso cruzado y claves independientes.
3. Alta concurrente de mismo SKU: una ficha/una colisión válida; nada duplicado por sede.
4. Dos operadores consumen el último lote simultáneamente: solo una salida aprobada; no negativo físico.
5. FEFO con lote vencido y otro próximo: vencido no puede salir, se elige el siguiente apto; registrar posición física exacta.
6. Salida que requiere 2 lotes: líneas asignadas suman exactamente cantidad solicitada; operación atómica.
7. FIFO sin caducidad: recibe 2 capas en fechas distintas, consume primero capa antigua disponible, conservando origen.
8. Transferencia A→B concurrente: salida/entrada balanceadas y mismo saldo global antes/después, incluso ante reintentos.
9. Cuarentena: no cuenta como disponible; liberar exige resolución; merma no aparece sin movimiento.
10. Stock actual en punto reorden, en seguridad y en cero: semáforo inequívoco. No consumo histórico: estado sin cálculo, no JIT inventado.
11. Caducidad con exactamente 0, 14, 15, 30, 31, 60 días: sin huecos y con bloqueos distintos de alertas.
12. Proveedor principal único; costo histórico no cambia al actualizar costo de proveedor; referencia SKU externa no reemplaza SKU interno.
13. Barcode duplicado/ambiguo y lectura por pistola: resultados validados, sin salida accidental.
14. User A-only no puede editar stock B por UI ni request forjada; Admin sin permiso \`cost.read\` no consulta costos.
15. Integración PETS reenvía evento dos veces: un solo movimiento; consulta en B no descuenta stock A sin transferencia.
16. Desactivar lote/caducidad con stock existente requiere proceso explícito, no pérdida de registros.
17. Informe empresa consolidado y filtrado por sede: traslados no cuentan como ventas/consumos agregados de la empresa.

## 12. Decisiones de negocio pendientes antes de escribir código de Inventario

- ¿Bodega principal por empresa o por sede? **Propuesta:** por sede.
- ¿Qué productos requieren lote obligatorio, serial individual, temperatura/cadena de frío o vida útil mínima? Por vertical/etiqueta.
- ¿Cómo elegir políticas si múltiples tags tienen umbrales de caducidad distintos? Propuesta: prioridad de producto y, entre etiquetas, umbral más conservador, con precedencia auditada.
- ¿Se permite vender un lote con 1–14 días de vida útil? Diferenciar bloqueo legal/calidad vs. alerta; política explícita por producto/cliente.
- ¿Cómo calcular lead time y consumo diario para referencias nuevas/sin historial? No simular números; permitir parámetros manuales marcados como estimados.
- ¿Puede haber ventas preventivas sin stock? Propuesta: backorder separado, sin físico negativo.
- ¿Qué método contable de valuación se necesita (promedio ponderado/FIFO de costos), monedas, impuestos y costos por sede? No se infiere de FEFO físico.
- ¿Se requieren aprobaciones de mermas/ajustes, trazabilidad de lotes de vacunas, retiros por calidad y disponibilidad offline? Confirmar con casos reales.
- ¿Qué objetos del Core existente representan artículos y proveedores para evitar nuevas duplicaciones entre verticales?

## 13. Estado real y seguridad del despliegue

Esta especificación **NO crea una bodega ni descuenta inventario**. Será la fuente normativa del futuro módulo \`lib/modules/inventory\`, sus rutas Next.js, contratos TypeScript y esquema \`inventory\` (propuesto). Ningún SQL de Inventario se incluye en el paquete de migración PETS/Core de esta fase, porque aún hay decisiones de negocio abiertas. Registrar nuevas decisiones en este .md antes de implementarlas.
