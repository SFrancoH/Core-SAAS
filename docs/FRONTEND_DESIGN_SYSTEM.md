# Core SaaS — Sistema de diseño global

**Fuente única de estética:** styles/tokens.css. Todas las verticales, incluido PETS, utilizan una misma identidad y componentes compartidos.

## Paleta inicial
| Elemento | Token CSS | Color inicial |
|---|---|---|
| Marca principal y botones | --color-primary | #147d4a |
| Marca oscura | --color-primary-dark | #215e41 |
| Texto principal | --color-text | #17211b |
| Texto secundario | --color-muted | #607066 |
| Fondo general | --color-page | #f4f7f5 |
| Superficie de tarjetas | --color-surface | #ffffff |
| Bordes | --color-border | #dce5de |
| Error | --color-danger | #b42318 |
| Información | --color-info | #0875f5 |
| Advertencia | --color-warning | #d28a19 |

Se mantiene la estética verde existente en PETS para evitar un cambio visual brusco, pero la marca de Core Admin es CORE SAAS.

## Capas del frontend
1. styles/tokens.css: valores canónicos de color, transparencias, tipografía, bordes y radios.
2. app/globals.css: estilos globales y PETS que consumen variables CSS.
3. styles/shell.css: diseño de cabeceras, páginas y tarjetas Core Admin que consumen variables.
4. components/ui: componentes reutilizables TypeScript.
5. components/layouts: shells para administración global y operación por vertical.
6. app: páginas y handlers por ruta, TypeScript TS/TSX.

Para cambiar la apariencia de todas las verticales editar los tokens semánticos y desplegar. Verificar contraste, focus, formularios, tablas y estados antes de publicarlo.

## Reglas permanentes
- Ningún nuevo color HEX o rgba fuera de styles/tokens.css.
- Mismas reglas de espaciado, botones, campos, tablas y estados para todas las verticales.
- Accesibilidad: foco de teclado, labels, semántica HTML, contraste, estados de carga y error.
- Responsive: contenido fluido y tablas desplazables en pantallas pequeñas.
- Los permisos son de backend, la UI nunca los reemplaza.
- Nuevos componentes solo en TypeScript, no JSX/JavaScript.
- Debe reutilizarse un componente existente antes de crear otro diferente para el mismo patrón.

## Apariencia en Core Admin
La ruta /super-admin/apariencia muestra una referencia visual de los tokens. No es un editor de configuración, no guarda temas en Supabase y no admite marca personalizada por empresa todavía. La personalización dinámica sería un producto futuro sujeto a permisos y un modelo de datos independiente.

## Pruebas
CI: instalación, tests, revisión de TypeScript y build. Regresión visual y funcional con datos ficticios: pendiente antes de considerar producción verificada.
