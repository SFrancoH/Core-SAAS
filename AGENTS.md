# AGENTS — Core SaaS

**Estas reglas son obligatorias para cualquier IA o desarrollador.** Core SaaS es el producto; PETS, PULSE y las demás son verticales integradas. No describir este repositorio como una migración.

## Norma obligatoria de lenguaje — TypeScript
- **Todo código nuevo de aplicación, servidor, Core, verticales, módulos, integraciones y pruebas automatizadas se escribe en TypeScript**: `.ts` y `.tsx`. No crear nuevos archivos `.js`, `.jsx` ni `.mjs` para funcionalidades.
- El proyecto usa `tsconfig.json` con `strict: true`, `allowJs: true`, `checkJs: false` y `noEmit: true`. `allowJs` se mantiene **solo para ejecutar el código heredado PETS**, no es permiso para escribir código nuevo en JavaScript.
- Antes de finalizar un cambio: `npm ci`, `npm test`, `npm run typecheck` y `npm run build`. La CI usa Node.js 22 para ejecutar pruebas TypeScript; si el cambio requiere un runtime distinto, documentarlo.
- Al modificar código JavaScript heredado de PETS, preservar su comportamiento. Convertir el archivo a TypeScript cuando sea seguro y se disponga de pruebas; no forzar conversiones masivas.
- Los adapters `.js` existentes son compatibilidad temporal. La lógica real de `lib/core` y `lib/verticals/pets` se desarrolla en TypeScript. Contratos entre módulos deben tener tipos explícitos y validar entradas externas en runtime.
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
