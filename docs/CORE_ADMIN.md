# Core Admin — Módulo del superadministrador

**Propietario:** el operador global de Core SaaS. Core Admin pertenece al núcleo compartido y NO es una vertical ni un complemento facturable.

## Dónde vive
- Ruta principal /super-admin y detalle /super-admin/empresas/[id].
- Servicio de consulta lib/core/admin/overview.ts.
- Cabecera visual components/layouts/core-admin-header.tsx.
- Página de referencia /super-admin/apariencia.
- Autorización obligatoria del rol super_admin en el servidor.

## Funciones reales hoy
| Capacidad | Estado |
|---|---|
| Listar empresas | Disponible desde PETS, mostrado en Core Admin |
| Crear empresa | Disponible con guard super_admin |
| Administración de usuarios por empresa | Flujo existente |
| Ver resumen general | Vista básica: empresas registradas/activas |
| Mostrar verticales | Catálogo informativo, solo PETS con interfaz existente |
| Apariencia | Vista visual, sin editor persistente |

## Funciones que se implementarán
- Licencias y productos contratados (requiere migración SQL 010 aplicada y verificada).
- Planes y suscripciones.
- Auditoría y monitoreo de eventos globales.
- Integraciones por empresa y permisos delegados.
- Personalización persistente del tema (solo si se define después).

No mostrar una función como activa si su DB, autorización, API y tests todavía no existen.

## Separación de roles
Core Admin controla empresas y producto global. Empresa Admin gestiona únicamente su empresa y complementos autorizados. Los veterinarios y vendedores ven únicamente su vertical, empresa y permisos. Super Admin puede usar el frontend PETS sin que su cabecera de gestión global se mezcle con formularios clínicos.

## Sistema visual
Core Admin utiliza los tokens de styles/tokens.css que también rigen PETS. Las verticales pueden usar navegación y lenguaje específicos, pero no paletas CSS aisladas.
