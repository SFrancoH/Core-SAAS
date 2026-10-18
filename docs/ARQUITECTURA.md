# Arquitectura de Core SaaS

Core SaaS es un **monolito modular**: una aplicación principal y dominios lógicos separados, no un conjunto de aplicaciones que deben desplegarse juntas a la fuerza. Se utiliza el Next.js existente y PostgreSQL en Supabase.

## Estructura de código
- `app/`: rutas, APIs y vistas Next.js, incluidas las pantallas PETS existentes.
- `components/`: componentes visuales reutilizables; lógica de negocio en casos de uso.
- `lib/core/`: empresa activa, identidad, autorización, licencias y auditoría.
- `lib/verticals/pets/`, `lib/verticals/pulse/`: casos de uso de cada vertical. Extraer/implementar por función, no mover de golpe la aplicación PETS.
- `lib/modules/`: inventario, facturación, agenda y otros complementos que no conocen las tablas internas de una vertical.
- `lib/integrations/`: proveedores externos, parsers, firma/Bearer, contratos y estados de entrega.
- `supabase/migrations/`: SQL aprobado y versionado; `supabase/design/` contiene diseños que no se ejecutan automáticamente.
- `docs/verticales/`: reglas exclusivas de cada negocio.

## Regla de acoplamiento
Ruta HTTP → autenticación + organización + permiso + licencia → caso de uso del dominio → transacción PostgreSQL → evento de integración opcional. La lógica de un módulo solo se consulta mediante su interfaz; prohibido importar tablas internas de otra vertical.

## Base de datos
`public.empresas(id uuid)` y `auth.users` son entidades centrales actuales. Se diseñan tablas nuevas de licencias bajo `core`, tablas de rifas bajo `pulse`. PETS mantiene inicialmente sus tablas clínicas `public` para no alterar comportamiento por reorganización estética. FKs compuestas y RLS refuerzan aislamiento.

## Límites de responsabilidad
- La base de datos decide unicidad, estados transaccionales, integridad y dinero; React nunca es autoridad de reservas.
- Las rutas no ejecutan operaciones pesadas indefinidas; jobs/colas duraderas solo donde hacen falta.
- Privilegios administrativos solo en servidor; `service_role` requiere autorización de aplicación porque evade RLS.
- APIs versionadas y webhooks tolerantes en lectura pero estrictos en seguridad.
- No son necesarias nuevas apps, nuevos stacks o nuevos proyectos Supabase para crear una carpeta.

**Estado:** diseño de destino. Ninguna carpeta vacía significa módulo funcional.

## Estado de integración de la base PETS
Desde la primera organización de código, `lib/core/auth.js` mantiene la lógica compartida de sesiones; `lib/verticals/pets/operational.js` contiene el comportamiento operativo veterinario y sus catálogos. Los imports históricos se mantienen como **adaptadores** para compatibilidad; las pantallas actuales usan preferentemente las nuevas rutas. `lib/core/authorization.js` ofrece la autorización para casos de uso Core futuros y requiere la RPC del SQL 010 antes de usarse. **No afirmar que la licencia ya protege las rutas PETS heredadas**: deben incorporarse gradualmente con pruebas.
