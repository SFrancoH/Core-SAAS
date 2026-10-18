# Vertical PULSE — Core SaaS

**Sector:** rifas, boletas digitales, sorteos/eventos. **Estado:** diseño, sin implementación `pulse.*` declarada en Core.

## Crear proyecto
Empresa licenciada, administrador autorizado, nombre, flyer, precio, landing, estado, premio mayor y N anticipados. Crear el registro y lote de números textuales de cuatro dígitos con comprobante/identificador único. `0000`–`9999` son **10.000** valores; el rango comercial se define expresamente. Restricción UNIQUE por proyecto; creación atómica o job duradero con estado real. Consulta del proyecto siempre filtra por empresa, usa paginación desde PostgreSQL, búsquedas y «ver más».

## Disponibilidad y asignaciones
Oficina ve solo boletas realmente libres, sin comprador, abono, reserva activa ni vendedor asignado. El vendedor únicamente su stock asignado y disponible. Todas las rutas (búsqueda, aleatorios, reserva, asignación y liberación) usan la misma invariante. No confiar en el frontend para autorizar una reserva: transacción, lock/UPDATE condicional, idempotencia. Reserva grupal no anuncia éxito si confirmó cero.

## Dinero y estado
Estados comerciales `Disponible`, `No disponible`, `Debe`, `Abonado`, `Pagado`, sujetos a transiciones validadas. No liberar pagadas/abonadas, con saldo positivo o asignadas a vendedor. Si un webhook entrega `valor_pagado` como **saldo total acumulado**, se reemplaza, no se suma; pagos deben quedar auditables en movimientos. Nunca perder abonos por cambio de estado.

## Sorteos y ganadores
Premio mayor obligatorio, anticipados configurables anteriores a la fecha mayor y contadores calculados desde fecha/hora persistida. Ganadores aislados por empresa; video, flyer, fecha, número y orden.

## GHL y oportunidades
- Usar el parser global: raíz, `customData`, `custom_data`, `custom_fields`, prefijos y mezclas; Bearer con empresa/proyecto autorizados.
- Consulta de aleatorios de Oficina: máximo 150 números; respuesta por defecto texto separado por `, `, bloques de 50 separados por ` | `, sin barra al final. Variante JSON para clientes que la soliciten.
- Actualización por empresa+proyecto+número exactos; estado y saldo validado. No actualizar otra empresa ni sincronizar hojas por solo número.
- Reserva de Oficina: **un POST saliente por grupo confirmado**, cero reintentos automáticos; oportunidad por cada boleta con callback de confirmación verificable. Respuesta 2xx del destino no significa oportunidad creada. Si falla, una alerta por boleta asignada al responsable; conservar estado comercial.
- Reservas desde enlace de vendedor: no enviar automáticamente el webhook de Oficina.
- Callback puede usar alias `consecutivo_1` para `numero` y estado `creada` / `fallida` sin sensibilidad a mayúsculas, siempre con empresa/proyecto/grupo/número autenticados.
- La interfaz pública no muestra nombres de herramientas técnicas externas. Tokens de venta secretos y revocables; no mostrar datos personales por conocer una URL.

## Permisos y calidad
Administrar proyecto, vendedores, pagos, eliminación requieren permisos específicos. Eliminar un proyecto exige confirmación y borrado transaccional solo de sus dependencias, nunca usuarios ni empresa. Pruebas obligatorias: empresa A/B, mismo número en distintos proyectos, concurrencia, valor acumulado, liberación, webhook mixto, fallo externo y datos públicos saneados.

## Regla UNI-001: proyecto/boleta únicos para una empresa con varias sedes
Un organizador con dos oficinas o puntos de venta **usa el mismo PULSE y el mismo proyecto**. La boleta se identifica por empresa + proyecto + número (dentro de su modelo de unicidad), nunca se crea otra boleta por sede. Sedes, oficinas, vendedores y asignaciones pueden registrar ubicación/punto de atención para permisos y analítica, pero no duplicar premios, reservas, pagos o proyectos.
El vendedor autorizado puede trabajar en una o varias sedes conforme a grants; las consultas/ventas operativas validan empresa/proyecto/sede cuando corresponda. La búsqueda y reportes pueden consolidar todas las sedes sin duplicar ventas ni números; los pagos y reservas mantienen transacciones e idempotencia.
La futura vertical PULSE utiliza `core.sedes` central, no un catálogo independiente PULSE. **Diseño, no funcionalidad implementada.** Referencia: `docs/UNIFICACION_MULTISEDE.md`.
