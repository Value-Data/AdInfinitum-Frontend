# CHANGE.md — change request vigente

## CR-1: F7 Fase 3/4: permisos por capacidad en la UI + pulido UX
- **Alcance**: frontend (rama `f7-ux`, desde `f6-integracion` @6122e45)
- **Plan fuente**: `../AdInfinitum-Backend/docs/superpowers/plans/2026-10-16-ux-roles-modulos.md`
- **Estado**:
  - Parte A (capacidades, Fase 3): **BLOQUEADO por backend Fase 2** — `capabilities` y
    `project_accesses.role` no existen aún en el contrato (`grep -c capabilit openapi.json` = 0 al
    2026-10-16). No se mockea: se espera el `openapi.json` regenerado por vd-backend.
  - Parte B (pulido UX, Fase 4): desbloqueado. Empieza por auditoría `vd-ux` (no edita) y revisión
    con el usuario antes de tocar código.
- **Problema**:
  - Hoy solo existe `isAdmin` (`src/context/AuthContext.tsx`), binario admin/usuario; no hay roles por
    proyecto ni vista para clientes externos.
  - Deuda UX: errores de carga tragados como lista vacía (`.catch(() => set([]))`), tarjeta de error
    sin reintento, sin toasts ni skeletons, migas con UUID, sidebar fijo 224px sin layout tablet,
    huecos de i18n ("Cerrar sesion" sin tilde), ~351 `style={{}}` inline y hex fuera de tokens,
    `SectionEditorPage.tsx` de ~879 líneas.
- **Criterios de aceptación**: (verificables — vd-qa los convierte en tests)
  - A1. Existe `useCan(projectId)` que lee `capabilities` del contrato generado; `ProjectsPage`,
    `ProjectPage` (LaunchPanel), `ExecutionPage` (cancelar/borrar/re-subir) y
    `LegacyExecutionsSection` dejan de usar `isAdmin` para decidir acciones. *(bloqueado)*
  - A2. D4: acciones destructivas/admin sin permiso se ocultan; acciones de flujo (Lanzar) se muestran
    deshabilitadas con tooltip "requiere rol operador". *(bloqueado)*
  - A3. `UsersPage`: tabla usuario × proyecto con selector de rol (`cliente|lector|editor|operador`);
    textos en `translationsF6.ts`. *(bloqueado)*
  - A4. Insignia con el rol del usuario en el encabezado del proyecto. *(bloqueado)*
  - A5. Vista `cliente`: el proyecto abre en "Resultados" sin pestañas de configuración ni sección de
    antes; en la ejecución no se ven log, archivos ni comparación; el PDF va destacado. *(bloqueado)*
  - B1. Ningún `.catch(() => set([]))` silencioso: los errores de carga muestran una tarjeta de error
    común con botón "Reintentar".
  - B2. Skeletons en tablas y gráficos; estados vacíos con acción ("Crear proyecto", "Configurar sección").
  - B3. Toasts para guardar/lanzar/cancelar/importar; sin `window.confirm` (usa `Modal`), y `Modal`
    con trampa de foco.
  - B4. Migas con nombre de proyecto y de ejecución, no UUID.
  - B5. Sidebar colapsable en tablet (≥768 px); usable a 1024 px sin scroll horizontal.
  - B6. i18n sin huecos en Sidebar/ErrorBoundary; "Cerrar sesión" con tilde.
  - B7. Hex sueltos reemplazados por variables de `tokens.css` en los archivos tocados (sin refactor
    masivo de `style={{}}`).
  - B8. `SectionEditorPage.tsx` partido en celdas/tablas/series/versiones sin cambio de comportamiento
    (tests existentes en verde).
  - B9. AA: contraste, foco visible y labels en formularios revisados.
  - Gate: `scripts/gate-frontend.sh` en verde.
- **Fuera de alcance**:
  - Borrar o rediseñar pantallas, gráficos o bloques del PDF de antes (`src/legacy/**`); agregar gauges.
  - Cambiar lo que hoy puede hacer un usuario existente sin decisión del usuario (backfill a `editor`).
  - Rediseño visual completo o cambio de librería de UI.
  - Deduplicación interna de legacy (`types`, `pdfReport`, `StatusBadge`).
  - Merge a `main` / deploy a prod (OK aparte).

## Rupturas de contrato
Ninguna prevista. La Fase 2 del backend agrega `capabilities` (aditivo) en `GET /auth/me` y
`GET /projects/{id}`, y `PUT /users/{id}/projects` acepta `[{project_id, role}]` manteniendo la forma
antigua. Re-evaluar cuando llegue el `openapi.json` nuevo.

## Bitácora
| Agente | Estado | Nota |
|---|---|---|
| vd-init | OK | 2026-10-16: CLAUDE.md, CHANGE.md, PRODUCT.md, STATE.md, gates y agentes de proyecto creados |
| orquestador (UX F7) | OK | 2026-10-17: ejecución en pestañas y sub-pestañas (Resultados por etapa, Gráficos por grupo), tablas impresas en bloques de columnas, curva/recta, vista previa del PDF, listas paginadas, series diarias de la cadena y H2O impreso, roles por proyecto en Usuarios, errores visibles, tildes, unidades sin repetir, miga con nombres, foco visible, cliente sin logs/config. Commits e6b0022..HEAD. vitest 194/194, gate OK (WARN: sin eslint). Sin push. |
| orquestador (pulido F10) | OK | 2026-10-26, rama `f10-pulido` desde `main` @d07cf8b (pasada de pulido con /impeccable sobre `src/f6` y `src/pages`). Editor: la página ya no se desborda a lo ancho (los textos `sr-only` de las cabeceras estiraban el documento a 3592 px; ahora las tablas con scroll son `relative`); las cabeceras de las tablas de datos quedan como se escriben (m², pH, Li+). Reporte: los KPIs llevan su unidad (copia de `KPI_UNITS` del backend); el resumen de una corrida de una etapa muestra sus KPIs; "Series diarias" muestra que está cargando; la barra de exportación ya no deja un botón solo; las unidades no se repiten ("Composición (%p/p) (%w/w)"). Lanzar: ofrece primero un tipo que el proyecto puede correr, marca los que no tienen secciones y deja de pedir una precon estática que no existe (404). Listas: botones en mayúscula inicial, "1 proyecto / n proyectos", clientes con su nombre como se escribe, fechas en una línea, "Activo" en verde con contraste AA. Tablet (B5): bajo 1024 px el menú queda en una franja de íconos de 64 px con botón para desplegarlo sobre la página (Escape o elegir un destino lo cierran), objetivos de toque de 44 px. Selectores de las tablas del editor con su opción entera. Colores de estado y sueltos pasados a tokens (`--status-*`). Si fallan las secciones, el error también se ve en Ejecuciones. Pendiente backend: mandar la unidad de cada KPI en el reporte JSON y borrar la copia del front. |
