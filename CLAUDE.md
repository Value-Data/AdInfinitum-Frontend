# AdInfinitum — Frontend

## 1. Qué es
Interfaz web del modelo de pozas de evaporación de salmuera de litio de AdInfinitum (plantas de
clientes mineros): configurar secciones (pre-concentración, encalado, post-encalado; estático y
dinámico), lanzar ejecuciones del motor AQSOL, ver resultados, gráficos, cadena, inventario y el
reporte/PDF. Usuarios: ingenieros de proceso de Value Data y, desde F7, clientes externos con rol
`cliente` (solo resultados y PDF). Repo solo-frontend; el backend vive en `../AdInfinitum-Backend`.

## 2. Stack
Lo que REALMENTE corre (package.json de la rama `f7-ux`):
- React 18.3 + react-router-dom 6.28, TypeScript 5.7 (`strict`), Vite 6.0, Tailwind 3.4 (colores
  y fuentes mapeados a variables CSS de `src/styles/tokens.css`).
- Gráficos: ECharts 5.6 (`echarts-for-react` 3.0.2) en `src/f6/`; Recharts 2.15 en `src/legacy/`.
- Exportación: jsPDF 4.2 + html2canvas 1.4, xlsx 0.18, jszip 3.10.
- HTTP: axios 1.7, una sola instancia en `src/services/api.ts` (token + renovación `/auth/refresh`).
- i18n propio: `src/i18n/LanguageContext.tsx` + `translations.ts` + `translationsF6.ts` (es por defecto, en).
- Tests: Vitest 2.1 + Testing Library + jsdom; setup en `src/test-setup.ts`, tests en `__tests__/`.
- Dev server: Vite en 5173 con proxy `/api` → `http://localhost:8000`.
- CI/Deploy: `.github/workflows/main_adinfinitum-frontend.yml` — push a `main` despliega a PROD
  (Azure Web App). Merge a `main` = deploy a prod: requiere OK explícito del usuario.

## 3. Dueño por carpeta
| Carpeta | Dueño | Nadie más escribe ahí |
|---|---|---|
| `src/**` (excepto `src/types/api.d.ts`, `src/test-setup.ts`) | frontend (`vd-frontend`) / ux (`vd-ux`, modo pulido) | sí |
| `src/types/api.d.ts` | GENERADO (`npm run gen:api`) | nadie a mano |
| `src/legacy/**` | frontend, solo arreglos (estados, migas); NO rediseño | ver PRODUCT.md |
| `__tests__/**`, `src/test-setup.ts` | qa (`vd-qa`) | sí |
| `PRODUCT.md` | ux / product | — |
| `scripts/`, `STATE.md` | cartógrafo (`STATE.md` se genera, no se edita) | — |
| `../AdInfinitum-Backend/**` | vd-backend (otro repo) | el frontend NO escribe ahí |

No hay `security/`, `docs/technical/` ni `docs/user-manual/` en este repo (se crean al primer uso).

## 4. Contrato entre backend y frontend
- Contrato: `openapi.json` en la raíz de este repo (copia versionada del OpenAPI del backend).
- Regenerar: `npm run gen:api` = `python ../AdInfinitum-Backend/scripts/dump_openapi.py openapi.json`
  + `openapi-typescript openapi.json -o src/types/api.d.ts`. Requiere el backend como carpeta
  hermana (`app adinf/AdInfinitum-Backend`) y su entorno Python; ojo con en qué rama está ese checkout.
- **Tipos generados: `src/types/api.d.ts`. No se edita a mano.** Verificado 2026-10-16: regenerarlo
  desde el `openapi.json` versionado no produce diff.
- `src/services/apiV2.ts` (F4/F5/F6) y `src/legacy/apiTypes.ts` NO escriben tipos de la API a mano:
  son alias de `components['schemas'][...]`. Usar y extender esos alias.
- Escritos a mano (verdad actual, no ideal):
  - `src/types/report.ts` — a propósito: `GET /executions/{id}/report` devuelve un dict y OpenAPI no
    lo describe; es espejo de `app/reporting/model.py` del backend. Si el backend cambia el modelo
    del reporte, este archivo se actualiza a mano en el mismo CR.
  - `src/types/index.ts` — tipos legacy "alineados con Pydantic" que usa `src/services/api.ts`.
    Coexiste: no se borra ni se refactoriza en masa; migración progresiva por CR.
- Llamadas HTTP solo en `src/services/api.ts`, `src/services/apiV2.ts`, `src/legacy/api.ts`. Nunca
  `fetch`/axios sueltos en un componente.

## 5. Invariantes de dominio
<!-- COMPLETAR — propuesta derivada del plan F7 y de la regla del 2026-10-15; confírmala -->
1. **No se borra nada de antes**: las pantallas, gráficos y bloques del PDF de `src/legacy/**` y los
   gráficos "como el reporte de antes" de `src/f6/` se quedan. Un CR que elimine uno se rechaza.
2. **Sin gauges/medidores** en ninguna pantalla ni PDF (`grep -rniE "gauge" src/` debe quedar vacío
   salvo comentarios).
3. **Los permisos los aplica el backend**: ocultar en la UI no es control de acceso. Un `cliente` no
   debe poder llegar por URL a configuración, log, archivos, inventario o ejecuciones de antes; la UI
   solo refleja `capabilities` (cuando existan).
4. **Los números que se muestran salen del motor/backend**: el frontend no recalcula ni "arregla"
   resultados del motor; solo formatea (`src/utils/numberFormat.ts`, `DecimalsContext`).

## 6. Contexto de riesgo
<!-- COMPLETAR -->
- Usuarios reales: sí (prod en Azure; staging en VM). Desde F7, clientes externos (mineras).
- Entra desde fuera: Excel de carga de secciones (import), archivos de inventario, credenciales de
  login. El frontend renderiza resultados de un motor externo (AQSOL vía DLL en el backend).
- Datos sensibles: datos de proceso de plantas de clientes (confidenciales entre clientes).

## 7. Gates
`scripts/gate-frontend.sh` (exit 0 solo si todo lo duro pasa):
1. Type-check `npx tsc --noEmit -p tsconfig.json` — **gate duro**.
2. Tipos generados sin diff: regenera `api.d.ts` desde `openapi.json` a un temporal y compara.
3. Lint `npm run lint` — **WARN**: el script llama a eslint pero eslint NO está en devDependencies y
   no hay config de eslint. Hasta que se agregue, es aviso.
4. Tests `npx vitest run`.
5. Build `npm run build` (`tsc -b && vite build`).

## Trampas
<!-- Lo llena /vd-trampa. Sembradas del stack react-vite (vault) y de este repo. -->
- (stack) Archivo de tipos legacy a mano (`src/types/index.ts`): **coexiste**; no borrar ni
  refactorizar en masa. Migración progresiva por CR.
- (stack) Puertos: `wt-front-int` (otro worktree) suele tener 5173 ocupado con el dev server vivo.
  Usa `npx vite --port <otro> --strictPort` para que Vite no elija otro puerto en silencio. No toques
  `wt-front-int`.
- Colores de series de gráficos: `--chart-series-1..8` en `tokens.css` están **espejados** en
  `src/f6/chartData.ts` porque el PNG exportado no resuelve variables CSS. Cambiar uno sin el otro
  desincroniza pantalla y PDF/PNG.
- `npm run lint` falla con "eslint not found": no es un error de código, eslint no está instalado.
- `src/types/report.ts` es a mano por diseño (el endpoint de reporte devuelve dict). No intentes
  "generarlo".
- `npm run gen:api` usa `../AdInfinitum-Backend` relativo: en un worktree regenera desde la rama que
  tenga ese checkout, no necesariamente la del CR.
- Merge a `main` despliega a prod automáticamente (GitHub Actions). Trabajo en ramas `f*`.
