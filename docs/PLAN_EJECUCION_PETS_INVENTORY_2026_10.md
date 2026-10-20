# Plan de ejecución integrado — PETS (10 formularios) + INVENTORY transversal
**Versión:** 2026-10-19, DEC-001–007 · **Estado:** E0 parcialmente resuelto, sin implementación funcional ni SQL nuevo de INVENTORY.
**Tablero de seguimiento:** [SEGUIMIENTO_EJECUCION_PETS_INVENTORY.md](SEGUIMIENTO_EJECUCION_PETS_INVENTORY.md) — fuente actual de estados, prioridades y evidencia.
**Fuente nueva versionada:** docs/especificaciones/ESPECIFICACION_FORMULARIOS_PETS.md, copia íntegra de ESPECIFICACION_FORMULARIOS_PETS (1).md entregado por el usuario (apartados 1–14, especialmente 13).
**Fuentes vigentes del repositorio:** AGENTS.md, docs/UNIFICACION_MULTISEDE.md, docs/modules/INVENTORY_PLAN.md, docs/verticales/PETS.md, docs/MIGRACION_PETS_MULTIEMPRESA.md, PLAN_DESARROLLO.md y migraciones reales 001–015.
**Estrategia Git:** trabajar solo en desarrollo; main estable; despliegue de SQL manual y validado por el usuario. No alterar la app PULSE productiva.

## 1. Lectura crítica y jerarquía de requisitos

1. El nuevo archivo documenta DIEZ formularios (26 páginas de referencias) y un anexo de inventario definido posteriormente por el usuario. Las capturas no demuestran el backend del software de referencia. No deducir campos, opciones, restricciones, automatizaciones ni efectos de botones ocultos.
2. INVENTORY_PLAN.md no se reemplaza: conserva la arquitectura transversal, bodegas, posiciones, proveedores N:M, tags libres, lotes, caducidad, FEFO/FIFO, ledger, políticas de seguridad/reorden JIT y alertas. El anexo §13 del nuevo archivo complementa explícitamente catálogo visible, etiquetas estándar, tipo de uso, imagen, distribución por sede, modal, vistas Movimiento/Compras/Ventas y fuente de selectores clínicos.
3. PRIORIZACIÓN: (a) seguridad y UNI-001, (b) requisitos expresos del nuevo §13 para catálogo, (c) reglas operativas previas INVENTORY_PLAN para stock, (d) decisiones técnicas propuestas. Una regla pendiente no se convierte en comportamiento activo por interpretación del equipo.
4. INVENTORY es un complemento de Core por EMPRESA, no una dependencia exclusiva de PETS. PETS consume contratos públicos del módulo. PULSE no adquiere funcionalidades de inventario ni se modifican sus boletas automáticamente.
5. Se distinguen IMPLEMENTADO, DISEÑADO, SQL APLICADO, VALIDADO STAGING y PRODUCCIÓN. CI verde no verifica Supabase, privacidad, datos históricos ni transacciones concurrentes.

## 2. Estado comprobado en el repositorio; bloqueos reales

- Existen 001–015 versionados; **el usuario confirmó ejecución manual sin errores de 001–012 y de 013 corregida en Supabase (2026-10-19)**. Es un reporte de ejecución, NO postcheck independiente/JWT RLS/entorno verificado. **014 y 015 no constan ejecutadas**; no repetir migraciones anteriores ni el bundle.
- Core dispone de modelos, RPC, permisos, membresías y sedes en SQL/versionado, pero falta certificar seguridad y datos reales con staging.
- PETS dispone de Consulta y control, procedimientos, fórmula y un historial unificado. Su componente actual usa un catálogo fijo de medicamentos y guarda fórmula como JSON; **no existe todavía integración viva con INVENTORY**.
- Algunas etiquetas de módulos como Vacunación, Desparasitación, Estética o Guardería ya aparecen en navegación, lo que NO demuestra formularios específicos terminados. Los diez formularios de la nueva especificación requieren implementación y pruebas independientes.
- Hay acciones legacy PETS que todavía dependen del perfil/empresa anterior y de listas de sede Norte/Sur. Antes de exponer formularios con escrituras nuevas hay que cerrar multiempresa y multisede (C14–C16).
- El árbol del repositorio NO contiene SQL, UI ni casos de uso implementados para INVENTORY. El esquema de Inventario es un diseño, no datos ya existentes.

## 3. Decisiones de diseño integradas para INVENTORY

### 3.1. Catálogo empresarial y taxonomía

La ficha de artículo pertenece a una EMPRESA (UUID estable). La cantidad física NO pertenece a la ficha maestra sino a sus ubicaciones por sede. Campos visible/solicitados: categoría o etiqueta estándar, subcategoría si Producto, nombre, SKU texto, descripción, cantidades por sede, tipo de uso e imagen_url opcional.

**Cinco CLASIFICACIONES estándar iniciales:** Producto; Medicamento; Vacuna; Desparasitante; Insumo, de código estable. **El Super-Admin global podrá crear otras** para nuevos negocios: tabla de clasificaciones extensible, no ENUM SQL fijo. Son diferentes de los **tags libres** y de las **subcategorías personalizadas de Producto** (Collares, Concentrado, Juguetes), cuyo ámbito es la empresa. Nuevas clasificaciones no generan selectores PETS automáticamente.

**Tipo de uso: exactamente cuatro valores**, independiente de etiqueta/tags/subcategoría: Interno; Comercial; Interno/Comercial; Comercial/Sitio-web. El filtro de la futura tienda web queda pendiente porque «solo lo interno» contradice el aparente uso Comercial/Sitio-web. No construir tienda en esta entrega.

**SKU: unicidad APROBADA por empresa** `(empresa_id, sku_normalizado)`, mismo artículo/SKU para todas las sedes: SKU-0012 alimento Dogshow en sede A 25 y B 45, total 70; NO repetir ficha por sede. SKU texto; otras empresas pueden reutilizar SKU. **Solo pendientes:** si SKU es obligatorio y formato, y si un artículo puede tener una o varias clasificaciones estándar (recomendación una principal y tags libres, sin aprobación aún).

El plan anterior añade como capacidades futuras: proveedor, costo, código de barras, unidades, lote, vencimiento y políticas. NO atribuirlos al formulario de alta del anexo: ubicar estos metadatos en paneles avanzados **tras decisión**, sin imponer requisitos no definidos a la ficha básica.

### 3.2. Sedes, bodegas y cantidad: integración sin doble verdad

Jerarquía: empresa → core.sedes → inventory.bodegas → inventory.ubicaciones → existencias por artículo/lote/posición, con movimientos y ledger auditables. NUNCA duplicar maestro por sede. Un mismo SKU puede estar en A y B con cantidades diferentes. El modal muestra filas Sede/Cantidad; las cantidades son AGREGADOS de las ubicaciones habilitadas de esa sede, no una segunda cifra editable sin trazabilidad.

El requisito de registrar cantidades por sede durante el alta debe conciliarse con el ledger previo. **Propuesta técnica sujeta a aprobación:** el formulario recoge saldo inicial por sede, la operación autoritativa genera entradas de apertura idempotentes con sede/bodega/ubicación concretas, nunca UPDATE directo a un contador. Si no están aprobados ubicación/unidad/movimiento de apertura, mostrar captura diferida sin fingir que esas cantidades ya son stock confiable.

La ficha exhibe la distribución consolidada por sedes autorizadas y la imagen URL cuando existe; sin URL no se inventa imagen. URL válida no implica contenido seguro; frontend evita inyección, SSRF y hosts no deseados. Ubicación de edición y de pestañas queda a criterio UI, conservando popup + acceso claro a tres vistas.

### 3.3. Vistas mínimas incorporadas sin fabricar un POS

- Movimiento: Fecha, Tipo de movimiento y Responsable; identidad real de usuario autenticado capturada en servidor al ocurrir el evento, inmutable al consultar después. El catálogo exacto de tipos aún requiere aprobación (INVENTORY_PLAN sugería Entrada/Salida/Transferencia/Ajuste/Merma/Devolución).
- Compras: Fecha, Cantidad, Proveedor, Precio total. El proyecto ya contempla proveedores N:M y costo histórico. La vista mínima NO exige todavía compras contables, IVA ni órdenes a proveedor automáticas.
- Ventas: Fecha, Cantidad, Propietario PETS (relación por ID real, no string), Precio total. Debe definirse una interfaz/adaptador entre INVENTORY y PETS; evitar acoplar toda la tabla genérica de ventas a propietarios para futuras verticales. La relación PETS debe validar misma empresa.
- **DEC-004 APROBADA: descontar/ajustar inventario es MANUAL por ahora.** Registrar Compras/Ventas o formulario clínico NO produce entradas/salidas automáticas. Movimientos manuales son transacciones explícitas con actor, empresa, sede y ledger. En integración comercial FUTURA podrán automatizarse descuentos por venta, con idempotencia y conciliación que evite duplicar una salida manual ya registrada.

### 3.4. Reglas previas de stock que SE CONSERVAN

Movimiento inmutable/compensación; transacciones SQL atómicas; idempotencia; concurrencia con locks; stock físico y disponible diferenciados; FEFO por caducidad para lotes aptos y FIFO de capas de recepción para artículos sin caducidad; cuarentena ≠ merma; bloqueos por vencimiento; transferencia balanceada A→B; semáforos independientes para cantidad y fecha; reorden JIT sobre consumo real y plazo de proveedor, sin autocompra.

Política de stock negativo físico sigue abierta: la recomendación previa es bloquear saldos físicos negativos. **PETS sí permite SELECCIONAR cualquier artículo con STOCK CERO**: no es consumo ni venta. Una salida MANUAL de stock requiere disponibilidad y permisos; selección clínica solo guarda referencia y NO afecta inventario.

### 3.5. Licencia, seguridad y contrato transversal

Añadir entitlement de módulo compartido INVENTORY y permisos dedicados en el catálogo Core, sujetos a licencia vigente, membresía, rol, empresa y sede autorizada; no confundir PETS con licencia de Inventario. Distinguir lectura catálogo, alta/edición, lectura stock, recepción, salida, traslado, ajustes, auditoría, costos y políticas. Contrato desacoplado por empresa/sede/artículo/actor/origen/idempotencia. Backend service_role SOLO tras verificación del actor; RLS y FKs compuestas. «Todas las sedes» solo lectura. Costos y datos personales no se filtran solo en React.

## 4. PETS: modelo de formularios, historial y artículos

Crear DIEZ variantes independientes y fieles a estructura visible, reutilizando componentes de campo, búsqueda, filas de artículo, signos vitales, persona y adjuntos, sin convertirlas en un formulario universal indiferenciado.

**Propuesta de persistencia (NO SQL existente):** cabecera de servicio clínico con UUID, empresa_id, mascota_id, sede_id, tipo, actor, profesional/responsable aplicable, fecha del servidor, estado controlado y versión de esquema; detalle clínico tipado por variante (columnas cuando sean estables / payload estructurado versionado para campos exclusivos); líneas de artículos relacionadas por artículo_id y etiqueta, con dosis, unidad, vía, frecuencia y cantidad SOLO cuando la captura lo exige; documentos clínicos privados por referencia. Debe contemplar relación opcional a consulta/control sin fundir sus significados y proyección al historial unificado; no sobrescribir consultas previas.

Mantener **dato clínico prescrito/planeado** separado de **cantidad física dispensada o consumida**. **DEC-005/006:** guardar artículo incluso con saldo cero no registra salida, venta, reserva ni consumo. Registrar ID/snapshot clínico estable; **consumo automático se posterga fuera del MVP**, no es E9. **DEC-007:** «sin inventario» no habilita un interruptor/proceso comercial y los radios Insumos Sí/No no descuentan stock.

| Variante exacta | Singularidades obligatorias de la fuente | Inventario / pendientes |
|---|---|---|
| 1. Anestesia | Identificación y admisión; estado general (RGR, Hto, Hb, RGB, proteínas, ALT, CRAT, glucosa, ASA), procedimiento; premedicación, inducción, TIVA, PIVA (Isoflurano/Otro), fluidoterapia; comentarios y hasta 3 adjuntos | Medicamento en 3 tablas; unidades/vías/frecuencias sin listas inventadas |
| 2. Cirugía | Signos, procedimiento/abordaje/diagnóstico quirúrgico, área de consulta, decisión médica con 4 alternativas de la fuente, plan terapéutico, pronóstico y hasta 3 adjuntos | Medicamento + Insumo; columnas ocultas NO deducidas |
| 3. Desparasitación | Mascota/cliente/fecha, responsable, peso y descripción, desparasitantes, radio «Insumos Sí/No» | Desparasitante + Insumo condicional según diseño visible; «sin inventario» no es toggle verificado |
| 4. Estética | Propietario y mascota buscables, tipo de estética, dos responsables, costo adicional, foto, insumos | Insumo; contenido del selector Tipo de estética pendiente |
| 5. Eutanasia | Historia/admisión, médico, mascota, tipo de servicio, valor y descripción | No inventar consentimiento, causa/fallecimiento, firma ni adjuntos |
| 6. Examen de laboratorio | Identificación, tipo de servicio, observaciones y filas de fecha orden, examen complementario, Sí/No realizado; insumos | Insumo; no inventar columnas fuera del scroll |
| 7. Guardería | Fecha ingreso, responsable, ubicación, descripción/foto de ingreso; radio salida Sí/No, fecha, responsable, descripción/foto de salida | No hay selector Inventario explícito; lógica condicional de salida pendiente |
| 8. Hospitalización | Planeación/aplicación/control de medicamentos, radio Insumos Sí/No; primer control con signos, deshidratación, observaciones y SOIP | Medicamento y eventual Insumo; no inventar turnos y controles posteriores |
| 9. Medicación/Inyectología | Datos básicos, observaciones, medicamentos con dosis/vía/frecuencia/cantidad; tabla Insumos | Medicamento + Insumo; columnas fuera de vista pendientes |
| 10. Vacunación | Datos básicos, vacuna/cantidad, radio Insumos Sí/No y botón «Agregar próxima vacuna» | Vacuna + Insumo según control; NO inventar datos de próxima vacuna |

Las etiquetas de acciones finales Registrar/Aplicar/Cancelar se conservan como en cada variante, sin asociar efectos DB diferentes sin regla. Fecha/admisión y mascota/propietario se precargan desde contexto REAL, no copiando valores de los PDF. Máximo 3 adjuntos solo donde está visible. No añadir Producto genérico a los diez formularios.

**Dato actual incompatible:** consulta y fórmula PETS guardan nombres de medicamentos de lista fija y JSON; migrar en forma ADITIVA, conservar lectura de registros legados y permitir artículos sin ID en histórico como legado, sin falsificar referencias. Primero introducir nuevo campo de vínculo/reconciliación y luego retirar selector fijo para registros NUEVOS una vez el catálogo INVENTORY funcione. Toda edición debe respetar auditoría y datos clínicos anteriores.

## 5. Plan ejecutable en una sola rama desarrollo

El plan I0–I9 del INVENTORY_PLAN sigue siendo el marco de stock. Se introducen hitos funcionales PETS F0–F4 y se ordenan para evitar bloquear interfaces que solo necesitan catálogos.

| Hito | Entregable de código/documentación | Dependencia / condición de cierre |
|---|---|---|
| E0 — Alinear alcance | Matriz de inventario original vs. anexo §13, diez fichas de campos, tabla de decisiones abiertas, mapa de compatibilidad clínica y entorno staging | Aprobar prioridades; cero SQL; preservar catálogos y reglas originales |
| E1 — Cerrar Core/PETS | **013 ejecutada sin errores según usuario**, verificar postcheck/entorno, estado 014 y C14–C16 PETS (lecturas/escrituras multiempresa y sedes reales) | Pruebas RLS JWT A/B empresas/sedes, roles, revocación, permisos, regresión consultas/propietarios |
| E2 — Contratos y UX | Tipos TS y especificaciones por cada formulario; modelo artículo vs. tag vs. subcategoría; prototipos modal/catálogo; permisos INVENTORY | Decisiones críticas de clasificación/SKU/unidad y ubicación definidas; formularios sin campos inventados |
| E3 — I1/I2: SQL staging | Migraciones nuevas independientes para inventory.* y estructuras de servicios PETS; preflight/postcheck, catálogo Core, FKs compuestas, RLS, historial no destructivo | SQL manual en staging, restauración backup, pruebas tenant/empresa/sede y referencias |
| E4 — I3: Catálogo utilizable | Pantallas listado, alta/edición, subcategorías Producto, cinco etiquetas estándar, cuatro tipos de uso, imagen URL, ficha modal y cantidades por sede en lectura; proveedores/tags/bodegas alineados | Alta en empresa A invisible para B; ficha única multi-sede; auditoría; sin saldo ficticio |
| E5 — I4/I5: Motor stock | Recepciones/apertura con ledger; salidas, traslado, FEFO/FIFO, lotes, cuarentena y reversos; lectura real de movimientos | Idempotencia, transacciones, ubicaciones, concurrencia, saldo y permisos correctos; sin política de consumo automático no aprobada |
| E6 — Vistas comerciales | Movimiento/Compras/Ventas con campos del §13, acceso por artículo; actor histórico automático; vínculos PETS a propietario por ID y empresa | Las vistas tienen datos reales, no simulados; compras/ventas no se presentan como POS contable |
| E7 — F0: Comunes clínicos | Framework de campos, precarga mascota, profesional autorizado, sede operativa, adjuntos seguros, selectores Inventario por etiqueta, listas NO definidas marcadas pendientes | Sin acceso cruzado; opciones solo empresa propia; edición de catálogo preserva vínculos históricos |
| E8 — F1: 10 formularios | Construir individualmente conforme tabla §4, con persistencia por mascota/empresa/sede y publicación en historial | Cada campo visible, orden y acción; tests por variante, permisos y edición; ningún campo oculto inventado |
| E9 — F2/I8: Integración sin stock automático | PETS registra vinculación por ID al artículo real, también en saldo cero; **no genera movimiento, venta, reserva ni descuento**. Integración comercial futura fuera del MVP | Clínicas con cero stock guardan; movimientos solo manuales en Inventario; sin doble descuentos |
| E10 — I6/I7: Operación avanzada | Semáforos de stock y vencimiento, JIT, ubicaciones, filtros y reportes consolidados, N:M proveedores y búsquedas indexadas | FEFO/FIFO, límites y sin datos; filtrado por permisos, red de bodega y no doble conteo |
| E11 — I9: QA/publicación | E2E PETS e INVENTORY, copias/restore, observabilidad, cargas de prueba y plan de reversión; piloto de una empresa | CI y DB staging aprobadas; activación gradual tras aprobación explícita; main solo tras pruebas |

**Entrega temprana segura:** E4 + E7 pueden ofrecer selección y ficha de artículo SIN consumo automático si las autorizaciones y el esquema están listos. E8 no debe declararse operativo antes del modelo de persistencia y prueba real; E9 no se activa sin reglas de consumo y movimientos auditados. E10 no debe retrasar formularios puramente clínicos cuando el MVP autorice operar sin descuento de stock.

**Orden técnico:** E0 → E1/E2 → E3 → E4/E5 (dependencias internas por contrato) → E6/E7 → E8 → E9 → E10 → E11. E2 y prototipos pueden avanzar mientras se certifica E1; la escritura/activación queda bloqueada hasta la aprobación E1/E3.

### Entregas pequeñas dentro de desarrollo (sin ramas extra)

1. Documento de especificación integrada y matriz de decisiones.
2. Seguridad/tenancy/sedes PETS + pruebas.
3. Contratos tipados + SQL INVENTORY diseñado (NO ejecutar por GitHub).
4. Catálogo Inventario + modal + filtros.
5. Motor ledger y saldos con movimientos.
6. Vistas Movimiento/Compras/Ventas.
7. Componentes clínicos compartidos y diez formularios independientes en commits incrementales.
8. Enlaces clínicos/inventario, semáforos y pruebas.
9. Pruebas de aceptación y merge controlado a main.

Cada commit funcional actualiza BITACORA/PLAN, ejecuta npm test/typecheck/build, y prueba SQL/RLS en proyecto de pruebas por acción manual. PR existente desarrollo→main NO se fusiona simplemente porque CI está verde.

## 6. Bloqueadores que necesitan definición humana (no inventar)

**Decisiones aprobadas:** DEC-001–007: cinco clasificaciones estándar extensibles por Super-Admin sin mezclar tags, SKU único empresa/compartido entre sedes, cantidad derivada del ledger, descuento manual, selección clínica sin movimiento incluso stock cero y ausencia de flujo «sin inventario». Ver seguimiento.

**ÚNICAS decisiones pendientes de ingeniería/negocio:**
- B1. Cardinalidad de clasificaciones por artículo, permisos de extensiones; **los cinco tipos iniciales y capacidad de ampliación ya están aprobados**.
- B2. Obligatoriedad/formato SKU; **unicidad por empresa ya aprobada**.
- B3. Unidades de medida y conversiones (frasco, caja, ml, dosis), lotes/caducidad por clasificación.
- B4. Distribución de stock inicial por sede/bodega/ubicación/lote mediante movimientos de apertura; sin doble contador.
- B5. Tipos de movimientos MANUALES y sus permisos de ajustes/mermas, stock negativo, principal bodega por sede o empresa.
- B6. Botones y catálogos de formularios no visibles, columnas ocultas, unidad junto a dosis y regla de registro de próximos servicios.
- B7. Integración de venta/descuento AUTOMÁTICO y filtro tienda **solo a futuro**, con idempotencia/doble descuento resueltos.

**No hay pendiente de «sin inventario» para el MVP.** Los radios «Insumos Sí/No» se conservan solo como información clínica según la fuente, nunca como evento de stock.

**No bloquean la estructura básica si se dejan explícitamente sin definir:** selectores de médicos/responsables/servicio sin opciones confirmadas; unidad junto a dosis, vía, frecuencia y ASA; columnas ocultas por scroll; diálogo de botones +; campos de próxima vacuna; salida condicional de guardería; límites de adjuntos fuera del 0/3 visible; reglas de precios/totales/obligatoriedad no definidas. No sustituir los pendientes por supuestos. Donde los catálogos reales de PETS ya existan, reutilizarlos con autorización sin declarar que son los del PDF.

## 7. Matriz mínima de pruebas para cada entrega

**Aislamiento:** empresa A/B con igual SKU/nombre; varias sedes/bodegas en A; usuario autorizado solo sede A; pet y dueño únicos compartidos A/B-sedes; desactivar licencia o membresía revoca API.

**Inventario:** cinco etiquetas/filtro exacto; subcategorías Producto por empresa; tipo de uso 4 valores; SKU texto/ceros; modal con cantidades, imagen o vacío; cambios nombre no rompen clínica; no cantidades duplicadas; compras/ventas no cambian saldos sin autorización; responsable histórico correcto.

**Movimiento:** dos operadores con última unidad; idempotencia de operación/reintento; entrada en sede A no crea stock B; transferencia A→B balancea; lote vencido o cuarentena se bloquea; FEFO/FIFO orden correcto; costo visible solo con permiso; no sobreventa, no doble merma; compensación sin borrado.

**PETS clínico:** diez formularios guardan/leen contexto correcto; cada uno solo sus campos; selectores dinámicos correctos por etiqueta; prescripción ≠ consumo; números microchip/historia conservan ceros; historial clínico refleja actor/sede y evento; adjuntos privados; regresión de fórmula JSON/Consulta-control antiguos; sin visibilidad cruzada de expedientes.

**Entrega:** pruebas de base en Supabase staging con rollback validado, E2E reales, npm ci/test/typecheck/build y evidencias registradas. No tocar Supabase ni main hasta el procedimiento aprobado.

## 8. Criterio de inicio y resultado esperado

**Primer trabajo siguiente: E1 + cierre residual E0.** 013 ya fue ejecutada sin errores SEGÚN EL USUARIO; verificar postcheck de 013, estado de 014 y pruebas JWT/RLS, y comenzar C14–C16. En paralelo definir cardinalidad, unidades, cantidades iniciales y movimientos manuales. No crear tablas Inventario antes de estos contratos.

**MVP integrado demostrable:** una empresa con dos sedes mantiene UNA ficha de artículo, su distribución real por sede, vistas de movimientos/compras/ventas con datos y responsable histórico; PETS guarda diez variantes clínicas y selecciona los mismos artículos por etiqueta, preservando expediente clínico y sin descuentos implícitos. Luego operaciones stock, FEFO/FIFO y reorden se habilitan solo tras autorización y pruebas.
