# Auditoría UX — F7 (2026-10-16)

Fuentes:
- la auditoría de código de `vd-ux`, con 6 P0, 31 P1 y 37 P2;
- capturas reales con Playwright.

Las capturas se tomaron sobre un stack 100 % local:
- frontend `f7-ux` en :5176 → API local :8000 → SQLite;
- datos: el caso de referencia (dinámico y estático) y el caso con inventario;
- tamaños: 1440×900, 1024×768 y 768×1024.

Las capturas quedan fuera del repo porque pesan y llevan datos del cliente. Los mockups de Codex se reseñan al final.

Regla vigente del usuario: no se borra nada. Todos los bloques y gráficos del reporte y PDF de antes se mantienen. Sin gauges.

## 1. Lo que se ve en las capturas (confirmado en pantalla)

| # | Pantalla | Hallazgo | Severidad |
|---|---|---|---|
| C1 | Proyectos (foco) | Con 6 Tab el foco cae en "Nuevo Proyecto": las filas no se alcanzan con teclado. El anillo de foco es un borde oscuro sobre un botón oscuro, casi invisible. | P0 (=A1, A2) |
| C2 | Toda la app | **≥37 textos en español sin tilde**, entre ellos `Contrasena`, `Descripcion`, `Ultima ejecucion`, `Cerrar sesion`, `Simulacion`, `Dias disponibles/ano` y `Evaporacion (mm/dia)`. Con mayúsculas se lee "CONTRASENA". Están en `src/i18n/translations.ts`. | P1 |
| C3 | Proyectos | "Última ejecución" muestra `cancelled` en inglés, porque usa el StatusBadge antiguo. En la pestaña Ejecuciones el mismo estado sale bien, como "Cancelada". | P1 |
| C4 | Proyectos | Cada fila tiene un botón "Eliminar" visible: es la acción destructiva con más peso de la tabla. | P1 |
| C5 | Proyecto, editor, ejecución | La miga de pan muestra el UUID (`8ff179a6…`, `9948d83c…`) y la clave interna (`sections / precon_dynamic`) en lugar del nombre. | P1 |
| C6 | Ejecución | En la sidebar no se marca ningún ítem activo dentro de `/executions/...`. | P2 |
| C7 | Editor y reporte | Unidad duplicada en las cabeceras, como `ÁREA DE PROCESO (M²) (M2)`, `IMPREGNACIÓN (%) (%)` y `FUGAS (MM/D) (MM/…`. La etiqueta del diccionario ya trae la unidad y el componente la vuelve a añadir (`SectionEditorPage.tsx:113`, `ReportView.tsx:30`, `InputParameters.tsx:35`). | P1 |
| C8 | Editor y reporte | El `uppercase` de `th`/`.label` deforma las unidades, por ejemplo `(T/D)` junto a `(t/d)` en la misma tabla y `KG/M3`. | P1 (=hallazgo de unidades) |
| C9 | Editor precon dinámico | La página mide unos 7.800 px y los 137 factores de precipitación se muestran todos abiertos. Ya existe el filtro "Todos (137)". La serie diaria de 1461 días aparece entera, sin paginar ni virtualizar. | P1 |
| C10 | Editor | "Tipo de poza" se corta (`Por altura`, `Buffer ca…`) y la tabla de pozas tiene scroll horizontal oculto. | P2 |
| C11 | Ejecución estática | La página mide unos **16.300 px**. Unos 24 gráficos van antes que las tarjetas KPI y las tablas, que son lo primero que busca el cliente, y no hay índice de secciones. | P1 |
| C12 | Ejecución, gráficos | El selector "Barras / Líneas" está arriba de todo, pero los gráficos "Li+ vs X" (los de antes) siempre son líneas. Con "Barras" activo el usuario ve líneas y parece roto: el selector solo afecta a los gráficos del final. | P1 |
| C13 | Ejecución, gráficos | En el eje derecho de "Li+ vs Mg++" (Concentración) todas las marcas dicen `0,0000`. El formato de decimales no se adapta a valores muy chicos. | P1 |
| C14 | Ejecución, gráficos | Las líneas usan `smooth: true` (`chartOptions.ts:225,455`) sobre categorías discretas (pozas). El suavizado inventa curvatura entre pozas e incluso puede sugerir valores que no existen. Para una serie por poza lo honesto es una línea recta. | P1 |
| C15 | Ejecución | El placeholder de "Factor de escala" aparece cortado (`el del pr…`). | P2 |
| C16 | Ejecución | Ceros con formato distinto en la misma tabla (`0,00` y `0,0000`). | P2 |
| C17 | Ejecución | Mezcla de unidades `%w/w` (inglés) y `%p/p` (en el resto de la app). | P2 |
| C18 | Bienvenida | Gradiente, radio de 16 px y blur: todo eso es anti-referencia en PRODUCT.md. Decide el usuario. | decisión |
| C19 | Tablet vertical (768) | La sidebar fija de 224 px deja unos 520 px útiles: la tabla de ejecuciones se corta (columna Duración) y la fecha ocupa 3 líneas. | P1 (=sidebar sin breakpoints) |
| C20 | Tablet horizontal (1024) | En la ejecución, los botones de descarga bajan a una segunda fila y "Imprimir / PDF" queda suelto. | P2 |
| C21 | Ejecución | Hay 4 caminos al PDF: "PDF (servidor)", "Imprimir / PDF", `/print` y el PDF de cadena. El cliente no sabe cuál es el oficial. | P1 (=hallazgo de PDF) |
| C22 | Consola | No hay errores JS, solo los avisos de *future flags* de React Router v7. | info |

## 2. Hallazgos de la auditoría de código (resumen)

**P0**
- A1: las filas de proyecto son `<tr onClick>` sin Link.
- A2: el anillo de foco de los inputs (rgba .15) no se ve.
- E1: ProjectsPage oculta los errores y muestra "No tiene proyectos asignados".
- E2: UsersPage, si falla `getUserProjects`, guarda `[]` y **borra los accesos** del usuario.
- E3: ProjectPage hace `.catch(()=>set([]))`.

**Contraste (WCAG AA)**

| Color | Uso | Contraste | Propuesta |
|---|---|---|---|
| text-secondary #6b7280 | sobre bg | 4,39 | `#4b5563` |
| text-secondary #6b7280 | sobre hover | 3,96 | `#4b5563` |
| primary-light #3581b9 | como texto o fondo de hover | 4,21 | nuevo `--color-primary-dark` `#164a8a` |
| success #16a34a | como texto | 3,30 | `--color-success-text` `#166534` |
| border #d1d5db | borde de input | 1,47 | `--color-border-strong` `#8b8f96` |
| series de gráfico 3/4/5 | líneas | < 3:1 | no se cambia el color (son los de antes): se agrega `endLabel` y se engrosan las líneas |

**Otros**
- StatusBadge antiguo con estados en inglés.
- Tablas cortadas en tablet.
- "Volver" lleva a la pestaña equivocada.
- Sin `prefers-reduced-motion`.
- Modal sin ARIA de diálogo ni focus trap.
- Sidebar fija sin breakpoints.

## 3. Propuesta de color e interfaz

Se mantiene la identidad: azul de marca `#1a5296` e IBM Plex Sans. Cambios:

1. **Tokens nuevos**:
   - `--color-text-secondary: #4b5563`
   - `--color-primary-dark: #164a8a` (hover y texto de enlace)
   - `--color-success-text: #166534` sobre `#dcfce7`
   - `--color-warning-text: #92400e` sobre `#fef3c7`
   - `--color-danger-text: #991b1b` sobre `#fee2e2`
   - `--color-border-strong: #8b8f96` (inputs)
   - `--focus-ring: 0 0 0 3px #1a5296` con offset blanco
2. **Sidebar clara** (opcional, la decide el usuario): fondo blanco con borde derecho. El ítem activo lleva una barra azul de 3 px y fondo `#e8eef7`. Hoy el azul sólido de 224 px compite con los datos y el logo va dentro de una caja blanca, como un parche. Con la sidebar clara el logo queda integrado. En ≤1024 px la sidebar se colapsa a 64 px, solo con íconos.
3. **Gráficos**:
   - líneas rectas (`smooth: false`) en las series por poza;
   - el selector Barras/Líneas pasa junto a los gráficos que controla;
   - el formato del eje usa notación con dígitos significativos para valores menores que 0,01;
   - se agregan `endLabel` en las series 3/4/5.

   No cambia ningún color de serie ni se quita ningún gráfico de antes.
4. **Ejecución**:
   - arriba: el encabezado con "Descargar PDF" como acción primaria, más "Excel" e "Imprimir", y "Eliminar" dentro de un menú "⋯";
   - después, las tarjetas KPI;
   - después, un índice de secciones pegajoso (Resumen · Preconcentración · Planta · Concentración · Tablas · Gráficos);
   - debajo, todos los bloques actuales, sin quitar ninguno: solo se reordenan para que tablas y KPI vayan antes que los 24 gráficos.

   Antes de reordenar hay que confirmar con el usuario el orden exacto que conoce el cliente.
5. **Proyectos**:
   - la fila completa es un enlace con chevron;
   - "Eliminar" va dentro de "⋯";
   - el estado aparece en español;
   - se agrega la columna "Mi rol" cuando exista la Fase 2.
6. **Rol cliente** (depende de backend Fase 2):
   - sin pestaña Configuración;
   - un bloque "Resultados" con la última ejecución completada y "Descargar PDF" como primaria;
   - abajo, la lista de completadas con su PDF;
   - con un solo proyecto, entra directo a él.
7. **Textos**: tildes en los ≥37 strings, sin `uppercase` en las cabeceras con unidad y sin unidad duplicada.

## 4. Lotes de pulido propuestos (orden)

| Lote | Contenido | Depende de |
|---|---|---|
| 1 | P0 E1–E3 (errores tragados; E2 borra accesos) | — |
| 2 | P0 A1–A2: filas como Link y anillo de foco | — |
| 3 | Textos: tildes (C2), unidad duplicada (C7), uppercase de unidades (C8), estados en español (C3), migas de pan con el nombre (C5) | — |
| 4 | Gráficos: C12, C13, C14 y endLabel | — |
| 5 | Tokens de contraste y foco | **OK del usuario** (y quedar registrado en PRODUCT.md) |
| 6 | Página de ejecución: encabezado de acciones, KPI e índice (C11, C21) | OK del orden de los bloques |
| 7 | Responsive tablet: sidebar colapsable y tablas con scroll visible (C19, C20, C10) | — |
| 8 | Editor: secciones colapsables y serie diaria paginada (C9) | — |
| 9 | Vista cliente y matriz de roles en Usuarios | backend Fase 2 |

## 5. Decisiones abiertas para el usuario
1. ¿Sidebar clara o se mantiene la azul?
2. WelcomeOverlay: ¿se conserva tal cual, se simplifica o se quita?
3. ¿Cuál es el PDF canónico para el cliente: el del servidor o el de imprimir?
4. ¿Se pueden reordenar los bloques de la página de ejecución (KPI y tablas antes que los gráficos), manteniéndolos todos?
5. ¿Formato de fecha es-CL fijo, o según el idioma?
6. ¿El cliente puede cambiar el factor de escala?

## 6. Mockups (Codex)
Están en el scratchpad de la sesión (`mockups/mock_*.png`). Son una referencia visual de la paleta y el layout propuestos, no un diseño cerrado.
