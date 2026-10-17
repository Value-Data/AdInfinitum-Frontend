# PRODUCT.md — AdInfinitum (contrato de diseño)

Lo leen `vd-ux` y `vd-frontend` antes de opinar o editar. Si una skill de diseño contradice este
archivo, manda este archivo.

## Qué es y para quién
AdInfinitum modela pozas de evaporación de salmuera de litio para plantas de clientes mineros:
balances de masa por poza, precipitación de sales, encalado, cadena estático/dinámico, inventario y un
reporte (pantalla, PDF, Excel) que el cliente ya conoce de la versión anterior.

| Usuario | Qué hace | Qué necesita de la UI |
|---|---|---|
| Ingeniero de proceso de Value Data (admin / operador / editor / lector) | Configura secciones, importa Excel, carga inventario, lanza y compara ejecuciones, revisa log y archivos | Densidad de información, tablas precisas, unidades claras, acciones rápidas, nada que esconda datos |
| Cliente externo (rol `cliente`, F7) | Ve las ejecuciones exitosas de su proyecto, su reporte, la cadena y los gráficos; descarga PDF/Excel | Llegar directo a "Resultados", PDF destacado, cero ruido de configuración, lenguaje claro |

## Superficies
- **Marca** (pre-login, `src/pages/LoginPage.tsx`): sobria y profesional; logo `src/media/logo-header.png`.
  No es landing de venta.
- **Producto** (post-login): herramienta técnica de escritorio. Se lee a 50 cm, con mucha tabla y
  gráfico. Prima la legibilidad de números sobre la decoración.

## Personalidad
Técnica, precisa, sobria, confiable — "informe de ingeniería", no "dashboard de startup". Los números
mandan: tipografía mono/tabular para cifras, unidades siempre visibles, alineación a la derecha en
columnas numéricas.

## Tokens (fuente de verdad: `src/styles/tokens.css`, mapeados en `tailwind.config.js`)
| Token | Valor | Uso |
|---|---|---|
| `--color-primary` | `#1a539a` | Azul AdInfinitum: acciones primarias, encabezados |
| `--color-primary-light` | `#3581b9` | Hover / activo |
| `--color-primary-lighter` | `#e8f1fb` | Fondos suaves |
| `--color-accent` | `#5eb8d1` | Teal del logo: acentos puntuales |
| `--color-accent-light` | `#e6f5f9` | Tinte teal |
| `--color-danger` / `--color-success` / `--color-warning` | `#dc2626` / `#16a34a` / `#d97706` | Estados (siempre con icono o texto además del color) |
| `--color-warning-bg` | `#fef6e7` | Fondo de avisos |
| `--color-bg` / `--color-surface` | `#f3f4f6` / `#ffffff` | Fondo app / tarjetas |
| `--color-text` / `--color-text-secondary` / `--color-border` | `#1f2937` / `#6b7280` / `#d1d5db` | Texto y bordes |
| `--chart-series-1..8` | `#2a78d6 #eb6834 #1baf7a #eda100 #e87ba4 #008300 #6250d6 #e34948` | Series de gráficos, orden fijo |
| `--chart-grid` | `#e1e0d9` | Grilla de gráficos |
| `--font-display` / `--font-body` | IBM Plex Sans | Todo el texto |
| `--font-mono` | IBM Plex Mono | Cifras, códigos, IDs |
| `--radius` | 6px | Radio único |
| `--shadow` / `--shadow-lg` | sombras suaves | Tarjetas |

Reglas:
- Nunca hex/fuentes/espaciados sueltos en código nuevo: siempre tokens o clases Tailwind mapeadas.
  Si falta un token, se agrega primero a `tokens.css` (y a `tailwind.config.js` si aplica).
- Las series de gráficos están **espejadas** en `src/f6/chartData.ts` (`SERIES_COLORS`) porque el
  PNG/PDF exportado no resuelve variables CSS. Se cambian los dos juntos o ninguno.

## Anti-referencias (lo que NO puede pasar)
- **Gauges / medidores / velocímetros.** En ninguna pantalla ni en el PDF. Recuperaciones = barras.
- **Borrar o rediseñar lo de antes**: las pantallas, gráficos y bloques del PDF de `src/legacy/**` (y
  los gráficos "como el reporte de antes" en `src/f6/`) los conoce el cliente. Solo reciben arreglos
  de estados, migas y accesibilidad. Nada se quita.
- **Dashboard genérico**: gradientes, glassmorphism, tarjetas KPI gigantes con iconos decorativos,
  fondos oscuros "tech", ilustraciones, emojis.
- Esconder un error como lista vacía. Un fallo de carga se ve como fallo, con "Reintentar".
- Mostrar UUIDs donde el usuario espera un nombre (migas, títulos).
- Ocultar en la UI como sustituto de permisos del backend.
- Librerías de UI pesadas nuevas (MUI, Ant) o cambio de librería de gráficos.

## Principios
1. Datos primero: tablas y gráficos legibles, unidades, decimales configurables (`DecimalsContext`).
2. Cada carga tiene sus tres estados: cargando (skeleton), error (con reintento) y vacío (con acción).
3. Lo que el usuario no puede hacer se explica (deshabilitado + tooltip con el rol requerido) salvo
   acciones destructivas/admin, que se ocultan.
4. Continuidad: lo nuevo convive con lo de antes; mismo lenguaje visual, misma terminología.
5. Reutilizar componentes de `src/components/common/` y `src/f6/common.tsx` antes de crear variantes.

## Idioma
Español por defecto (Chile), inglés disponible. Todo texto visible pasa por `src/i18n/`
(`translations.ts`, `translationsF6.ts`); nada de strings sueltos. Tildes correctas.

## Dispositivos
**Escritorio + tablet. No es mobile-first.** Objetivo: 1280–1920 px de escritorio y tablet ≥768 px
(horizontal y vertical) con sidebar colapsable. El teléfono no es objetivo (no romper, pero no se
optimiza). Ignora la regla mobile-first por defecto de `vd-ux`.

## Accesibilidad
WCAG 2.1 **AA**: contraste ≥4.5:1 en texto (ojo: `--color-accent` sobre blanco NO alcanza para texto),
foco visible, labels en formularios, objetivos ≥24 px (≥44 px en controles táctiles de tablet),
`prefers-reduced-motion` respetado, estados nunca solo por color.

## Decisiones de diseño registradas
| Fecha | Decisión |
|---|---|
| 2026-10-15 | No se borra nada de antes; sin gauges (recuperación = barras). |
| 2026-10-16 | F7: rol `cliente` ve solo resultados/PDF; UI por `capabilities` (D3/D4 del plan F7). |
