# PETS — Especificación de formularios de servicios veterinarios

**Documento de referencia para una IA de desarrollo.**  
**Fuentes:** 10 archivos PDF aportados por el usuario (capturas de formularios de HOPS PETS) **y requisitos funcionales adicionales proporcionados expresamente por el usuario para Inventario**.  
**Alcance:** estructura visible de los formularios; secciones, campos, controles y tipos de datos; **módulo Inventario, catálogos compartidos y sincronización con formularios**.  
**Estado:** los apartados 1–12 documentan principalmente las capturas; el apartado 13 describe **requisitos añadidos por el usuario**. **No es un esquema de base de datos existente ni prueba del funcionamiento interno.**

> **Instrucción principal para la IA implementadora:** reproducir la estructura funcional documentada para los formularios del sistema PETS. No introducir por cuenta propia opciones de listas, campos clínicos, obligatoriedades, reglas comerciales, catálogos, estados o automatizaciones no observables en las fuentes. Cuando un valor, selector o comportamiento no sea visible **ni haya sido definido expresamente por el usuario**, dejarlo como **pendiente de definición**, en lugar de inventarlo. **Las reglas explícitas de inventario del apartado 13 prevalecen sobre las anteriores menciones de «catálogo pendiente» para medicamentos, vacunas, desparasitantes, insumos y productos.**

---

## 1. Cómo interpretar esta especificación

### 1.1. Convenciones para tipos y controles

| Notación | Control visual esperado | Tipo lógico recomendado | Observación |
|---|---|---|---|
| `texto_corto` | Campo de una línea | `string` | Nombre, descripción breve, ubicación, etc. |
| `texto_largo` | Área de texto de varias líneas (`textarea`) | `string` | Observaciones, diagnósticos, descripciones clínicas. |
| `numero_entero` | Campo numérico | `integer` | Cantidades y mediciones sin decimales, cuando corresponda. |
| `numero_decimal` | Campo numérico con decimales | `number` / `decimal` | Peso, temperatura, parámetros clínicos, etc. |
| `importe` | Campo de valor monetario | `decimal` | No inferir moneda, tarifa ni cálculo automático a partir de una captura. |
| `fecha` | Entrada de fecha | `date` | Sin hora cuando la etiqueta no la requiere. |
| `fecha_hora` | Entrada de fecha y hora | `datetime` | Los valores mostrados en los PDF son ejemplos, no constantes. |
| `lista` | Selector desplegable (`select`) | `string` o ID de catálogo | Si el catálogo no está definido, sus opciones quedan pendientes; las listas conectadas a Inventario se rigen por el apartado 13. |
| `lista_inventario` | Selector filtrado por etiqueta estándar | ID de artículo de inventario | Catálogo vivo de la empresa, filtrado por `Producto`, `Medicamento`, `Vacuna`, `Desparasitante` o `Insumo` según el campo. |
| `lista_busqueda` | Selector con búsqueda/limpieza | ID de entidad o `string` | Se aprecia visualmente en algunos selectores de propietario/mascota. |
| `opcion_unica` | Grupo de botones de radio | `enum` | Solo cuando se muestran círculos de selección mutuamente excluyentes. |
| `casilla` | Checkbox | `boolean` | Puede aparecer en una opción concreta. |
| `url_imagen` | Campo URL de una imagen | `string` (URL) | El Inventario permite guardar la dirección de la imagen representativa y mostrarla en la ficha emergente. |
| `archivo` | Área de subida | referencia a archivo | Conservar archivo y metadatos; la captura no demuestra dónde se almacena. |
| `archivos` | Subida múltiple | lista de referencias | El contador `(0/3)` señala máximo visible de 3 en los formularios que lo exhiben. |
| `repetidor` | Tabla/lista editable de filas | `array<object>` | Cada fila contiene sus propios campos; `+` permite añadir cuando se ve explícitamente. |
| `precargado` | Campo con valor existente | Variable según el dato | Debe venir del registro relacionado; no escribir valores de ejemplo como predeterminados. |

**Advertencias de interpretación:**

1. Las claves `snake_case` incluidas en las tablas son **identificadores propuestos para orientar a la IA**, no nombres confirmados de columnas de Supabase ni de la aplicación original.
2. `Precargado` **no equivale automáticamente a solo lectura**. La captura demuestra que existe un valor visible, pero no si puede modificarse.
3. Cuando un campo presenta una lista desplegable pero no se abre en la captura, indicar **`opciones: pendientes`**, **salvo** que se trate de `Medicamento`, `Vacuna`, `Desparasitante`, `Insumo` o `Producto`, cuyos elementos provienen de Inventario (apartado 13). No asumir opciones médicas convencionales.
4. Cuando un campo contiene un número de historia, documento o microchip, manejarlo como **identificador de texto** para preservar ceros iniciales y formatos.
5. La edad presentada como «11 años y 8 meses» es una **cadena legible**; puede calcularse desde fecha de nacimiento en PETS, sin asumir que el formulario exige ingresarla manualmente.
6. Un asterisco de obligatoriedad, máscaras, límites de caracteres, validación de medicamentos, permisos y comportamiento de guardado **no son verificables** en estas capturas, salvo que se especifique expresamente.
7. Los encabezados de tablas con scroll horizontal pueden mostrar solo parte de las columnas. **No completar las columnas ocultas por suposición.**
8. No copiar la marca, la navegación lateral, las rutas PHP ni los datos particulares del paciente del sistema de referencia como parte de la implementación de PETS.

### 1.2. Comportamientos compartidos visibles

- Los formularios se abren en el contexto del **detalle de una mascota**; varios campos de identificación ya aparecen completos.
- La fecha de registro o admisión se muestra ya cargada con fecha y hora en la mayoría de formularios.
- Los desplegables de médico, responsable y servicio requieren una fuente de opciones aún no especificada. Los de **medicamento e insumo**, al igual que los de **vacuna y desparasitante**, sí tienen un origen definido posteriormente por el usuario: **Inventario**, filtrado por etiqueta estándar (apartado 13).
- Un botón `+` junto al selector aparece en determinados formularios. Documenta una acción visual de **agregar otro elemento relacionado**; el flujo interno exacto no puede asegurarse.
- Las tablas de medicamentos e insumos presentan filas editables y, con frecuencia, barras de desplazamiento horizontal.
- Los formularios terminan con acciones como **Registrar / Cancelar** o **Aplicar / Cancelar**. No asumir que «Aplicar» y «Registrar» tienen efectos diferentes en la base de datos sin una regla adicional.
- Se debe vincular cada registro con la **mascota correcta**; la relación técnica concreta (`mascota_id`, historia, etc.) depende del modelo de datos de PETS, no de los PDF.

### 1.3. Catálogos y componentes reutilizables identificados

| Componente funcional | Presente en | Datos visibles |
|---|---|---|
| Selector de médico veterinario | Anestesia, cirugía, eutanasia, laboratorio, hospitalización, medicación, vacunación | Lista de profesionales; opciones no visibles. |
| Selector de responsable | Desparasitación, estética, guardería | Lista; opciones no visibles. |
| Tipo de servicio `+` | Anestesia, eutanasia, laboratorio, guardería, hospitalización, medicación, vacunación | Lista y botón adicional. |
| Tipo de estética `+` | Estética | Lista y botón adicional. |
| Área de consulta `+` | Cirugía | Lista y botón adicional. |
| Medicamentos | Anestesia, cirugía, hospitalización, medicación | Selector conectado a artículos de Inventario con etiqueta `Medicamento`; dosis, vía, frecuencia y otras columnas se mantienen como campos del formulario. |
| Insumos | Cirugía, desparasitación, estética, laboratorio, hospitalización, medicación, vacunación | Selector conectado a artículos de Inventario con etiqueta `Insumo`; cantidad y otras columnas dependen del formulario. |
| Signos vitales | Anestesia, cirugía, hospitalización | Temperatura, peso, frecuencia cardíaca y respiratoria. |
| Archivos adjuntos (hasta 3) | Anestesia, cirugía | Zona de carga identificada por contador `(0/3)`. |

**Regla para la IA:** compartir componentes de interfaz es aceptable, pero **no fusionar formularios diferentes** ni trasladar un campo a otro formulario si no está en su captura.

---

## 2. Formulario: Registro de anestesia

- **Identificador propuesto:** `registro_anestesia`
- **Título visible:** «Registrando Anestesia».
- **Fuente:** `Formulario registro de Anestesia.pdf`, páginas 1 a 4.
- **Estructura:** secciones con encabezados visibles y tablas de medicamentos repetibles.

### 2.1. Sección «Información general» (p. 1)

| Campo | Clave propuesta | Control / tipo | Observación |
|---|---|---|---|
| No. historia | `numero_historia` | `texto_corto` / `string` | Precargado desde historia clínica. |
| Fecha de admisión | `fecha_admision` | `fecha_hora` | En la captura aparece completa. |
| Médico veterinario | `medico_veterinario_id` | `lista` | Opciones pendientes. |
| No. de microchip | `numero_microchip` | `texto_corto` / `string` | Identificador; no forzar tipo numérico. |
| Paciente | `paciente` | `texto_corto` / `string` | Precargado. |
| Especie | `especie` | `texto_corto` / `string` | Precargado en la captura. |
| Raza | `raza` | `texto_corto` / `string` | Precargado. |
| Sexo | `sexo` | `texto_corto` / `string` | Precargado. |
| Edad | `edad_texto` | `texto_corto` / `string` | Valor legible expresado en años y meses. |
| Tipo de servicio | `tipos_servicio` | `lista` + botón `+` | Selector, con posibilidad visual de añadir un elemento; no se conocen opciones. |
| Valor total del servicio | `valor_total_servicio` | `importe` | Se muestra `0` como valor inicial en la captura. |

### 2.2. Sección «Estado general» (p. 2)

| Campo | Clave propuesta | Control / tipo | Observación |
|---|---|---|---|
| Temperatura | `temperatura` | `numero_decimal` | Placeholder: «Temperatura actual del animal». Unidad no escrita en la etiqueta de este formulario. |
| Peso actual (Kg) | `peso_actual_kg` | `numero_decimal` | Unidad visible: kilogramos. |
| Frecuencia cardiaca | `frecuencia_cardiaca_lpm` | `numero_entero` | Placeholder en lpm. |
| Frecuencia respiratoria | `frecuencia_respiratoria_rpm` | `numero_entero` | Placeholder en rpm. |
| Diagnóstico definitivo | `diagnostico_definitivo` | `texto_largo` | Área multilineal. |
| RGR | `rgr` | `numero_decimal` | Placeholder: «Recuento de eritrocitos»; unidad no indicada. |
| Hto | `hematocrito_porcentaje` | `numero_decimal` | Placeholder: «Hematocrito (%)». |
| Hb | `hemoglobina` | `numero_decimal` | Placeholder: «Concentración de hemoglobina». |
| RGB | `rgb` | `texto_corto` | **Etiqueta tal como se lee en la captura**; placeholder «Color de la sangre». No reinterpretar el acrónimo. |
| Proteínas plasmáticas | `proteinas_plasmaticas` | `numero_decimal` | Sin unidad visible. |
| ALT | `alt` | `numero_decimal` | Placeholder: «Alanina aminotransferasa». |
| CRAT | `crat` | `numero_decimal` | Placeholder: «Creatinina»; conservar rótulo visible. |
| Glucosa | `glucosa` | `numero_decimal` | Sin unidad visible. |
| Estatus ASA | `estatus_asa` | `lista` | Opciones pendientes; no inferir categorías. |

### 2.3. Sección «Procedimiento» (p. 2–3)

| Campo | Clave propuesta | Control / tipo | Observación |
|---|---|---|---|
| Procedimiento quirúrgico | `procedimiento_quirurgico` | `texto_largo` | Área de texto situada al final de p. 2 y continúa en p. 3. |

#### Subbloque «Premedicación» (p. 3)

Tabla de medicamentos `premedicacion[]`. Cada fila presenta:

| Columna | Clave | Control / tipo | Nota |
|---|---|---|---|
| Medicamento | `medicamento_id` | `lista_inventario` | Opciones obtenidas de Inventario, etiqueta estándar `Medicamento` (apartado 13). |
| Dosis terapéutica | `dosis` | `numero_decimal` | Entrada pequeña; junto a ella aparece otro desplegable. |
| Selector junto a dosis | `dosis_unidad_o_tipo` | `lista` | **La etiqueta específica no es legible**; no inventar unidades. |
| Vía admin. | `via_administracion` | `lista` | Opciones pendientes. |
| Frecuencia | `frecuencia` | `lista` | Opciones pendientes. |
| Cantidad total | `cantidad_total` | `numero_decimal` | Aparece `1` en la fila inicial. |
| Acciones | — | botón `+` | Agregar otra fila. |

#### Subbloque «Inducción» (p. 3)

Tabla `induccion[]` con **la misma estructura visible** que `premedicacion[]`: medicamento, dosis terapéutica (entrada y selector), vía de administración, frecuencia, cantidad total y botón `+`.

### 2.4. Sección «Mantenimiento» (p. 3)

#### Subbloque «TIVA»

Tabla `mantenimiento_tiva[]` con **la misma estructura visible** que las de premedicación e inducción: medicamento, dosis terapéutica, selector junto a dosis, vía de administración, frecuencia, cantidad total y `+`.

#### Subbloque «PIVA»

| Campo | Clave | Control / tipo | Observación |
|---|---|---|---|
| Isoflurano | `piva_isoflurano` | `casilla` / `boolean` | Checkbox individual. |
| Otro | `piva_otro` | `texto_corto` | Placeholder: «Otro, ¿cuál?». |

### 2.5. Sección «Fluidoterapia» (p. 3–4)

| Campo | Clave | Control / tipo | Observación |
|---|---|---|---|
| Tipo de solución | `tipo_solucion` | `lista` | En p. 3. Opciones pendientes. |
| Tipo de goteo | `tipo_goteo` | `lista` | En p. 4. Opciones pendientes. |
| Gotas / segundo | `gotas_por_segundo` | `numero_decimal` | Medición por segundo. |

### 2.6. Secciones finales (p. 4)

| Sección | Campo | Clave | Control / tipo | Observación |
|---|---|---|---|---|
| Comentarios | Comentarios | `comentarios` | `texto_largo` | Área multilineal. |
| Archivos adjuntos | Adjuntar archivos | `archivos_adjuntos` | `archivos` | Zona de subir/arrastrar; contador visible `(0/3)`. |

**Acciones finales:** `Registrar`, `Cancelar`.

---

## 3. Formulario: Registro de cirugía

- **Identificador propuesto:** `registro_cirugia`
- **Título visible:** «Registrando Cirugía».
- **Fuente:** `Formulario registro de Cirugia.pdf`, páginas 1 a 4.

### 3.1. Sección «Información general» (p. 1)

| Campo | Clave propuesta | Control / tipo | Observación |
|---|---|---|---|
| No. historia | `numero_historia` | `texto_corto` | Precargado; identificador. |
| Fecha de admisión | `fecha_admision` | `fecha_hora` | Precargada. |
| Médico veterinario | `medico_veterinario_id` | `lista` | Opciones pendientes. |
| No. de microchip | `numero_microchip` | `texto_corto` | Identificador. |
| Paciente | `paciente` | `texto_corto` | Precargado. |
| Especie | `especie` | `texto_corto` | Precargado. |
| Raza | `raza` | `texto_corto` | Precargado. |
| Sexo | `sexo` | `texto_corto` | Precargado. |
| Edad | `edad_texto` | `texto_corto` | Ejemplo textual en años y meses. |
| Color | `color` | `texto_corto` | Placeholder: «Color del animal». |
| Fin zootécnico | `fin_zootecnico` | `lista` | Opciones pendientes. |

### 3.2. Sección «Estado general» (p. 2)

| Campo | Clave | Control / tipo | Observación |
|---|---|---|---|
| Temperatura | `temperatura` | `numero_decimal` | Temperatura actual del animal. |
| Peso actual | `peso_actual` | `numero_decimal` | Peso actual del animal; etiqueta sin unidad explícita. |
| Frecuencia cardiaca | `frecuencia_cardiaca_lpm` | `numero_entero` | Placeholder en lpm. |
| Frecuencia respiratoria | `frecuencia_respiratoria_rpm` | `numero_entero` | Placeholder en rpm. |
| Diagnóstico definitivo | `diagnostico_definitivo` | `texto_largo` | Área multilineal. |

### 3.3. Sección «Procedimiento» (p. 2)

| Campo | Clave | Control / tipo |
|---|---|---|
| Procedimiento quirúrgico | `procedimiento_quirurgico` | `texto_largo` |
| Abordaje | `abordaje` | `texto_largo` |
| Diagnóstico quirúrgico | `diagnostico_quirurgico` | `texto_largo` |

### 3.4. Sección «Decisiones médicas» (p. 3)

| Campo | Clave | Control / tipo | Observación |
|---|---|---|---|
| Área de consulta | `areas_consulta` | `lista` + botón `+` | Selector de elementos relacionados; opciones pendientes. |
| Decisión médica | `decision_medica` | `opcion_unica` | Se ven cuatro controles circulares. |
| Valor total del servicio | `valor_total_servicio` | `importe` | Se muestra `0` en la captura. |

**Opciones visibles del grupo «Decisión médica» (escribirlas tal como aparecen):**

1. `Tratamiento farmacológico en casa`
2. `Ambulatorio`
3. `Hospitalización`
4. `Tratamiento farmacológico diario`

> La apariencia sugiere selección única. Si el sistema fuente permitiera varias decisiones al mismo tiempo, esa regla **no es verificable** aquí.

### 3.5. Sección «Plan terapéutico» (p. 3)

| Campo | Clave | Control / tipo | Observación |
|---|---|---|---|
| Observaciones | `observaciones_plan` | `texto_largo` | Área multilineal. |

**Tabla de medicamentos `plan_terapeutico_medicamentos[]`:**

| Columna visible | Clave | Control / tipo | Observación |
|---|---|---|---|
| Medicamento | `medicamento_id` | `lista_inventario` | Opciones obtenidas de Inventario, etiqueta estándar `Medicamento` (apartado 13). |
| Dosis terapéutica | `dosis` | `numero_decimal` | Entrada pequeña. |
| Selector adyacente a dosis | `dosis_unidad_o_tipo` | `lista` | Encabezado preciso no legible. |
| Vía admin. | `via_administracion` | `lista` | Opciones pendientes. |
| Frecuencia | `frecuencia` | `lista` | Opciones pendientes. |
| Columnas fuera de vista | — | **pendiente** | La tabla tiene desplazamiento horizontal y no se ven todas sus columnas. |

**Tabla «Insumos» `plan_terapeutico_insumos[]`:**

| Columna visible | Clave | Control / tipo | Observación |
|---|---|---|---|
| Insumo | `insumo_id` | `lista_inventario` | Opciones obtenidas de Inventario, etiqueta estándar `Insumo` (apartado 13). |
| Cantidad | `cantidad` | `numero_decimal` | Se ve `1` por defecto. |
| Columnas fuera de vista | — | **pendiente** | No deducir nombres o estructura de las columnas ocultas. |

### 3.6. Secciones finales (p. 4)

| Sección | Campo | Clave | Control / tipo | Observación |
|---|---|---|---|---|
| Comentarios | Comentarios | `comentarios` | `texto_largo` | Área multilineal. |
| Pronóstico | Pronóstico | `pronostico` | `texto_largo` | Área multilineal. |
| Archivos adjuntos | Adjuntar archivos | `archivos_adjuntos` | `archivos` | Carga por selección/arrastre, contador `(0/3)`. |

**Acciones finales:** `Registrar`, `Cancelar`.

---

## 4. Formulario: Aplicar desparasitación

- **Identificador propuesto:** `aplicar_desparasitacion`
- **Título visible:** «Aplicando Desparasitación».
- **Fuente:** `Formulario registro desparacitacion.pdf`, páginas 1 y 2.
- **Nota estructural:** no hay paneles con encabezados separados para los datos básicos; los bloques siguientes organizan visualmente la información para una IA, pero **no son títulos visibles del original**.

### 4.1. Bloque principal (p. 1)

| Campo | Clave | Control / tipo | Observación |
|---|---|---|---|
| Mascota | `mascota` | `texto_corto` | Precargada. |
| Cliente | `cliente` | `texto_corto` | Precargado; en el ejemplo incluye nombre y documento. |
| Fecha de registro | `fecha_registro` | `fecha_hora` | Precargada. |
| Responsable | `responsable_id` | `lista` | Opciones pendientes. |
| Valor total del servicio | `valor_total_servicio` | `importe` | Valor visible inicial `0`. |
| Descripción | `descripcion` | `texto_corto` | Una línea. |
| Peso en Kg | `peso_kg` | `numero_decimal` | Placeholder «Peso actual del animal». |
| Observaciones | `observaciones` | `texto_largo` | Área multilineal; menciona desparasitación. |

### 4.2. Bloque «Registro de desparasitación sin inventario» (p. 1–2)

Aparece este texto acompañado de un icono informativo. **No se observa un control activable asociado a la frase**. No interpretar «sin inventario» como un `boolean` sin confirmación.

**Tabla de desparasitante(s) `desparasitantes[]`:**

| Columna visible | Clave | Control / tipo | Observación |
|---|---|---|---|
| Desparasitante | `desparasitante_id` | `lista_inventario` | Opciones obtenidas de Inventario, etiqueta estándar `Desparasitante` (apartado 13). |
| Cantidad | `cantidad` | `numero_decimal` | Fila inicial con `1`. |
| Columna posterior parcialmente visible | — | **pendiente** | En el borde se alcanza a ver un encabezado truncado («Unic…»); no asumir su denominación exacta. |

**Control adicional visible debajo de la tabla:**

| Campo | Clave | Control / tipo | Opciones |
|---|---|---|---|
| Insumos | `incluir_insumos` | `opcion_unica` | `Sí` / `No`; en la captura está marcado `No`. |

**Acciones finales:** `Aplicar`, `Cancelar`.

---

## 5. Formulario: Registro de estética

- **Identificador propuesto:** `registro_estetica`
- **Título visible:** «Registrando Estética».
- **Fuente:** `Formulario registro Estetica.pdf`, páginas 1 y 2.
- **Nota:** la fuente presenta el formulario como un bloque continuo, no como tarjetas con varias secciones tituladas.

### 5.1. Datos y servicio (p. 1–2)

| Campo | Clave | Control / tipo | Observación |
|---|---|---|---|
| Nombre completo del propietario | `propietario_id` | `lista_busqueda` | Selector con valor, icono `×` y flecha; sugiere posibilidad de limpiar/cambiar. |
| Nombre de la mascota | `mascota_id` | `lista_busqueda` | Selector con valor, icono `×` y flecha. |
| Fecha de registro | `fecha_registro` | `fecha_hora` | Precargada. |
| Tipo de estética | `tipos_estetica` | `lista` + botón `+` | Opciones pendientes; botón adicional. |
| Peso actual | `peso_actual` | `numero_decimal` | Placeholder «Peso actual del animal». |
| Instrucciones u observaciones | `instrucciones_observaciones` | `texto_largo` | Área multilineal. |
| Responsable del servicio | `responsable_servicio_id` | `lista` | Opciones pendientes. |
| Segundo Responsable | `segundo_responsable_id` | `lista` | Opciones pendientes. |
| Costos adicionales | `costos_adicionales` | `importe` | Una línea; visible entre p. 1 y 2. |
| Foto | `foto` | `archivo` | Zona de selección/arrastre. No aparece contador de archivos. |
| Valor total del servicio | `valor_total_servicio` | `importe` | Se muestra `0` en la captura. |

### 5.2. Bloque «Insumos» (p. 2)

Tabla `insumos[]`:

| Columna visible | Clave | Control / tipo | Observación |
|---|---|---|---|
| Insumo | `insumo_id` | `lista_inventario` | Opciones obtenidas de Inventario, etiqueta estándar `Insumo` (apartado 13). |
| Cantidad | `cantidad` | `numero_decimal` | Valor inicial visible `1`. |
| Columna posterior parcialmente visible | — | **pendiente** | Encabezado truncado («Unic…») y controles no completamente visibles por scroll horizontal. |

**Acciones finales:** `Registrar`, `Cancelar`.

---

## 6. Formulario: Registro de eutanasia

- **Identificador propuesto:** `registro_eutanasia`
- **Título visible:** «Registrando Eutanasia».
- **Fuente:** `Formulario registro eutanacia.pdf`, páginas 1 y 2.
- **Nota:** los campos se muestran en un bloque continuo.

### 6.1. Campos

| Campo | Clave | Control / tipo | Observación |
|---|---|---|---|
| No. historia | `numero_historia` | `texto_corto` | Identificador precargado. |
| Fecha de admisión | `fecha_admision` | `fecha_hora` | Precargada. |
| Médico veterinario | `medico_veterinario_id` | `lista` | Opciones pendientes. |
| Paciente | `paciente` | `texto_corto` | Precargado. |
| Especie | `especie` | `texto_corto` | Precargado. |
| Raza | `raza` | `texto_corto` | Precargado. |
| Sexo | `sexo` | `texto_corto` | Precargado. |
| Edad | `edad_texto` | `texto_corto` | Representación legible de edad. |
| Tipo de servicio | `tipos_servicio` | `lista` + botón `+` | Opciones pendientes. |
| Valor total del servicio | `valor_total_servicio` | `importe` | Valor visible inicial `0`. |
| Descripción | `descripcion` | `texto_largo` | Área extensa que continúa en p. 2. |

**Acciones finales:** `Registrar`, `Cancelar`.

**No aparecen en las fuentes:** firmas, consentimiento, selección de causa, registro de fallecimiento ni adjuntos. No agregarlos como campos de este formulario sin instrucciones adicionales.

---

## 7. Formulario: Registro de examen de laboratorio

- **Identificador propuesto:** `registro_examen_laboratorio`
- **Título visible:** «Registrando Examen Laboratorio».
- **Fuente:** `Formulario registro Examen Laboratorio.pdf`, páginas 1 y 2.

### 7.1. Identificación y servicio (p. 1–2)

| Campo | Clave | Control / tipo | Observación |
|---|---|---|---|
| No. historia | `numero_historia` | `texto_corto` | Identificador precargado. |
| Fecha de registro | `fecha_registro` | `fecha_hora` | Precargada. |
| Médico veterinario | `medico_veterinario_id` | `lista` | Opciones pendientes. |
| Propietario | `propietario` | `texto_corto` | Precargado. |
| Paciente | `paciente` | `texto_corto` | Precargado. |
| Especie | `especie` | `texto_corto` | Precargado. |
| Raza | `raza` | `texto_corto` | Precargado. |
| No. de microchip | `numero_microchip` | `texto_corto` | Identificador. |
| Sexo | `sexo` | `texto_corto` | Precargado. |
| Edad | `edad_texto` | `texto_corto` | Edad legible. |
| Tipo de servicio | `tipos_servicio` | `lista` + botón `+` | Opciones pendientes. |
| Valor total del servicio | `valor_total_servicio` | `importe` | Al comienzo de p. 2; valor visible `0`. |
| Observaciones | `observaciones` | `texto_largo` | Área multilineal. |

### 7.2. Tabla de exámenes complementarios (p. 2)

Tabla `examenes_complementarios[]`:

| Columna | Clave | Control / tipo | Observación |
|---|---|---|---|
| Fecha orden del examen | `fecha_orden_examen` | `fecha` | La fecha se visualiza truncada por el ancho de la celda. |
| Examen complementario | `examen_complementario` | `texto_corto` | Campo de texto. |
| ¿Se realizó? | `se_realizo` | `opcion_unica` | `Sí` / `No`; se ve `No` seleccionado. |
| Otras columnas fuera de vista | — | **pendiente** | Hay scroll horizontal; no se conocen todas las columnas. |

### 7.3. Tabla «Insumos» (p. 2)

Tabla `insumos[]`:

| Columna visible | Clave | Control / tipo | Observación |
|---|---|---|---|
| Insumo | `insumo_id` | `lista_inventario` | Opciones obtenidas de Inventario, etiqueta estándar `Insumo` (apartado 13). |
| Cantidad | `cantidad` | `numero_decimal` | Valor inicial visible `1`. |
| Columna posterior parcialmente visible | — | **pendiente** | Encabezado truncado («Unic…»). |

**Acciones finales:** `Registrar`, `Cancelar`.

---

## 8. Formulario: Registro de guardería

- **Identificador propuesto:** `registro_guarderia`
- **Título visible:** «Registrando Guardería».
- **Fuente:** `Formulario registro Guarderia.pdf`, páginas 1 a 3.
- **Estructura funcional identificable:** identificación de mascota, registro de ingreso y registro de salida; estos son **bloques descriptivos**, no necesariamente encabezados visibles del original.

### 8.1. Datos iniciales (p. 1–2)

| Campo | Clave | Control / tipo | Observación |
|---|---|---|---|
| No. historia | `numero_historia` | `texto_corto` | Identificador precargado. |
| Fecha de ingreso | `fecha_ingreso` | `fecha_hora` | Precargada. |
| Responsable del servicio | `responsable_servicio_id` | `lista` | Opciones pendientes. |
| Propietario | `propietario` | `texto_corto` | Precargado. |
| Mascota | `mascota` | `texto_corto` | Precargada. |
| Especie | `especie` | `texto_corto` | Precargada. |
| Raza | `raza` | `texto_corto` | Precargada. |
| No. de microchip | `numero_microchip` | `texto_corto` | Identificador. |
| Sexo | `sexo` | `texto_corto` | Precargado; la muestra contiene el texto «HE»; no usarlo como opción universal. |
| Edad | `edad_texto` | `texto_corto` | Ejemplo en años y meses. |
| Peso actual | `peso_actual` | `numero_decimal` | Placeholder: «Peso actual del animal». |
| Tipo de servicio | `tipos_servicio` | `lista` + botón `+` | Opciones pendientes. |
| Valor total del servicio | `valor_total_servicio` | `importe` | Se muestra `0`. |

### 8.2. Bloque de ingreso (p. 2)

| Campo | Clave | Control / tipo | Observación |
|---|---|---|---|
| Responsable de ingreso | `responsable_ingreso_id` | `lista` | Se ve una persona seleccionada. |
| No. documento | `documento_ingreso` | `texto_corto` | Identificador mostrado debajo del responsable. |
| Ubicación de la mascota | `ubicacion_mascota` | `texto_corto` | Una línea. |
| Descripción de ingreso | `descripcion_ingreso` | `texto_largo` | Área extensa. |
| Foto de ingreso | `foto_ingreso` | `archivo` | Selección/arrastre de imagen. |

### 8.3. Bloque de salida (p. 2–3)

| Campo | Clave | Control / tipo | Observación |
|---|---|---|---|
| Registro de salida | `registro_salida` | `opcion_unica` | `Sí` / `No`; `Sí` marcado en el ejemplo. |
| Fecha de salida | `fecha_salida` | `fecha_hora` | Aparece con fecha y hora. |
| Responsable de la salida | `responsable_salida_id` | `lista_busqueda` | Selector con persona, botón para limpiar y flecha. |
| No. documento | `documento_salida` | `texto_corto` | Identificador bajo el responsable. |
| Descripción de salida | `descripcion_salida` | `texto_largo` | Área extensa. |
| Foto de salida | `foto_salida` | `archivo` | Selección/arrastre de imagen. |

**Acciones finales:** `Registrar`, `Cancelar`.

**Comportamiento condicionado — sugerencia NO confirmada:** si `registro_salida = No`, tendría sentido ocultar o inhabilitar los campos del bloque de salida. La captura solamente muestra el estado `Sí`, así que **no consta** qué hace la interfaz original al marcar `No`. Solicitar definición antes de implementar una regla irreversible.

---

## 9. Formulario: Registro de hospitalización

- **Identificador propuesto:** `registro_hospitalizacion`
- **Título visible:** «Registrando Hospitalización».
- **Fuente:** `Formulario registro Hospitalizacion.pdf`, páginas 1 a 3.
- **Rasgo distintivo:** empieza con una tabla de planificación de medicamentos y luego contiene el **primer control de hospitalización**; no hay un bloque de identificación de mascota visible como en los demás.

### 9.1. Bloque «Planeación, aplicación y control de medicamentos» (p. 1)

Tabla `medicamentos_hospitalizacion[]`:

| Columna visible | Clave | Control / tipo | Observación |
|---|---|---|---|
| Medicamento | `medicamento_id` | `lista_inventario` | Opciones obtenidas de Inventario, etiqueta estándar `Medicamento` (apartado 13). |
| Dosis terapéutica | `dosis` | `numero_decimal` | Se ve una entrada numérica con `1` en el ejemplo. |
| Selector junto a dosis | `dosis_unidad_o_tipo` | `lista` | No se lee el rótulo completo. |
| Vía admin. | `via_administracion` | `lista` | Opciones pendientes. |
| Frecuencia | `frecuencia` | `lista` | Opciones pendientes. |
| Columnas adicionales | — | **pendiente** | La tabla tiene scroll horizontal y vertical; la captura no muestra todo su contenido. |

| Campo adicional | Clave | Control / tipo | Opciones / estado de ejemplo |
|---|---|---|---|
| Insumos | `incluir_insumos` | `opcion_unica` | `Sí` / `No`; `No` marcado. |

### 9.2. Bloque «Registro del primer control de hospitalización» (p. 1–3)

| Campo | Clave | Control / tipo | Observación |
|---|---|---|---|
| Tipo de servicio | `tipos_servicio` | `lista` + botón `+` | Opciones pendientes. |
| Valor total del servicio | `valor_total_servicio` | `importe` | Se muestra `0`. |
| Fecha y hora de registro | `fecha_hora_registro` | `fecha_hora` | Precargada. |
| Médico veterinario | `medico_veterinario_id` | `lista` | Opciones pendientes. |
| Temperatura (°C) | `temperatura_c` | `numero_decimal` | Unidad visible: °C. |
| Peso actual (Kg) | `peso_actual_kg` | `numero_decimal` | Unidad visible: kg. |
| Frecuencia cardiaca (lpm) | `frecuencia_cardiaca_lpm` | `numero_entero` | Latidos/minuto. |
| Frecuencia respiratoria (rpm) | `frecuencia_respiratoria_rpm` | `numero_entero` | Respiraciones/minuto. |
| Deshidratación (%) | `deshidratacion_porcentaje` | `numero_decimal` | Porcentaje explícito. |
| Tiempo llenado capilar | `tiempo_llenado_capilar` | `lista` | Opciones pendientes. |
| Pulso | `pulso` | `texto_corto` | Placeholder: «Pulso del animal». No hay unidad ni rango visibles. |
| Apetito | `apetito` | `texto_corto` | Placeholder: «Apetito del animal». |
| Sed | `sed` | `texto_corto` | Placeholder: «Sed del animal». |
| Color mucosas | `color_mucosas` | `texto_corto` | Placeholder: «Color de las mucosas del animal». |
| Vómito | `vomito` | `texto_corto` | Placeholder: «Vómito del animal». |
| Producción de orina | `produccion_orina` | `texto_corto` | Placeholder: «Producción de orina del animal». |
| Consistencia fecal | `consistencia_fecal` | `texto_corto` | Placeholder: «Consistencia fecal del animal». |
| Estado de ánimo | `estado_animo` | `texto_corto` | Placeholder: «Estado de ánimo del animal». |
| Pronóstico | `pronostico` | `texto_corto` | Una línea (comienza en p. 2 y se ve en p. 3). |
| SOIP (Datos subjetivos, objetivos interpretativos y plan terapéutico) | `soip` | `texto_largo` | Conservar acrónimo **SOIP**, tal como lo presenta la captura. |

**Acciones finales:** `Registrar`, `Cancelar`.

**Importante:** esta captura documenta el **primer control**; no prueba el flujo posterior de seguimientos, turnos ni repetición de controles. No inventar esas pantallas dentro de esta especificación.

---

## 10. Formulario: Registro de medicación / inyectología

- **Identificador propuesto:** `registro_medicacion_inyectologia`
- **Título visible:** «Registrando Medicación/Inyectología».
- **Fuente:** `Formulario registro medicacion- inyectologia.pdf`, páginas 1 y 2.

### 10.1. Datos iniciales y servicio (p. 1–2)

| Campo | Clave | Control / tipo | Observación |
|---|---|---|---|
| No. historia | `numero_historia` | `texto_corto` | Precargado. |
| Fecha de registro | `fecha_registro` | `fecha_hora` | Precargada. |
| Médico veterinario | `medico_veterinario_id` | `lista` | Opciones pendientes. |
| Propietario | `propietario` | `texto_corto` | Precargado. |
| Paciente | `paciente` | `texto_corto` | Precargado. |
| Especie | `especie` | `texto_corto` | Precargado. |
| Raza | `raza` | `texto_corto` | Precargado. |
| Sexo | `sexo` | `texto_corto` | Precargado. |
| Edad | `edad_texto` | `texto_corto` | Ejemplo en años y meses. |
| Peso actual | `peso_actual` | `numero_decimal` | Placeholder «Peso actual del animal». |
| Tipo de servicio | `tipos_servicio` | `lista` + botón `+` | Opciones pendientes. |
| Valor total del servicio | `valor_total_servicio` | `importe` | Se ve `0`. |
| Observaciones | `observaciones` | `texto_largo` | Área multilineal. |

### 10.2. Tabla de medicamentos (p. 2)

Tabla `medicamentos[]`:

| Columna visible | Clave | Control / tipo | Observación |
|---|---|---|---|
| Medicamento | `medicamento_id` | `lista_inventario` | Opciones obtenidas de Inventario, etiqueta estándar `Medicamento` (apartado 13). |
| Dosis terapéutica | `dosis` | `numero_decimal` | Entrada pequeña. |
| Selector junto a dosis | `dosis_unidad_o_tipo` | `lista` | Etiqueta no legible. |
| Vía admin. | `via_administracion` | `lista` | Opciones pendientes. |
| Frecuencia | `frecuencia` | `lista` | Opciones pendientes. |
| Cantidad total (truncada) | `cantidad_total` | `numero_decimal` | Se ve encabezado `Cant... tot...` y `1` en la celda. |
| Otras columnas fuera de vista | — | **pendiente** | Barra de desplazamiento horizontal. |

### 10.3. Tabla «Insumos» (p. 2)

Tabla `insumos[]`:

| Columna visible | Clave | Control / tipo | Observación |
|---|---|---|---|
| Insumo | `insumo_id` | `lista_inventario` | Opciones obtenidas de Inventario, etiqueta estándar `Insumo` (apartado 13). |
| Cantidad | `cantidad` | `numero_decimal` | Se ve `1` en la fila inicial. |
| Columna posterior parcialmente visible | — | **pendiente** | Encabezado truncado («Unic…»). |

**Acciones finales:** `Aplicar`, `Cancelar`.

---

## 11. Formulario: Aplicar vacunación

- **Identificador propuesto:** `aplicar_vacunacion`
- **Título visible:** «Aplicando Vacunación».
- **Fuente:** `Formulario registro vacunacion.pdf`, páginas 1 y 2.

### 11.1. Datos principales (p. 1)

| Campo | Clave | Control / tipo | Observación |
|---|---|---|---|
| Mascota | `mascota` | `texto_corto` | Precargada. |
| Cliente | `cliente` | `texto_corto` | Precargado; en el ejemplo aparece también número de documento. |
| Fecha de registro | `fecha_registro` | `fecha_hora` | Precargada. |
| Médico veterinario | `medico_veterinario_id` | `lista` | Opciones pendientes. |
| Valor total del servicio | `valor_total_servicio` | `importe` | Se muestra `0`. |
| Descripción | `descripcion` | `texto_corto` | Una línea. |
| Peso en Kg | `peso_kg` | `numero_decimal` | Placeholder «Peso actual del animal». |
| Observaciones | `observaciones` | `texto_largo` | Área multilineal relacionada con vacunación. |

### 11.2. Bloque «Registro de vacunación sin inventario» (p. 1–2)

La frase aparece con un icono informativo, **sin interruptor verificable** a su lado. No convertirla automáticamente en un booleano.

**Tabla de vacunas `vacunas[]`:**

| Columna visible | Clave | Control / tipo | Observación |
|---|---|---|---|
| Vacuna | `vacuna_id` | `lista_inventario` | Opciones obtenidas de Inventario, etiqueta estándar `Vacuna` (apartado 13). |
| Cantidad | `cantidad` | `numero_decimal` | Fila inicial con `1`. |
| Columna posterior parcialmente visible | — | **pendiente** | Encabezado truncado («Unic…»). |

| Campo adicional | Clave | Control / tipo | Opciones / estado en la captura |
|---|---|---|---|
| Insumos | `incluir_insumos` | `opcion_unica` | `Sí` / `No`; `No` seleccionado. |

### 11.3. Acción para próxima vacuna (p. 2)

- **Texto del botón:** `+ Agregar próxima vacuna`.
- **Función observable:** existe una acción que agrega o configura una **próxima vacuna**.
- **Campos del formulario resultante:** **no aparecen** en las capturas, por lo que quedan pendientes de definición. No inventar fecha, marca, dosis o recordatorios desde esta evidencia.

**Acciones finales:** `Aplicar`, `Cancelar`.

---

## 12. Directrices de implementación para una IA

### 12.1. Orden de construcción

1. Crear **10 vistas o variantes de formulario** con los títulos, bloques, secciones y campos documentados.
2. Usar controles coherentes con cada tipo: texto, área extensa, número, fecha/hora, lista, radio, checkbox, adjunto y tabla de filas.
3. Precargar los datos existentes del paciente/propietario/contexto donde aparecen ya completados en la referencia. **Nunca usar** los nombres, números o fechas de las capturas como valores fijos.
4. Implementar los subcomponentes de medicamentos, insumos y selecciones con `+` donde el control de adición sea visible, sin asumir columnas o diálogos que no aparecen.
5. Mantener la secuencia original de secciones y campos de cada pantalla.
6. Agregar las acciones finales exactamente con las etiquetas observadas.
7. Enlazar los desplegables de **medicamentos, vacunas, desparasitantes, insumos y productos** con el **Inventario**, según su etiqueta estándar y respetando el contexto de empresa (apartado 13). Para las demás listas, usar catálogos reales **solo cuando estén definidos** en la aplicación o por el responsable del proyecto.
8. Verificar aparte las reglas de obligatoriedad, carga de archivos, eliminación de filas, cálculos de precio, estados y persistencia.

### 12.2. Estructura declarativa sugerida — no es el esquema SQL actual

Para que una IA renderice estos formularios de manera consistente, una **estructura de configuración posible** es:

```json
{
  "id": "registro_ejemplo",
  "titulo": "Título del formulario",
  "secciones": [
    {
      "id": "seccion_ejemplo",
      "titulo": "Nombre de sección visible o bloque funcional",
      "campos": [
        {
          "key": "campo_ejemplo",
          "label": "Etiqueta visible",
          "control": "texto_corto",
          "tipo_dato": "string",
          "precargado": false,
          "opciones": null,
          "required": null
        }
      ]
    }
  ],
  "acciones": ["Registrar", "Cancelar"]
}
```

**Interpretación:** `required: null` significa **no especificado por la fuente**; no significa obligatorio ni opcional. Este JSON es un **patrón ilustrativo de configuración**, no un contrato existente ni una lista de campos extras.

### 12.3. Reglas de precisión documental

- **Confirmado en los PDF:** etiqueta, orden, control y sección visibles en las capturas.
- **Definido posteriormente por el usuario:** los requisitos de Inventario del apartado 13, incluidos catálogos de artículos y sus usos por los formularios. No atribuir estas reglas a las capturas.
- **Tipo lógico inferido:** distinguir cuándo una entrada de una línea razonablemente almacena texto, importe o medida numérica; esto sirve para orientar la implementación, pero no revela validaciones del origen.
- **Pendiente:** valores de desplegables **que no estén definidos por Inventario**, opciones tras botones `+`, columnas desplazadas fuera del borde, obligatoriedad, límites, reglas de persistencia y automatizaciones de stock no descritas.
- **No permitido:** crear un catálogo médico, una regla de dosificación, un flujo de facturación, un consentimiento o un proceso de agenda y presentarlo como si viniera de los PDF.

### 12.4. Inventario de decisiones no resueltas por las capturas

| Tema | Qué falta determinar |
|---|---|
| Listas de selección | Contenido y origen de médicos, responsables, tipo de servicio, tipo de estética, área de consulta, fin zootécnico, estatus ASA, solución y goteo. **Medicamentos, desparasitantes, vacunas e insumos ya tienen origen definido en Inventario (apartado 13).** |
| Dosis | Unidades reales y contenido del selector adyacente al número; opciones de vía y frecuencia. |
| Tablas con desplazamiento | Columnas y acciones ocultas de medicamentos, exámenes e insumos. |
| Botones `+` | Si añaden filas dentro del mismo formulario, elementos del catálogo, o abren un diálogo; excepto donde es evidente la repetición de filas. |
| Próxima vacuna | Campos y comportamiento del bloque que aparece al pulsar `+ Agregar próxima vacuna`. |
| Salida de guardería | Qué ocurre con los campos de salida si se marca `No`. |
| Inventario | Ya se conocen las etiquetas estándar y el origen de los selectores. Continúan sin definirse el significado operacional de «sin inventario», el efecto de «Insumos Sí/No» sobre existencias y la columna «Unic…» parcialmente visible; véase apartado 13. |
| Guardado y reglas de negocio | Campos requeridos, cálculos de totales, descuentos, validación clínica, permiso de edición y transiciones posteriores. |
| Archivos | Límites y formatos permitidos salvo el máximo visible de 3 en anestesia/cirugía. |
| Persistencia PETS | Nombres de tablas, columnas, relaciones, políticas de acceso y migraciones SQL reales. |

---

## 13. Inventario — requisitos funcionales e integración con los formularios

> **Procedencia y prioridad:** este apartado incorpora **instrucciones funcionales expresas del usuario** posteriores a las capturas. No se afirma que estas pantallas o comportamientos estén presentes en los PDF. Para la implementación futura en PETS, estas instrucciones **completan** la especificación de los formularios y definen el origen de sus listas relacionadas con inventario. Los nombres de claves son **propuestos**, no equivalen necesariamente a tablas/columnas existentes en Supabase.

### 13.1. Alcance del módulo

El módulo **Inventario** debe permitir registrar y consultar artículos, organizar los productos por subcategorías, identificar cantidades **por sede**, mostrar imágenes representativas mediante URL y consultar información de **Movimiento**, **Compras** y **Ventas**. Los formularios de servicios veterinarios deben consultar **el mismo catálogo de Inventario**, en lugar de mantener catálogos manuales separados para los artículos utilizados.

**Diferenciación importante:** una **etiqueta estándar** clasifica qué es un artículo y determina en qué listas de los formularios aparece; una **subcategoría** ayuda a organizar los artículos de la etiqueta `Producto`. El campo **Tipo de uso** define un destino/uso comercial o interno y **no reemplaza** su etiqueta de inventario.

### 13.2. Etiquetas estándar y subcategorías

Las **cinco etiquetas estándar**, escritas exactamente como se indican, son:

| Etiqueta estándar | Aplicación | Fuente del selector en los formularios |
|---|---|---|
| `Producto` | Artículos generales organizables en subcategorías | Catálogo de productos; no aparece un selector genérico de Producto en los 10 PDF suministrados. |
| `Medicamento` | Artículos de medicación | Listas de medicamentos en anestesia, cirugía, hospitalización y medicación/inyectología. |
| `Vacuna` | Artículos de vacunación | Lista «Vacuna» del formulario de vacunación. |
| `Desparasitante` | Artículos de desparasitación | Lista «Desparasitante» del formulario de desparasitación. |
| `Insumo` | Materiales o suministros | Listas «Insumos» en los formularios que las contienen. |

**Reglas:**

- Estas cinco etiquetas son **estándar del sistema** y sirven para sincronizar Inventario con los artículos utilizados en los formularios. No convertir las subcategorías personalizadas en nuevas etiquetas estándar.
- Para la etiqueta `Producto`, el usuario puede **crear y administrar subcategorías propias**, por ejemplo: `Collares`, `Concentrado`, `Juguetes`. Esos nombres son ejemplos y no un listado cerrado.
- La subcategoría de `Producto` es una **lista seleccionable alimentada por las subcategorías creadas por el usuario**; debe poder ampliarse sin modificar código.
- En el resto de etiquetas, el usuario **no ha definido** una taxonomía de subcategorías ni una lista fija de subtipos. No inventarlas.
- No duplicar un mismo catálogo por cada formulario: al incorporar un artículo al Inventario con la etiqueta pertinente, debe estar disponible como **opción de la lista correspondiente**. La habilitación por estado/stock y el alcance exacto del filtrado por sede **no se han definido**.
- Respetar el contexto de **empresa** al consultar artículos y subcategorías. No mostrar artículos de otra empresa; las políticas y tablas concretas deberán adecuarse a la arquitectura real de PETS.

### 13.3. Registro / creación de un artículo de inventario

La interfaz de creación debe contener, al menos, los siguientes datos definidos por el usuario. Las claves son orientativas:

| Campo visible | Clave propuesta | Control | Tipo de dato / comportamiento |
|---|---|---|---|
| Categoría / etiqueta estándar | `etiqueta` | `lista` | Opción perteneciente a `Producto`, `Medicamento`, `Vacuna`, `Desparasitante`, `Insumo`. Si la aplicación separa categoría y etiqueta en su modelo actual, mantener la correspondencia sin crear dos catálogos incompatibles. |
| Subcategoría | `subcategoria_id` | `lista_busqueda` + opción para crear | Referencia a subcategoría creada por el usuario; aplica a `Producto`. |
| Nombre | `nombre` | `texto_corto` | Nombre con el que se identifica el artículo. |
| SKU | `sku` | `texto_corto` | Identificador de referencia alfanumérico; no convertirlo en número. |
| Descripción | `descripcion` | `texto_largo` | Descripción del artículo. |
| Cantidad por sede | `cantidades_por_sede[]` | `repetidor` o tabla por sede | Mostrar una fila por sede con `sede` (referencia/selector) y `cantidad` (`numero_decimal` o unidad definida). No tratarlo como una sola cantidad global. |
| Tipo de uso | `tipo_uso` | `lista` / `opcion_unica` | Lista cerrada con las **cuatro opciones exactas** de §13.4. |
| URL de imagen | `imagen_url` | `url_imagen` | URL suministrada opcionalmente al crear el artículo. Mostrar una vista previa cuando exista una URL válida y una imagen disponible. |

**No inferir todavía:** precio unitario, costo, impuestos, moneda, proveedores predeterminados, niveles mínimos, código de barras, fechas de vencimiento, lotes, unidades comerciales, reglas automáticas de ajuste o si SKU es obligatorio/único. Ninguno de esos requisitos fue especificado en esta ampliación.

### 13.4. Tipo de uso — opciones exactas

El campo **Tipo de uso** del artículo debe ofrecer estas opciones (mantener las etiquetas):

1. `Interno`
2. `Comercial`
3. `Interno/Comercial`
4. `Comercial/Sitio-web`

El tipo de uso es un atributo del artículo, **independiente** de su categoría y subcategoría. Un `Medicamento`, por ejemplo, conserva la etiqueta que permite seleccionarlo en los formularios; el campo Tipo de uso **no cambia ese origen de lista** por sí solo.

**Futura página de ventas:** el usuario quiere utilizar este atributo para filtrar qué artículos se publicarán en una tienda asociada. En su descripción escribió «**cargue solo lo interno**», pero también definió la opción `Comercial/Sitio-web`. **Son criterios potencialmente distintos**: no decidir automáticamente que la web muestra `Interno`, `Comercial`, `Interno/Comercial` o `Comercial/Sitio-web`. **Queda pendiente confirmar el filtro exacto** antes de implementar una página comercial. Esta especificación no exige construir la tienda todavía.

### 13.5. Ficha de artículo — ventana emergente desde Inventario

**Interacción requerida:** al pulsar un producto o artículo dentro de **Inventario**, abrir un **popup / modal de detalle** que permita visualizar la ficha del artículo seleccionado.

| Orden / agrupación | Dato mostrado | Representación |
|---|---|---|
| Identificación | Categoría / etiqueta estándar | Texto o etiqueta. |
| Clasificación | Subcategoría | Texto del catálogo creado por el usuario; cuando aplique. |
| Identificación | Nombre | Texto. |
| Identificación | SKU | Texto alfanumérico. |
| Descripción | Descripción | Texto multilínea. |
| Existencias | Cantidad por sede | **Tabla**: `Sede` y `Cantidad` por cada sede. |
| Uso | Tipo de uso | Una de las cuatro opciones de §13.4. |
| Imagen | Imagen representativa | Previsualización de la imagen obtenida desde `imagen_url`, cuando exista. |

La **URL de la imagen** se captura durante la creación y permanece vinculada al artículo para poder mostrarla nuevamente desde Inventario. Si no se proporciona URL, la ficha debe seguir siendo utilizable; **no inventar** imágenes sustitutas como datos del artículo.

**No está decidido** si el modal permite editar directamente cada dato o si la edición se abre por separado; tampoco si las tres vistas de movimientos, compras y ventas viven dentro de este modal o en pestañas de Inventario. Sí debe existir acceso claro a ellas desde el módulo.

### 13.6. Información de Inventario: Movimientos, Compras y Ventas

El módulo debe incluir **tres vistas o bloques de información diferenciados**. Son listados consultables; los nombres de columnas y sus tipos están definidos a continuación. La ubicación visual precisa (pestañas, bloques o sección vinculada al artículo) puede ajustarse al diseño de PETS, sin eliminar ninguna.

#### 13.6.1. Movimiento

| Campo | Clave propuesta | Control de consulta / tipo | Origen / regla |
|---|---|---|---|
| Fecha | `fecha` | Fecha o fecha-hora | Fecha del movimiento; la precisión en horas no se definió. |
| Tipo de movimiento | `tipo_movimiento` | Texto / valor de catálogo | Mostrar el tipo del movimiento. **No se proporcionó** un conjunto cerrado de opciones. |
| Responsable | `responsable_usuario_id` | Relación con usuario; mostrar su nombre | **Se captura automáticamente a partir del usuario de la sesión activa**. No pedir que el usuario escriba manualmente su identidad como responsable del movimiento. |

**Requisito central:** cada movimiento debe conservar la referencia al usuario autenticado responsable del evento registrado; al consultar el historial, mostrar el responsable asociado a ese movimiento, **no el usuario que esté viendo la pantalla posteriormente**.

#### 13.6.2. Compras

| Campo | Clave propuesta | Control de consulta / tipo | Origen / regla |
|---|---|---|---|
| Fecha | `fecha` | `fecha` / `fecha_hora` según registro | Fecha de compra. |
| Cantidad | `cantidad` | `numero_decimal` o cantidad en la unidad definida | Cantidad comprada. |
| Proveedor | `proveedor` / `proveedor_id` | `texto_corto` o selector de proveedor si existe catálogo | Identifica al proveedor de la compra. No se ha definido un catálogo obligatorio de proveedores. |
| Precio total | `precio_total` | `importe` | Precio total de esa compra; no inferir precio unitario, moneda ni impuestos. |

#### 13.6.3. Ventas

| Campo | Clave propuesta | Control de consulta / tipo | Origen / regla |
|---|---|---|---|
| Fecha | `fecha` | `fecha` / `fecha_hora` según registro | Fecha de venta. |
| Cantidad | `cantidad` | `numero_decimal` o cantidad en la unidad definida | Cantidad vendida. |
| Propietario | `propietario_id` | `lista_busqueda` / relación con propietario existente | **Debe relacionarse con el registro del propietario de la mascota** en PETS, no guardarse como un nombre suelto que rompa esa relación. |
| Precio total | `precio_total` | `importe` | Precio total de la venta; no asumir moneda ni cálculo específico. |

**Relación entre vistas:** es esperable que todas puedan consultar información de los artículos del inventario. El usuario no definió aún qué tipos de movimientos se registran, si una compra o venta crea automáticamente un movimiento, si modifica inmediatamente las cantidades por sede ni el manejo de devoluciones/traslados. **No programar una política de stock por suposición.**

### 13.7. Sincronización de los selectores de los formularios

En los formularios veterinarios, **la fuente de opciones es el catálogo de Inventario existente en PETS**, filtrado por la etiqueta estándar del campo. Una opción seleccionada debe mantener una **referencia al artículo** para evitar que un cambio de nombre desvincule un procedimiento histórico.

| Campo de formulario | Etiqueta requerida en Inventario | Formularios que lo usan |
|---|---|---|
| `medicamento_id` | `Medicamento` | Anestesia (premedicación, inducción y mantenimiento TIVA); cirugía (plan terapéutico); hospitalización (planeación/control); medicación/inyectología. |
| `vacuna_id` | `Vacuna` | Vacunación. |
| `desparasitante_id` | `Desparasitante` | Desparasitación. |
| `insumo_id` | `Insumo` | Cirugía, desparasitación, estética, examen de laboratorio, hospitalización, medicación/inyectología y vacunación, **donde exista el bloque de insumos**. |
| Selector de productos generales, si existe en otros módulos | `Producto` | No se aprecia en los 10 formularios PDF; no añadirlo allí por defecto. |

**Reglas de funcionamiento:**

1. **Catálogo compartido:** no crear listas de medicamentos, vacunas, desparasitantes o insumos paralelas y desligadas del inventario.
2. **Filtrado:** en un campo «Vacuna» mostrar los artículos correspondientes a `Vacuna`, no mezclarlos con productos, medicamentos o insumos; aplicar análogamente para las demás etiquetas.
3. **Sincronización:** al registrar un artículo en Inventario con una etiqueta estándar, ese artículo se incorpora a la fuente de opciones del tipo respectivo; los cambios posteriores se leen desde el mismo origen.
4. **Referencias persistentes:** guardar la vinculación al artículo elegido, junto con los campos clínicos propios del registro (cantidad, dosis, vía, frecuencia, etc.) cuando aparezcan en el formulario. **El tipo de uso** no sustituye esta relación.
5. **Contexto de sede:** mostrar las cantidades de cada sede sin sumar ni descontar automáticamente en una sede concreta hasta tener reglas definidas para el flujo de aplicación/consumo.
6. **Controles «sin inventario»:** las capturas de vacunación y desparasitación incluyen el texto «Registro ... sin inventario», pero **no se observa un interruptor operativo**. El nuevo requisito sí define el origen de sus **selectores**; no permite deducir cuándo descuentan existencias ni el significado de ese aviso. Dejar ese comportamiento pendiente.
7. **Insumos Sí/No:** es un control observado en ciertos formularios; su presencia no define por sí sola movimientos de existencias. Mantenerlo visible según cada formulario.

### 13.8. Modelo declarativo de referencia para una IA (no es SQL)

El siguiente ejemplo muestra **cómo representar campos**, no significa que estas sean las tablas existentes ni prescribe una implementación de backend:

```json
{
  "articulo_inventario": {
    "etiqueta": "Producto",
    "subcategoria_id": "referencia_a_subcategoria_creada_por_usuario",
    "nombre": "Ejemplo de artículo",
    "sku": "SKU-EJEMPLO-001",
    "descripcion": "Texto del artículo",
    "cantidades_por_sede": [
      { "sede_id": "referencia_sede", "cantidad": 0 }
    ],
    "tipo_uso": "Interno/Comercial",
    "imagen_url": "https://ejemplo.invalid/imagen.jpg"
  },
  "consulta_inventario": {
    "movimientos": ["fecha", "tipo_movimiento", "responsable_usuario_id"],
    "compras": ["fecha", "cantidad", "proveedor", "precio_total"],
    "ventas": ["fecha", "cantidad", "propietario_id", "precio_total"]
  },
  "selector_formulario": {
    "label": "Medicamento",
    "control": "lista_inventario",
    "filtro_etiqueta": "Medicamento",
    "valor": "articulo_inventario_id"
  }
}
```

### 13.9. Pendientes que **no** deben resolverse arbitrariamente

| Pregunta aún abierta | Motivo |
|---|---|
| ¿Qué tipos exactos existen en «Tipo de movimiento»? | Solo se especificó la columna, no la lista de valores. |
| ¿Cuándo se registra o descuenta stock por sede? | Se solicita ver cantidad por sede, pero no se definieron reglas de compra, venta, consumo, reposición o transferencias. |
| ¿Qué significa el aviso «sin inventario» en los formularios PDF? | No aparece una acción inequívoca en la captura. |
| ¿Debe bloquearse seleccionar un artículo agotado? | No se especificó el comportamiento según disponibilidad. |
| ¿Hay un catálogo de proveedores? | Se especificó mostrar proveedor, sin definir registro maestro. |
| ¿Qué campos adicionales tienen las compras y las ventas? | No se definió información adicional; no inventar. |
| ¿Qué artículos debe mostrar la futura página web? | La frase «solo lo interno» no aclara cómo aplicar las cuatro opciones de Tipo de uso. |
| ¿Puede un artículo tener varias etiquetas estándar simultáneamente? | Se conocen las cinco etiquetas, pero no se especificó su cardinalidad. |
| ¿Dónde se ubican exactamente las tres vistas de historial? | Se requiere su existencia, no un patrón visual específico. |
| ¿Cómo se controlan permisos de edición, historial y eliminación? | No fue definido en esta ampliación; utilizar el sistema real de permisos de PETS cuando exista. |

### 13.10. Criterios de aceptación para desarrollo

- [ ] Inventario ofrece las cinco etiquetas estándar: `Producto`, `Medicamento`, `Vacuna`, `Desparasitante`, `Insumo`.
- [ ] En `Producto`, el usuario puede crear y elegir sus propias subcategorías; no se crean etiquetas estándar nuevas a partir de ellas.
- [ ] Es posible registrar nombre, SKU, descripción, cantidades **por sede**, tipo de uso y una URL de imagen representativa.
- [ ] El campo Tipo de uso contiene **exactamente** `Interno`, `Comercial`, `Interno/Comercial`, `Comercial/Sitio-web`.
- [ ] Desde Inventario, al seleccionar un artículo se abre una ficha emergente con los campos pedidos, la distribución por sede y la imagen cuando exista.
- [ ] Inventario dispone de las vistas `Movimiento`, `Compras` y `Ventas`, con todas las columnas especificadas en §13.6.
- [ ] `Responsable` del movimiento se toma del **usuario autenticado al producirse el registro**, y permanece asociado históricamente.
- [ ] `Propietario` de Ventas se relaciona con la entidad de propietarios de mascotas en PETS.
- [ ] Los desplegables clínicos obtienen sus artículos de **Inventario**, según etiqueta, sin mantener catálogos duplicados.
- [ ] El registro clínico conserva su asociación con el artículo seleccionado y con la mascota que corresponda.
- [ ] Se mantienen como **pendientes**, sin suposiciones, el ajuste automático de cantidades, el significado de «sin inventario» y el filtro futuro para tienda web.

---

## 14. Índice y trazabilidad de documentos fuente

| Formulario documentado | Nombre exacto del PDF aportado | Páginas |
|---|---|---:|
| Anestesia | `Formulario registro de Anestesia.pdf` | 4 |
| Cirugía | `Formulario registro de Cirugia.pdf` | 4 |
| Desparasitación | `Formulario registro desparacitacion.pdf` | 2 |
| Estética | `Formulario registro Estetica.pdf` | 2 |
| Eutanasia | `Formulario registro eutanacia.pdf` | 2 |
| Examen de laboratorio | `Formulario registro Examen Laboratorio.pdf` | 2 |
| Guardería | `Formulario registro Guarderia.pdf` | 3 |
| Hospitalización | `Formulario registro Hospitalizacion.pdf` | 3 |
| Medicación / inyectología | `Formulario registro medicacion- inyectologia.pdf` | 2 |
| Vacunación | `Formulario registro vacunacion.pdf` | 2 |

**Total:** 10 formularios, **26 páginas** de referencia visual.

**Criterio de aceptación documental:** una IA debe poder identificar para cada formulario qué campos renderizar, en qué orden, con qué tipo de entrada, en qué bloque, cuáles constituyen filas de una tabla, cuáles vienen con datos contextuales y qué información **no puede deducir** de los PDF; además, debe implementar **las reglas explícitas de Inventario e integración del apartado 13**, sin inventar las decisiones pendientes.
