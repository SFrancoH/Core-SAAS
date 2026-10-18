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
