# STATE.md — AdInfinitum Frontend

<!-- GENERADO por scripts/cartograph.py. No editar a mano: regenerar. -->
Generado: 2026-10-17 04:59 · rama `f7-ux` @ `d61533d`

**9 rutas en App.tsx · 63 archivos de componente (f6 18, legacy 28, pages 3, components 10, layouts 1, context 2, i18n 1) · 13 hooks · 44 llamadas a endpoints en 3 servicios · 62 operaciones en openapi.json · 31 archivos de test · 100 archivos .ts/.tsx en src**

## Rutas (src/App.tsx)
| Path | Elemento |
|---|---|
| `/login` | `LoginPage` |
| `/executions/:id/print` | `PrintReportPage` |
| `/projects` | `ProjectsPage` |
| `/projects/:id` | `ProjectPage` |
| `/projects/:id/sections/:kind` | `SectionEditorPage` |
| `/executions/:id` | `ExecutionPage` |
| `/legacy-executions/:id` | `LegacyExecutionPage` |
| `/users` | `UsersPage (requireAdmin)` |
| `*` | `Navigate` |

## Componentes por árbol
### src/f6 (18)
| Archivo | Exporta | Líneas |
|---|---|---|
| `src/f6/ChainDailyCharts.tsx` | ChainDailyCharts | 34 |
| `src/f6/chartPanel.tsx` | Panel, Toggle, SmoothContext | 75 |
| `src/f6/Charts.tsx` | PRINT_SERIES_SPECIES, DailyCharts, ReportCharts | 543 |
| `src/f6/common.tsx` | RunStatusBadge, PartialRunBanner | 92 |
| `src/f6/CompareExecutions.tsx` | MAX_COMPARE, CompareExecutions | 274 |
| `src/f6/ConfigPanel.tsx` | IssueList, InventoryBadge, INVENTARIO_AQSOL, InventarioPanel, ConfigPanel | 375 |
| `src/f6/EChart.tsx` | ChartPrintContext, EChart | 54 |
| `src/f6/ExecutionPage.tsx` | ExecutionPage | 456 |
| `src/f6/InputParameters.tsx` | InputParameters | 184 |
| `src/f6/labels.tsx` | — | 63 |
| `src/f6/LaunchPanel.tsx` | LaunchPanel | 258 |
| `src/f6/paging.tsx` | PAGE_SIZE, Pager | 25 |
| `src/f6/PdfPreview.tsx` | PdfPreview | 52 |
| `src/f6/PrintReportPage.tsx` | PrintReportPage | 177 |
| `src/f6/ProCharts.tsx` | LiSankeyPanel, PondHeatmap | 102 |
| `src/f6/ProjectPage.tsx` | ProjectPage | 175 |
| `src/f6/ReportView.tsx` | PRINT_COLUMNS, PrintTablesContext, ReportTableView, KPI_FIRST, KpiCards, RecoveryBars, ReportView | 425 |
| `src/f6/SectionEditorPage.tsx` | InitialStatesEditor, SectionEditorPage | 892 |

### src/legacy (28)
| Archivo | Exporta | Líneas |
|---|---|---|
| `src/legacy/components/BrineEditor.tsx` | BRINE_PCT_TOLERANCE, BrineEditor | 177 |
| `src/legacy/components/common/ExecutionFilesTable.tsx` | ExecutionFilesTable | 66 |
| `src/legacy/components/common/PartialRunBanner.tsx` | PartialRunBanner | 40 |
| `src/legacy/components/common/Tip.tsx` | Tip | 19 |
| `src/legacy/components/DailyScheduleEditor.tsx` | DailyScheduleEditor | 384 |
| `src/legacy/components/DynamicChainView.tsx` | DynamicChainView | 258 |
| `src/legacy/components/DynamicReportDocument.tsx` | DynamicReportDocument | 324 |
| `src/legacy/components/DynamicReportModal.tsx` | DynamicReportModal | 214 |
| `src/legacy/components/DynamicResultsView.tsx` | KpiCards, Tabla1, Tabla2, Tabla3, TablaCompacta, ChartsEncalado, DynamicResultsView | 980 |
| `src/legacy/components/EncaladoConfigForm.tsx` | EncaladoConfigForm | 193 |
| `src/legacy/components/EncaladoResultPanel.tsx` | EncaladoResultPanel | 517 |
| `src/legacy/components/GlobalBalanceTable.tsx` | GlobalBalanceTable | 394 |
| `src/legacy/components/InventarioResultsView.tsx` | InventarioResultsView | 58 |
| `src/legacy/components/KPICards.tsx` | KPICards | 124 |
| `src/legacy/components/ParameterSnapshot.tsx` | ParameterSnapshot | 180 |
| `src/legacy/components/PondDetailBreakdown.tsx` | PondDetailBreakdown | 353 |
| `src/legacy/components/PondEditor.tsx` | PondEditor | 188 |
| `src/legacy/components/ResultCharts.tsx` | ResultCharts | 416 |
| `src/legacy/components/StaticDailyCharts.tsx` | StaticDailyCharts | 115 |
| `src/legacy/components/StaticReportDocument.tsx` | StaticReportDocument | 164 |
| `src/legacy/components/StaticReportModal.tsx` | StaticReportModal | 57 |
| `src/legacy/components/SulfateRemovalTable.tsx` | SulfateRemovalTable | 258 |
| `src/legacy/components/WellBrineFeedTable.tsx` | WellBrineFeedTable | 59 |
| `src/legacy/labels.tsx` | LegacyBanner | 36 |
| `src/legacy/LegacyExecutionPage.tsx` | LegacyExecutionPage | 181 |
| `src/legacy/LegacyExecutionsSection.tsx` | LegacyExecutionsSection | 131 |
| `src/legacy/pages/ExecutionResultsPage.tsx` | ExecutionResultsPage | 1306 |
| `src/legacy/utils/chartDateAxis.tsx` | XAxisModeProvider, ScrollableChart, DayDateToggle, DayStepSelect | 157 |

### src/pages (3)
| Archivo | Exporta | Líneas |
|---|---|---|
| `src/pages/LoginPage.tsx` | LoginPage | 150 |
| `src/pages/ProjectsPage.tsx` | ProjectsPage | 274 |
| `src/pages/UsersPage.tsx` | UsersPage | 341 |

### src/components (10)
| Archivo | Exporta | Líneas |
|---|---|---|
| `src/components/common/DecimalsSelect.tsx` | DecimalsSelect | 37 |
| `src/components/common/ErrorBoundary.tsx` | — | 50 |
| `src/components/common/ExecutionFilesTable.tsx` | ExecutionFilesTable | 66 |
| `src/components/common/LoadingSpinner.tsx` | LoadingSpinner | 35 |
| `src/components/common/Modal.tsx` | Modal | 78 |
| `src/components/common/ProtectedRoute.tsx` | ProtectedRoute | 32 |
| `src/components/common/Sidebar.tsx` | Sidebar | 126 |
| `src/components/common/StatusBadge.tsx` | StatusBadge | 54 |
| `src/components/common/Topbar.tsx` | Topbar | 71 |
| `src/components/common/WelcomeOverlay.tsx` | WelcomeOverlay | 149 |

### src/layouts (1)
| Archivo | Exporta | Líneas |
|---|---|---|
| `src/layouts/AppLayout.tsx` | AppLayout | 19 |

### src/context (2)
| Archivo | Exporta | Líneas |
|---|---|---|
| `src/context/AuthContext.tsx` | AuthProvider | 86 |
| `src/context/DecimalsContext.tsx` | DecimalsProvider | 38 |

### src/i18n (1)
| Archivo | Exporta | Líneas |
|---|---|---|
| `src/i18n/LanguageContext.tsx` | LanguageProvider | 73 |

## Hooks
- `useTrail` — `src/components/common/trail.ts`
- `usePageTrail` — `src/components/common/trail.ts`
- `useAuth` — `src/context/AuthContext.tsx`
- `useDecimals` — `src/context/DecimalsContext.tsx`
- `useTools` — `src/f6/chartPanel.tsx`
- `useSmooth` — `src/f6/chartPanel.tsx`
- `useChartPrint` — `src/f6/EChart.tsx`
- `useLabels` — `src/f6/labels.tsx`
- `useAuth (re-export)` — `src/hooks/useAuth.ts`
- `useLanguage` — `src/i18n/LanguageContext.tsx`
- `useT` — `src/i18n/LanguageContext.tsx`
- `useXAxisMode` — `src/legacy/utils/chartDateAxis.tsx`
- `useDayDateAxis` — `src/legacy/utils/chartDateAxis.tsx`

## Contrato y tipos
- `openapi.json`: 62 operaciones. `capabilities` presente: sí
- `src/types/api.d.ts` generado por openapi-typescript: sí (DENY: no editar)
- Tipos a mano: `src/types/index.ts`, `src/types/report.ts`

## Endpoints usados por servicio
### `src/services/api.ts` (12)
- GET `/auth/me`
- GET `/executions/${id}/files`
- GET `/executions/${id}/files/${encodeURIComponent(name)}`
- GET `/projects`
- GET `/users`
- GET `/users/${userId}/accesses`
- GET `/users/${userId}/projects`
- POST `/auth/login`
- POST `/auth/refresh`
- POST `/users`
- PUT `/users/${id}`
- PUT `/users/${userId}/projects`

### `src/services/apiV2.ts` (29)
- DELETE `/executions/${id}`
- DELETE `/projects/${id}`
- GET `/catalogs/aqsol`
- GET `/catalogs/aqsol/${version}`
- GET `/dictionary`
- GET `/executions/${id}`
- GET `/executions/${id}/chain`
- GET `/executions/${id}/chain/report`
- GET `/executions/${id}/log`
- GET `/executions/${id}/report`
- GET `/executions/${id}/series`
- GET `/executions/${id}/status`
- GET `/inventario/escenarios`
- GET `/projects/${id}`
- GET `/projects/${projectId}/executions`
- GET `/projects/${projectId}/report-params`
- GET `/projects/${projectId}/sections`
- GET `/projects/${projectId}/sections/${kind}`
- GET `/projects/${projectId}/sections/${kind}/versions`
- GET `/projects/${projectId}/sections/${kind}/versions/${versionNo}`
- POST `/executions/${id}/cancel`
- POST `/executions/${id}/reupload`
- POST `/projects`
- POST `/projects/${projectId}/excel/import`
- POST `/projects/${projectId}/executions`
- POST `/projects/${projectId}/inventario/load`
- POST `/projects/${projectId}/sections/${kind}/validate`
- PUT `/projects/${projectId}/report-params`
- PUT `/projects/${projectId}/sections/${kind}`

### `src/legacy/api.ts` (3)
- GET `/legacy-executions/${encodeURIComponent(id)}/files`
- GET `/legacy-executions/${encodeURIComponent(id)}/files/${encodeURIComponent(name)}`
- GET `/projects/${encodeURIComponent(projectId)}/legacy-executions`

## Tests (__tests__/)
- `components/`: 4
- `f6/`: 18
- `hooks/`: 1
- `legacy/`: 7
- `utils/`: 1

## Deuda medible (total · archivos)
| Patrón | Ocurrencias | Archivos |
|---|---|---|
| `isAdmin` | 24 | 7 |
| `style={{` | 364 | 54 |
| `hex sueltos (fuera de tokens.css)` | 170 | 33 |
| `error tragado .catch(() => setX([]|null))` | 5 | 3 |
| `window.confirm` | 1 | 1 |
| `gauge` | 0 | 0 |
| `: any / as any` | 0 | 0 |

## Archivos más grandes
- `src/types/api.d.ts` — 4527 líneas
- `src/legacy/pages/ExecutionResultsPage.tsx` — 1306 líneas
- `src/i18n/translations.ts` — 1046 líneas
- `src/legacy/components/DynamicResultsView.tsx` — 980 líneas
- `src/legacy/utils/exportExecutionExcel.ts` — 926 líneas
- `src/f6/SectionEditorPage.tsx` — 892 líneas
- `src/types/index.ts` — 822 líneas
- `src/legacy/types.ts` — 814 líneas
