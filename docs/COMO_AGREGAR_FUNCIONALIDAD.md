# Cómo incorporar una funcionalidad a Core SaaS

**Una función completa por unidad de trabajo.** El código externo o copiado es referencia para entender la regla, no una instrucción de instalar todo el otro proyecto.

## Procedimiento
1. Leer reglas globales, bitácora, modelo y vertical.
2. Definir funcionalidad específica (ej. PULSE: crear proyecto), usuario autorizado, producto/módulo licenciado y recurso.
3. Inventariar modelo Core real. Reusar `public.empresas uuid` y usuarios existentes; definir exclusivamente nuevas tablas de dominio necesarias.
4. Definir contrato de endpoint, campos, estados, efectos, errores, eventos y tolerancia a fallos.
5. Escribir pruebas de empresa A/B, sin permiso/licencia, valores inválidos, duplicado y transacciones.
6. Crear caso de uso independiente del handler y la UI; API autentica y autoriza.
7. Generar SQL versionado, probarlo y verificar aplicación en entorno autorizado antes de activar código dependiente.
8. Documentar cambios, migraciones, pruebas, PR y despliegue en plan/bitácora. No dar por terminado lo que no se comprobó.

## Ejemplo: PULSE — Crear proyecto
El usuario solicita título, imagen, precio, premio mayor y N anticipados. Core valida permiso `pulse.project.create` y licencia PULSE, deriva empresa autenticada; el dominio crea en transacción `pulse.proyectos` y números de cuatro dígitos con UNIQUE por proyecto y comprobante individual. Determinar explícitamente el rango y si se incluye `0000`. Devolver identificador y cantidad efectivamente creada. La UI del proyecto consulta únicamente sus registros y pagina en SQL.

**No agregar automáticamente** reservas, pagos, GHL, alertas ni vendedores al implementar «Crear proyecto»: son unidades posteriores. No inventar resultados de pruebas ni conectar una API a otra DB por copiar sus variables.

## Revisión UNI-001 obligatoria antes de cada funcionalidad
**Sin excepción para nuevas verticales o complementos:** leer `docs/UNIFICACION_MULTISEDE.md` y demostrar que la función sigue siendo una sola solución para empresas con N sedes. Al diseñar endpoints/DB/UI, responder:
1. ¿Es un **maestro compartido de empresa** (mascota, propietario, cliente, producto, proyecto) o un **evento/recurso local** (consulta, turno, inventario, caja, reserva de espacio)? Elegir identidad y claves únicas en el nivel correcto.
2. ¿Reutiliza la empresa, las sedes y los usuarios Core existentes? Prohibido crear un mini-SaaS o clonar registros por cada sede.
3. ¿Quién puede ver información de todas las sedes y quién solo de algunas? Diseñar lectura consolidada/filtro de sede y permisos de empresa/sede en backend; «Todas» no autoriza escrituras locales.
4. ¿Qué pasa si una entidad creada en A es consultada u operada en B? Debe conservar el mismo ID/registro maestro y el historial completo autorizado, agregando eventos con sede de operación.
5. ¿Cómo se evitan duplicados en concurrencia, integraciones, importaciones y búsquedas por identificadores secundarios? Constraints por empresa, transacciones, idempotencia y conciliación.
6. ¿Qué sucede con stock, agenda, caja, pagos y movimientos entre sedes? Conservar ubicación, fecha, autor, coherencia y reporte consolidado sin doble conteo.
7. ¿Qué pruebas negativas validan empresa A/B, sede A/B, permisos de acceso restringido, filtros, creación repetida y cambios de sede? Documentar evidencias, no solo tests de UI.

**No marcar IMPLEMENTADO** el criterio UNI-001 sin pruebas reales de autorización, datos, deduplicación y compatibilidad con PETS histórico.
