# STATE.md — AdInfinitum Frontend

<!-- GENERADO por scripts/cartograph.py. No editar a mano: regenerar. -->
Generado: 2026-10-26 03:53 · rama `f9-cambios-finales` @ `d774f60`

**10 rutas en App.tsx · 66 archivos de componente (f6 20, legacy 27, pages 4, components 11, layouts 1, context 2, i18n 1) · 13 hooks · 43 llamadas a endpoints en 3 servicios · 58 operaciones en openapi.json · 43 archivos de test · 103 archivos .ts/.tsx en src**

## Rutas (src/App.tsx)
| Path | Elemento |
|---|---|
| `/login` | `LoginPage` |
| `/executions/:id/print` | `PrintReportPage` |
| `/inicio` | `HomePage` |
| `/projects` | `ProjectsPage` |
| `/projects/:id` | `ProjectPage` |
| `/projects/:id/sections/:kind` | `SectionEditorPage` |
| `/executions/:id` | `ExecutionPage` |
| `/legacy-executions/:id` | `LegacyExecutionPage` |
| `/users` | `UsersPage (requireAdmin)` |
| `*` | `Navigate` |

## Componentes por árbol
### src/f6 (20)
| Archivo | Exporta | Líneas |
|---|---|---|
| `src/f6/ChainDailyCharts.tsx` | ChainDailyCharts | 34 |
| `src/f6/chartPanel.tsx` | Panel, Toggle, SmoothContext | 71 |
| `src/f6/Charts.tsx` | PRINT_SERIES_SPECIES, DailyCharts, ReportCharts | 554 |
| `src/f6/common.tsx` | RunStatusBadge, StaleHeartbeatBadge, StaleHeartbeatBanner, PartialRunBanner | 205 |
| `src/f6/CompareExecutions.tsx` | MAX_COMPARE, CompareExecutions | 274 |
| `src/f6/ConfigPanel.tsx` | IssueList, InventoryBadge, ExcelPanel, ConfigPanel | 264 |
| `src/f6/EChart.tsx` | ChartPrintContext, EChart | 54 |
| `src/f6/ExecutionPage.tsx` | ExecutionPage | 460 |
| `src/f6/InputParameters.tsx` | InputParameters | 187 |
| `src/f6/labels.tsx` | — | 63 |
| `src/f6/LaunchPanel.tsx` | LaunchPanel | 279 |
| `src/f6/paging.tsx` | PAGE_SIZE, Pager | 25 |
| `src/f6/PdfPreview.tsx` | PdfPreview | 52 |
| `src/f6/PrintReportPage.tsx` | PrintReportPage | 177 |
| `src/f6/ProCharts.tsx` | LiSankeyPanel, PondHeatmap | 102 |
| `src/f6/ProjectEditModal.tsx` | ProjectEditModal, ClientInput | 97 |
| `src/f6/ProjectPage.tsx` | ProjectPage | 204 |
| `src/f6/ReportView.tsx` | TOTAL_ROW_IDS, PRINT_COLUMNS, PrintTablesContext, ReportTableView, KPI_FIRST, KpiCards, RecoveryBars, ReportView | 456 |
| `src/f6/ReportWarnings.tsx` | ReportWarnings | 42 |
| `src/f6/SectionEditorPage.tsx` | TableEditor, KeyValueEditor, InitialStatesEditor, ReagentsEditor, SectionEditorPage | 1417 |

### src/legacy (27)
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
| `src/legacy/components/DynamicResultsView.tsx` | KpiCards, Tabla1, Tabla2, Tabla3, TablaCompacta, ChartsEncalado, DynamicResultsView | 1000 |
| `src/legacy/components/EncaladoConfigForm.tsx` | EncaladoConfigForm | 193 |
| `src/legacy/components/EncaladoResultPanel.tsx` | EncaladoResultPanel | 517 |
| `src/legacy/components/GlobalBalanceTable.tsx` | GlobalBalanceTable | 394 |
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
| `src/legacy/LegacyExecutionPage.tsx` | LegacyExecutionPage | 173 |
| `src/legacy/LegacyExecutionsSection.tsx` | LegacyExecutionsSection | 131 |
| `src/legacy/pages/ExecutionResultsPage.tsx` | ExecutionResultsPage | 1306 |
| `src/legacy/utils/chartDateAxis.tsx` | XAxisModeProvider, ScrollableChart, DayDateToggle, DayStepSelect | 157 |

### src/pages (4)
| Archivo | Exporta | Líneas |
|---|---|---|
| `src/pages/HomePage.tsx` | HomePage | 258 |
| `src/pages/LoginPage.tsx` | LoginPage | 200 |
| `src/pages/ProjectsPage.tsx` | ProjectsPage | 358 |
| `src/pages/UsersPage.tsx` | UsersPage | 341 |

### src/components (11)
| Archivo | Exporta | Líneas |
|---|---|---|
| `src/components/common/Collapsible.tsx` | Collapsible | 84 |
| `src/components/common/DecimalsSelect.tsx` | DecimalsSelect | 37 |
| `src/components/common/ErrorBoundary.tsx` | — | 50 |
| `src/components/common/ExecutionFilesTable.tsx` | ExecutionFilesTable | 66 |
| `src/components/common/LoadingSpinner.tsx` | LoadingSpinner | 35 |
| `src/components/common/Modal.tsx` | Modal | 78 |
| `src/components/common/ProtectedRoute.tsx` | ProtectedRoute | 32 |
| `src/components/common/Sidebar.tsx` | Sidebar | 133 |
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
- `openapi.json`: 58 operaciones. `capabilities` presente: sí
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

### `src/services/apiV2.ts` (28)
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
- POST `/projects/${projectId}/sections/${kind}/validate`
- PUT `/projects/${id}`
- PUT `/projects/${projectId}/report-params`
- PUT `/projects/${projectId}/sections/${kind}`

### `src/legacy/api.ts` (3)
- GET `/legacy-executions/${encodeURIComponent(id)}/files`
- GET `/legacy-executions/${encodeURIComponent(id)}/files/${encodeURIComponent(name)}`
- GET `/projects/${encodeURIComponent(projectId)}/legacy-executions`

## Tests (__tests__/)
- `components/`: 8
- `f6/`: 26
- `hooks/`: 1
- `legacy/`: 7
- `utils/`: 1

## Deuda medible (total · archivos)
| Patrón | Ocurrencias | Archivos |
|---|---|---|
| `isAdmin` | 31 | 8 |
| `style={{` | 405 | 56 |
| `hex sueltos (fuera de tokens.css)` | 159 | 31 |
| `error tragado .catch(() => setX([]|null))` | 4 | 3 |
| `window.confirm` | 1 | 1 |
| `gauge` | 0 | 0 |
| `: any / as any` | 0 | 0 |

## Archivos más grandes
- `src/types/api.d.ts` — 4325 líneas
- `src/f6/SectionEditorPage.tsx` — 1417 líneas
- `src/legacy/pages/ExecutionResultsPage.tsx` — 1306 líneas
- `src/i18n/translations.ts` — 1031 líneas
- `src/legacy/components/DynamicResultsView.tsx` — 1000 líneas
- `src/legacy/utils/exportExecutionExcel.ts` — 926 líneas
- `src/types/index.ts` — 713 líneas
- `src/legacy/types.ts` — 703 líneas
