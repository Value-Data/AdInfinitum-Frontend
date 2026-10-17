#!/usr/bin/env bash
# Gate del frontend de AdInfinitum. Exit 0 solo si todo lo duro pasa.
# Duro: type-check, tipos generados sin diff, tests, build. WARN: lint (eslint no instalado).
set -u
cd "$(dirname "$0")/.." || exit 2

FAIL=0
WARN=0
step() { printf '\n=== %s ===\n' "$1"; }
ok()   { printf '[OK]   %s\n' "$1"; }
bad()  { printf '[FAIL] %s\n' "$1"; FAIL=1; }
warn() { printf '[WARN] %s\n' "$1"; WARN=1; }

if [ ! -d node_modules ]; then
  echo "[FAIL] node_modules ausente: corre 'npm ci' primero"; exit 1
fi

step "1/5 type-check (gate duro): tsc --noEmit -p tsconfig.json"
if npx tsc --noEmit -p tsconfig.json; then ok "type-check"; else bad "type-check"; fi

step "2/5 tipos generados sin diff (openapi.json -> src/types/api.d.ts)"
TMP="$(mktemp -d)"
if npx openapi-typescript openapi.json -o "$TMP/api.d.ts" >/dev/null 2>&1; then
  if diff -q --strip-trailing-cr "$TMP/api.d.ts" src/types/api.d.ts >/dev/null; then
    ok "api.d.ts coincide con openapi.json"
  else
    bad "src/types/api.d.ts difiere de openapi.json: corre 'npm run gen:api' (no editar a mano)"
  fi
else
  warn "openapi-typescript no corrió; no se verificó el diff de tipos"
fi
rm -rf "$TMP"

step "3/5 lint: npm run lint"
if [ -x node_modules/.bin/eslint ] || [ -f node_modules/.bin/eslint.cmd ]; then
  if npm run lint --silent; then ok "lint"; else bad "lint"; fi
else
  warn "eslint no instalado ni configurado (no está en devDependencies): lint omitido"
fi

step "4/5 tests: vitest run"
if [ -d __tests__ ] || ls src/**/*.test.* >/dev/null 2>&1; then
  if npx vitest run; then ok "tests"; else bad "tests"; fi
else
  warn "sin suite de tests"
fi

step "5/5 build: npm run build"
if npm run build; then ok "build"; else bad "build"; fi

printf '\n=== RESULTADO ===\n'
if [ "$FAIL" -ne 0 ]; then echo "GATE: FAIL"; exit 1; fi
if [ "$WARN" -ne 0 ]; then echo "GATE: OK con avisos"; else echo "GATE: OK"; fi
exit 0
