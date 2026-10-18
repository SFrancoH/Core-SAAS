# Contratos globales de integraciones — Core SaaS

**Objetivo:** un solo patrón para APIs/webhooks; cada vertical define efectos y condiciones.

## Parser GHL
Diseñar `normalizeInboundPayload` reutilizable con lectura de JSON raíz, `customData`, `custom_data`, `custom_fields`, claves prefijadas y mezclas. Admitir alias versionados por endpoint; evitar que dos claves contradictorias de identidad/empresa/proyecto se resuelvan silenciosamente. Normalizar primero, validar esquema luego; no escribir en DB dentro del parser. Restringir tamaños y tipos.

**Autenticación y alcance:** credencial Bearer o firma asociada en el servidor a integración/empresa; comparar alcance real con empresa/proyecto/número recibidos. El cliente no puede concederse permisos cambiando un identificador en JSON. Correlación, deduplicación e idempotencia donde aplique.

**Respuestas:** 400 campos inválidos (solo nombres); 401 credencial incorrecta; 403 prohibido; 404 recurso no encontrado o no visible; 409 conflicto de negocio; errores 5xx sin secretos/PII. Los callbacks externos no se consideran exitosos solo porque su receptor conteste 2xx cuando se requiere confirmación de negocio.

## Política de entrega
`single_attempt`: un POST, sin reintento automático si hay timeout/incertidumbre, y alerta para gestión manual (reservas de Oficina PULSE). `retry_idempotent`: reintentos controlados para sincronización PETS y otros eventos seguros. Esta política está ligada al evento; un worker global nunca debe sobreescribirla. Persistir evento en outbox transaccional donde corresponda.

## Versionado
Endpoints nuevos preferentemente `/api/v1/integraciones/{vertical}/{recurso}`. Documentar headers, body, alias, respuesta, error, idempotency key y test contractuales. Las URLs particulares de un despliegue externo no son reglas permanentes de Core.

## Tests mínimos
Raíz, Custom Data, mezclas, alias, claves contradictorias, JSON malformado, nulos, Bearer inválido, empresa A/B, número de longitud incorrecta, duplicados, reordenamiento, evento single_attempt y retry_idempotent. Para detalles de negocio, consultar `docs/verticales/PULSE.md` y `docs/verticales/PETS.md`.
