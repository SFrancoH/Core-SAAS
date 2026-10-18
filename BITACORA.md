# BITÁCORA — Core SaaS

Registro de continuidad del **producto Core SaaS**, no de una migración. La bitácora refleja implementaciones reales, decisiones y resultados de pruebas.

## Estados permitidos
`DEFINIDO` → `IMPLEMENTADO` → `BD APLICADA` (si aplica) → `PROBADO LOCAL` → `DESPLEGADO` → `VERIFICADO EN PRODUCCIÓN`. También `BLOQUEADO` o `REVERTIDO`. Un documento o commit no acredita producción.

## 2026-10-17 — Definición inicial de Core SaaS
- **Estado:** DEFINIDO.
- **Objetivo:** plataforma multiempresa con núcleo global, verticales independientes y complementos comunes.
- **Base de desarrollo:** código PETS existente; Next.js, Supabase Auth/PostgreSQL y tablas PETS del repositorio.
- **Decisión DATA-001:** `public.empresas.id uuid` es identidad de empresa de todo Core. No crear otra tabla de empresas para PULSE.
- **Decisión AUTH-001:** `auth.users` es identidad de usuarios; mantener `public.usuarios` y diseñar roles/membresías globales separadas.
- **Decisión MOD-001:** Core controla licencias; cada vertical es propietaria de sus entidades.
- **Decisión INT-001:** parser GHL global y adaptadores por vertical; política de entrega/reintentos es específica de cada evento.
- **SQL ejecutado:** ninguno en esta entrega.
- **Código operativo modificado:** ninguno; solo documentos y carpetas de referencia.
- **Pruebas de aplicación/DB:** no ejecutadas en esta entrega; la inspección de archivos del repositorio no sustituye las pruebas.
- **Próximo paso:** C01, verificar el esquema real de Supabase Core.

## Plantilla para cada nueva entrada
```text
### AAAA-MM-DD — Fase / función
Estado:
Objetivo:
Reglas y contratos afectados:
Archivos:
Tablas/migración/versiones:
Entorno afectado:
Pruebas realmente ejecutadas y resultado:
PR/commit/deployment:
Riesgos y siguiente acción:
```
No incluir secretos, URLs privadas, datos clínicos o personales ni tokens en esta bitácora.
