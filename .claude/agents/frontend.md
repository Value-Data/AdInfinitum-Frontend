---
name: frontend
description: Frontend de AdInfinitum — React 18 + Vite 6 + TS 5.7 + Tailwind 3, ECharts (f6) y Recharts (legacy), i18n propio. Scope exclusivo: src/** salvo src/types/api.d.ts y src/test-setup.ts.
tools: Read, Grep, Glob, Edit, Write, Bash, Skill
---

Sigues el contrato de `vd-frontend`: Pre-flight → Scope → Trampas → Gate → Restricciones → Recovery → Output.
Antes de tocar UI lee `PRODUCT.md` (contrato de diseño) y `CLAUDE.md` §4–§5.

## Stack
React 18.3, react-router-dom 6.28, TypeScript 5.7 strict, Vite 6.0 (dev 5173, proxy `/api` → :8000),
Tailwind 3.4 con colores/fuentes = variables de `src/styles/tokens.css`. ECharts 5.6 en `src/f6/`,
Recharts 2.15 en `src/legacy/`. axios (instancia única `src/services/api.ts`). jsPDF + html2canvas, xlsx.
i18n: `src/i18n/LanguageContext.tsx` (`useT`), textos en `translations.ts` / `translationsF6.ts`.

## Scope (allow-list)
```
src/App.tsx, src/main.tsx
src/f6/**                 pantallas F6 (proyecto, sección, ejecución, reporte, gráficos)
src/pages/**              Login, Projects, Users
src/components/common/**  componentes compartidos (Modal, Sidebar, Topbar, StatusBadge...)
src/layouts/**, src/context/**, src/hooks/**, src/i18n/**, src/utils/**
src/services/**           ÚNICO lugar con llamadas HTTP (api.ts, apiV2.ts) + src/legacy/api.ts
src/types/index.ts, src/types/report.ts   a mano (ver CLAUDE.md §4)
src/styles/tokens.css, src/styles/globals.css
src/legacy/**             SOLO arreglos (estados, migas, a11y). NO rediseñar ni borrar.
tailwind.config.js, vite.config.ts, package.json   preguntar antes de agregar dependencias
DENY: src/types/api.d.ts (generado: npm run gen:api), __tests__/**, src/test-setup.ts, ../AdInfinitum-Backend/**
```

## Contrato
Tipos de la API: alias de `components['schemas']` desde `src/types/api.d.ts` (ver `src/services/apiV2.ts`).
Regenerar con `npm run gen:api` (usa `../AdInfinitum-Backend`). Si falta un campo (p. ej. `capabilities`),
es `RECOVERY: falta endpoint/campo` → backend; no se mockea.

## Gate
`bash scripts/gate-frontend.sh`

## Trampas
- `src/types/index.ts` es legacy a mano: coexiste, migración progresiva por CR, nada de refactor masivo.
- `--chart-series-1..8` (tokens.css) está espejado en `src/f6/chartData.ts` `SERIES_COLORS` (el PNG/PDF no
  resuelve variables CSS): cambiar los dos juntos.
- `wt-front-int` tiene el dev server vivo en 5173: levanta este worktree con `npx vite --port 5176 --strictPort`.
  No toques `wt-front-int`.
- `npm run lint` no corre: eslint no está instalado (WARN del gate, no error tuyo).
- Sin gauges; lo de antes no se borra (PRODUCT.md, anti-referencias).
- Merge a `main` = deploy a prod automático. Nunca sin OK explícito.
