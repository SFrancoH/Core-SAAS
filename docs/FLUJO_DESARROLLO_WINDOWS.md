# Dos ramas: main y desarrollo (Windows PowerShell)

**`main`** es la versión estable que no debe romperse. **`desarrollo`** es la única rama de trabajo permanente que se usa para probar y actualizar la copia local. No crear una rama nueva por cada tarea.

## Primera descarga en tu directorio

Desde `PS E:\\SOY SEBASTIAN FRANCO\\Desarrollo\\CORE-SAAS>`, si la carpeta está **vacía y no contiene .git**, ejecutar:

```powershell
git clone --branch desarrollo https://github.com/SFrancoH/Core-SAAS.git .
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

Si la carpeta **ya es repositorio Git**, NO ejecutar `git clone .` ni borrar archivos. Ejecutar:

```powershell
git status
git remote -v
git fetch origin
git switch --track origin/desarrollo
git pull --ff-only
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

Si `desarrollo` ya existe localmente, usar `git switch desarrollo`. Si `git status` muestra cambios sin guardar, guardarlos antes de cambiar ramas. No usar `git reset --hard` sin revisar.

## Actualizaciones posteriores

```powershell
git switch desarrollo
git pull --ff-only origin desarrollo
npm test
npm run typecheck
npm run build
```

## Promoción a main

Después de que pasen pruebas locales **y** SQL/JWT/RLS en Supabase Core de pruebas:

1. Revisar la PR abierta `desarrollo → main` (GitHub ejecuta CI).
2. Fusionar la PR solo si PETS sigue funcionando y no hay accesos cruzados entre empresas. Elegir 'Create a merge commit' (no 'Squash') para poder sincronizar desarrollo con --ff-only.
3. Sincronizar la rama de trabajo con main sin crear una tercera rama:

```powershell
git fetch origin
git switch desarrollo
git merge --ff-only origin/main
git push origin desarrollo
```

Si `git merge --ff-only` falla porque hubo commits nuevos en ambas ramas, detenerse y revisar diferencias antes de fusionar; no usar `push --force`.

## Ramas antiguas

La PR #1 a #10 están fusionadas. Nueve ramas antiguas conservan exactamente el SHA de su PR fusionada y pueden borrarse. La rama `feat/core-identity-multitenant-access` avanzó dos commits después de la PR #6: revisarla ANTES de borrarla. Para borrar las ramas antiguas en GitHub debes usar PowerShell con `git push origin --delete NOMBRE_RAMA` o la interfaz web. Ningún commit de este repositorio elimina ramas remotas. Los PR fusionados conservan su historial.

## Supabase

La app usa variables locales `SUPABASE_URL`, `SUPABASE_SECRET_KEY` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Para probar cambios de BD se necesita un proyecto Supabase **staging** separado o un entorno restaurable, nunca la instancia operativa de PULSE. Ejecutar SQL 010–013 si falta, después 014 y 015 según el preflight. La habilitación de PETS multiempresa no se activa por descargar esta rama.
