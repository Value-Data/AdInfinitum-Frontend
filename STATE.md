# STATE.md — AdInfinitum Frontend

<!-- GENERADO por scripts/cartograph.py. No editar a mano: regenerar. -->
Generado: 2026-10-16 16:43 · rama `f7-ux` @ `6122e45`

**9 rutas en App.tsx · 60 archivos de componente (f6 15, legacy 28, pages 3, components 10, layouts 1, context 2, i18n 1) · 10 hooks · 43 llamadas a endpoints en 3 servicios · 61 operaciones en openapi.json · 24 archivos de test · 95 archivos .ts/.tsx en src**

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
### src/f6 (15)
| Archivo | Exporta | Líneas |
|---|---|---|
| `src/f6/chartPanel.tsx` | Panel, Toggle | 70 |
| `src/f6/Charts.tsx` | DailyCharts, ReportCharts | 484 |
| `src/f6/common.tsx` | RunStatusBadge, PartialRunBanner | 92 |
| `src/f6/CompareExecutions.tsx` | MAX_COMPARE, CompareExecutions | 274 |
| `src/f6/ConfigPanel.tsx` | IssueList, InventoryBadge, INVENTARIO_AQSOL, InventarioPanel, ConfigPanel | 375 |
| `src/f6/EChart.tsx` | ChartPrintContext, EChart | 54 |
| `src/f6/ExecutionPage.tsx` | ExecutionPage | 378 |
| `src/f6/InputParameters.tsx` | InputParameters | 183 |
| `src/f6/labels.tsx` | — | 51 |
| `src/f6/LaunchPanel.tsx` | LaunchPanel | 258 |
| `src/f6/PrintReportPage.tsx` | PrintReportPage | 168 |
| `src/f6/ProCharts.tsx` | LiSankeyPanel, PondHeatmap | 102 |
| `src/f6/ProjectPage.tsx` | ProjectPage | 155 |
| `src/f6/ReportView.tsx` | ReportTableView, KPI_FIRST, KpiCards, RecoveryBars, ReportView | 321 |
| `src/f6/SectionEditorPage.tsx` | InitialStatesEditor, SectionEditorPage | 880 |

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
| `src/legacy/LegacyExecutionsSection.tsx` | LegacyExecutionsSection | 128 |
| `src/legacy/pages/ExecutionResultsPage.tsx` | ExecutionResultsPage | 1306 |
| `src/legacy/utils/chartDateAxis.tsx` | XAxisModeProvider, ScrollableChart, DayDateToggle, DayStepSelect | 157 |

### src/pages (3)
| Archivo | Exporta | Líneas |
|---|---|---|
| `src/pages/LoginPage.tsx` | LoginPage | 115 |
| `src/pages/ProjectsPage.tsx` | ProjectsPage | 245 |
| `src/pages/UsersPage.tsx` | UsersPage | 342 |

### src/components (10)
| Archivo | Exporta | Líneas |
|---|---|---|
| `src/components/common/DecimalsSelect.tsx` | DecimalsSelect | 37 |
| `src/components/common/ErrorBoundary.tsx` | — | 50 |
| `src/components/common/ExecutionFilesTable.tsx` | ExecutionFilesTable | 66 |
| `src/components/common/LoadingSpinner.tsx` | LoadingSpinner | 35 |
| `src/components/common/Modal.tsx` | Modal | 78 |
| `src/components/common/ProtectedRoute.tsx` | ProtectedRoute | 32 |
| `src/components/common/Sidebar.tsx` | Sidebar | 123 |
| `src/components/common/StatusBadge.tsx` | StatusBadge | 54 |
| `src/components/common/Topbar.tsx` | Topbar | 67 |
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
- `useAuth` — `src/context/AuthContext.tsx`
- `useDecimals` — `src/context/DecimalsContext.tsx`
- `useTools` — `src/f6/chartPanel.tsx`
- `useChartPrint` — `src/f6/EChart.tsx`
- `useLabels` — `src/f6/labels.tsx`
- `useAuth (re-export)` — `src/hooks/useAuth.ts`
- `useLanguage` — `src/i18n/LanguageContext.tsx`
- `useT` — `src/i18n/LanguageContext.tsx`
- `useXAxisMode` — `src/legacy/utils/chartDateAxis.tsx`
- `useDayDateAxis` — `src/legacy/utils/chartDateAxis.tsx`

## Contrato y tipos
- `openapi.json`: 61 operaciones. `capabilities` presente: NO (F7 backend Fase 2 pendiente)
- `src/types/api.d.ts` generado por openapi-typescript: sí (DENY: no editar)
- Tipos a mano: `src/types/index.ts`, `src/types/report.ts`

## Endpoints usados por servicio
### `src/services/api.ts` (11)
- GET `/auth/me`
- GET `/executions/${id}/files`
- GET `/executions/${id}/files/${encodeURIComponent(name)}`
- GET `/projects`
- GET `/users`
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
- `components/`: 2
- `f6/`: 13
- `hooks/`: 1
- `legacy/`: 7
- `utils/`: 1

## Deuda medible (total · archivos)
| Patrón | Ocurrencias | Archivos |
|---|---|---|
| `isAdmin` | 22 | 7 |
| `style={{` | 351 | 53 |
| `hex sueltos (fuera de tokens.css)` | 169 | 32 |
| `error tragado .catch(() => setX([]|null))` | 7 | 4 |
| `window.confirm` | 1 | 1 |
| `gauge` | 0 | 0 |
| `: any / as any` | 0 | 0 |

## Archivos más grandes
- `src/types/api.d.ts` — 4442 líneas
- `src/legacy/pages/ExecutionResultsPage.tsx` — 1306 líneas
- `src/i18n/translations.ts` — 1046 líneas
- `src/legacy/components/DynamicResultsView.tsx` — 980 líneas
- `src/legacy/utils/exportExecutionExcel.ts` — 926 líneas
- `src/f6/SectionEditorPage.tsx` — 880 líneas
- `src/legacy/types.ts` — 814 líneas
- `src/types/index.ts` — 814 líneas
