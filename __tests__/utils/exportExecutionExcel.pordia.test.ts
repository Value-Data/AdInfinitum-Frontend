/**
 * Hojas por día del Excel de una corrida multi-día.
 *
 * Las hojas Global y Preconcentracion muestran una sola foto (el promedio o el día
 * elegido). Estas despliegan el detalle de los 365 días en formato largo. Se valida
 * sobre la forma real de una corrida de solo preconcentración, donde el resultado del
 * día ES el SolverResult y no viene envuelto en `precon`.
 */

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildExecutionWorkbook } from '../../src/utils/exportExecutionExcel';
import type { ExecutionResult } from '../../src/types';

function poza(nombre: string, numero: number, li: number) {
  return {
    config: { name: nombre, number: numero, area_design_m2: 1080, pond_factor: 0.7 },
    aqsol_result: {
      eq_liquid: { 'H2O': 100 - li, 'Li+': li, 'Cl-': 20, 'Sr++': 0.5 },
      eq_liquid_dll: [100 - li, li, 20],
      precipitated_salts: { NaCl: 1.5, 'CaSO4': 0.5, 'KCl': 0 },
      total_solids_g: 2,
      density_liquid: 1250,
      density_solid: 2100,
      pH: 3.2,
      water_activity: 0.68,
      ionic_strength: 9.5,
    },
    evaporation: 30, salt_precipitated: 2, entrainment: 0.3, leakage: 0.05,
    dilution: 0.4, outlet_flow: 120 + numero, aqsol_input: [], iterations: 7, converged: true,
  };
}

function solverResult(li: number) {
  return {
    initial_aqsol: { eq_liquid: { 'Li+': 0.6 }, eq_liquid_dll: [500, 0.6] },
    ponds: [poza('Buffer', 1, li), poza('PC2', 2, li * 1.1)],
    total_evaporation: 60, total_salt: 4, total_entrainment: 0.6, total_leakage: 0.1,
    final_outlet_flow: 122, li_in: 0.6, li_out: 0.58, li_recovery_pct: 96.6,
  };
}

const DIAS = [0, 1, 2].map((i) => ({
  day: i,
  date_label: `Dia ${i + 1}`,
  temperature_C: 20 + i,
  evap_rate_mm_day: 7.7 + i,
  // Solo preconcentración: el día ES el SolverResult.
  result: solverResult(1 + i * 0.1) as unknown as Record<string, unknown>,
}));

const EXECUTION = {
  id: 'exec-multidia',
  project_id: 'p1',
  execution_type: 'preconcentracion',
  status: 'completed',
  parameters_snapshot: { aqsol_version: '066', precon_days_year: 365 },
} as unknown as ExecutionResult;

function exportar(): XLSX.WorkBook {
  return buildExecutionWorkbook({
    execution: EXECUTION,
    stages: [],
    encalado: null,
    streams: {},
    isMultiDay: true,
    viewMode: 'average',
    validDaysCount: 3,
    dailyResults: DIAS,
    dailyStreams: DIAS.map((d) => ({
      day: d.day,
      date_label: d.date_label,
      streams: {
        '2001': { total_mass_day: 700 + d.day, liquids_day: 700, solids_day: 0, temperature: d.temperature_C },
        '2006': { total_mass_day: 122, liquids_day: 122, solids_day: 0, temperature: d.temperature_C },
      },
    })),
  });
}

describe('Excel multi-día — hojas por día', () => {
  it('agrega las tres hojas de detalle diario', () => {
    const wb = exportar();
    expect(wb.SheetNames).toContain('Metricas por dia');
    expect(wb.SheetNames).toContain('Quimica por dia');
    expect(wb.SheetNames).toContain('Global por dia');
  });

  it('quimica por dia: una fila por dia y por poza, con las especies del motor', () => {
    const wb = exportar();
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Quimica por dia']);
    expect(filas).toHaveLength(3 * 2); // 3 dias x 2 pozas
    expect(filas[0]['Etapa']).toBe('Preconcentración');
    expect(filas[0]['Poza']).toBe('P1 - Buffer');
    // Sr++ es de la 066 y no esta en las 17 canonicas: tiene que aparecer igual.
    expect(filas[0]['Sr++']).toBe(0.5);
    expect(filas[0]['Li+']).toBe(1);
    expect(filas[2]['Día']).toBe(2);
  });

  it('metricas por dia: trae temperatura, convergencia y metricas de poza', () => {
    const wb = exportar();
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Metricas por dia']);
    expect(filas).toHaveLength(6);
    expect(filas[0]['Temperatura (°C)']).toBe(20);
    expect(filas[0]['Flujo salida (ton/d)']).toBe(121);
    expect(filas[0]['Convergió']).toBe('Sí');
    expect(filas[0]['pH']).toBe(3.2);
  });

  it('sales por dia: desglosa cada sal, no solo el total', () => {
    const wb = exportar();
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Sales por dia']);
    expect(filas).toHaveLength(6);
    // Solo las sales que efectivamente precipitan: KCl viene en 0 y no es columna.
    const cols = Object.keys(filas[0]);
    expect(cols).toContain('NaCl');
    expect(cols).toContain('CaSO4');
    expect(cols).not.toContain('KCl');
    expect(filas[0]['NaCl']).toBe(1.5);
    expect(filas[0]['CaSO4']).toBe(0.5);
    expect(filas[0]['Total (ton/d)']).toBe(2);
  });

  it('sales por dia %: cada sal como fraccion del total precipitado de esa poza', () => {
    const wb = exportar();
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Sales por dia %']);
    expect(filas[0]['NaCl']).toBe(75);
    expect(filas[0]['CaSO4']).toBe(25);
    expect(filas[0]['Total (%)']).toBe(100);
  });

  it('global por dia: una fila por dia y por corriente', () => {
    const wb = exportar();
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Global por dia']);
    expect(filas).toHaveLength(3 * 2); // 3 dias x 2 corrientes con datos
    expect(filas[0]['ID']).toBe('P_2001');
    expect(filas[0]['Corriente']).toBe('Well Field');
    expect(filas[0]['Masa total (ton/d)']).toBe(700);
  });
});
