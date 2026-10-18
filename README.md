# Core SaaS

Plataforma SaaS modular y multiempresa. **PETS** es la primera vertical disponible en código; PULSE (rifas, boletas, eventos) se incorpora por funcionalidades. Verticales planeadas: AURA (estética), VISION (oftalmología), DRIVE (movilidad), NEURO (educación), LENS (ópticas).

El producto se desarrolla sobre la aplicación Next.js que ya existe en este repositorio. **No es un plan de migración de repositorios**. El objetivo es incorporar casos de uso nuevos a una arquitectura central, sin reconstruir todas las pantallas ni desplegar módulos antes de tiempo.

## Documentación del proyecto
- [AGENTS.md](AGENTS.md): reglas obligatorias para la IA.
- [PLAN_DESARROLLO.md](PLAN_DESARROLLO.md): secuencia de construcción.
- [BITACORA.md](BITACORA.md): decisiones, estado y evidencias.
- [Arquitectura](docs/ARQUITECTURA.md).
- [Modelo de datos, permisos y licencias](docs/MODELO_DATOS_PERMISOS_LICENCIAS.md).
- [Contratos de integración](docs/CONTRATOS_INTEGRACIONES.md).
- [Cómo agregar una funcionalidad](docs/COMO_AGREGAR_FUNCIONALIDAD.md).
- [PETS](docs/verticales/PETS.md) y [PULSE](docs/verticales/PULSE.md).

## Stack y ejecución
Next.js 16, React 19, Supabase Auth, PostgreSQL y ExcelJS. **TypeScript es el lenguaje obligatorio para todo desarrollo nuevo**. Core y los módulos PETS ya organizados utilizan archivos `.ts`; los archivos `.js` existentes de PETS se mantienen por compatibilidad mientras se convierten por etapas. `tsconfig.json` habilita `strict` y `allowJs` para este tránsito, sin permitir nuevo código JavaScript.

```bash
npm install
npm run dev
npm test       # Node.js 22, pruebas TypeScript
npm run typecheck
npm run build
```

Configurar en `.env.local` o en el servidor, **nunca en Git**:
```env
SUPABASE_URL=...
SUPABASE_SECRET_KEY=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```
`SUPABASE_SECRET_KEY` es exclusivamente privada y no lleva prefijo `NEXT_PUBLIC_`.

El directorio `supabase/migrations` contiene PETS 001–009 y el **diseño aún no aplicado** `010_core_access.sql` (Core: licencias, roles, permisos y membresías). Confirmar qué migraciones se ejecutaron realmente antes de aplicar SQL. Las carpetas nuevas delimitan la aplicación: autenticación compartida en `lib/core` y catálogos y permisos PETS en `lib/verticals/pets`. Los módulos nuevos no se consideran implementados por crear sus carpetas.

## Primera entrega de Core
Conservar PETS operativo, inventariar la base de datos actual, construir permisos/licencias centrales y agregar la primera función «Crear proyecto PULSE» siguiendo el contrato Core. No copiar todo PULSE de golpe ni escribir en una base de datos ajena a este proyecto.

## Estructura confirmada

```text
Core-SAAS/
├── AGENTS.md
├── PLAN_DESARROLLO.md
├── BITACORA.md
├── README.md
├── app/                     # Rutas PETS actuales
├── components/              # Componentes existentes
├── lib/
│   ├── core/                # Autenticación, autorización y permisos TypeScript
│   ├── verticals/
│   │   ├── pets/            # Dominio PETS TypeScript
│   │   └── pulse/           # Dominio previsto, aún sin casos de uso
│   ├── modules/             # Complementos transversales
│   └── integrations/        # Parser compartido GHL TypeScript
├── docs/
│   ├── ARQUITECTURA.md
│   ├── MODELO_DATOS_PERMISOS_LICENCIAS.md
│   ├── CONTRATOS_INTEGRACIONES.md
│   ├── COMO_AGREGAR_FUNCIONALIDAD.md
│   └── verticales/
│       ├── PETS.md
│       └── PULSE.md
└── supabase/
    ├── migrations/          # PETS 001–009 + Core 010 sin aplicar
    └── design/              # Documentos y consultas de revisión
```

Esta estructura describe carpetas reales del repositorio; no significa que PULSE, licencias en DB o módulos compartidos ya estén habilitados.
