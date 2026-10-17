import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../src/services/apiV2', async (orig) => ({
  ...(await orig<typeof import('../../src/services/apiV2')>()),
  getDictionaryLabels: vi.fn(async () => ({})),
}));

import { dailyGroups, dailyRows, saltPonds, seriesUsesOwnName } from '../../src/f6/chartData';
import { RecoveryBars, ReportTableView, formulaText } from '../../src/f6/ReportView';
import { __setLabelsCache, makeLabel } from '../../src/f6/labels';
import type { DailySeries, ReportTable } from '../../src/types/report';

__setLabelsCache('es', {
  'result.mass_t_d': 'Masa', 'result.mass_t_y': 'Masa anual', 'result.global_balance': 'Balance global',
  'result.total_in': 'Total entra',
});

const cascada: DailySeries = {
  stage: 'precon', dates: ['2024-01-01', '2024-01-02', '2024-01-03'], days: [31, 32, 33], product_pond: 'P2',
  groups: [
    { key: 'outflow_t_d', unit: 't/d', series: [{ key: 'P1', pond: true, values: [1, 2, 3] }] },
    { key: 'water_activity', unit: '', series: [{ key: 'P1', pond: true, values: [0.8, 0.79, null] }] },
    { key: 'height_m', unit: 'm', series: [{ key: 'P1', pond: true, values: [null, null, null] }] },
  ],
  composition: { species: ['Li+', 'Na+'], ponds: { P1: { 'Li+': [0.1, 0.2, 0.3], 'Na+': [5, 6, 7] } } },
  salts: { salts: ['Gypsum', 'Halite'], ponds: { P1: {}, P2: { Halite: [1, 0, 2], Gypsum: [0, 0.5, 0] } } },
};

describe('series diarias del dinámico', () => {
  it('grupos del backend (sin los vacíos), composición por especie elegida y sales de la poza elegida', () => {
    const g = dailyGroups(cascada, ['Na+'], 'P2');
    // Li % de la salmuera y la composición son de los gráficos de antes: van primero.
    expect(g.map((x) => [x.key, x.origin])).toEqual([['li_brine_pct', 'group'],
      ['composition_Na+', 'composition'], ['outflow_t_d', 'group'], ['water_activity', 'group'], ['salts_P2', 'salts']]);
    // "Li% por poza (por día)" = Li+ de la salmuera de cada poza (la composición), no la salida.
    expect(g[0]).toMatchObject({ unit: '%', series: [{ key: 'P1', pond: true, values: [0.1, 0.2, 0.3] }] });
    const sales = g[4];
    expect(sales.series.map((s) => s.key)).toEqual(['Gypsum', 'Halite']);
    expect(sales.series.every((s) => s.salt)).toBe(true);
    expect(dailyGroups(cascada, [], null).map((x) => x.key)).toEqual(['li_brine_pct', 'outflow_t_d', 'water_activity']);
    // Li+ no se repite como composición.
    expect(dailyGroups(cascada, ['Li+'], null).map((x) => x.key)).not.toContain('composition_Li+');
  });

  it('cascada: entrada por poza, altura, Li % y composición primero, en el orden del reporte de antes', () => {
    const d: DailySeries = { ...cascada, groups: [
      { key: 'feed_flow', unit: 't/d', series: [{ key: 'feed', values: [1, 1, 1] }] },
      { key: 'li_pct', unit: '%', series: [{ key: 'P1', pond: true, values: [1, 1, 1] }] },
      { key: 'inflow_t_d', unit: 't/d', series: [{ key: 'P1', pond: true, values: [1, 1, 1] }] },
      { key: 'height_m', unit: 'm', series: [{ key: 'P1', pond: true, values: [1, 1, 1] }] },
    ] };
    expect(dailyGroups(d, ['Li+', 'Na+'], 'P2').map((x) => x.key)).toEqual(
      ['inflow_t_d', 'height_m', 'li_brine_pct', 'composition_Na+', 'feed_flow', 'li_pct', 'salts_P2']);
  });

  it('solo las pozas con sal van al selector', () => {
    expect(saltPonds(cascada)).toEqual(['P2']);
    expect(saltPonds({ ...cascada, salts: null })).toEqual([]);
  });

  it('cada fila lleva el día de la corrida (no el índice del período)', () => {
    const filas = dailyRows(cascada, cascada.groups[0]);
    expect(filas[0]).toEqual({ date: '2024-01-01', day: 31, P1: 1 });
    expect(dailyRows({ ...cascada, days: undefined }, cascada.groups[0])[2].day).toBe(3);
  });

  it('planta: composición de la salida con nombre de especie; sólidos internos con etiqueta', () => {
    const planta: DailySeries = { stage: 'liming', dates: ['2024-01-01'], product_pond: null, composition: null, salts: null,
      groups: [
        { key: 'outlet_composition_pct', unit: '%w/w', series: [{ key: 'Li+', species: true, values: [0.4] }] },
        { key: 'liming_solids_t_d', unit: 't/d', series: [{ key: 'Gypsum', salt: true, values: [3] },
          { key: 'boric_acid_removed', values: [0.2] }] },
        { key: 'so4_mg_ratio', unit: '', series: [{ key: 'feed', values: [2.1] }] },
      ] };
    const g = dailyGroups(planta, ['Li+'], null);
    // La composición de 8 especies ya no es la del reporte de antes: va entre los demás.
    expect(g.map((x) => x.key)).toEqual(['so4_mg_ratio', 'outlet_composition_pct', 'liming_solids_t_d']);
    expect(g[2].series.map(seriesUsesOwnName)).toEqual([true, false]);
  });
});

describe('fórmulas en las tablas del reporte', () => {
  const label = makeLabel({ 'result.mass_t_d': 'Masa' });
  it('la fórmula con etiquetas, y debajo tal cual', () => {
    expect(formulaText('mass_t_d × 365', label)).toBe('Masa × 365\nmass_t_d × 365');
    expect(formulaText('a + b', label)).toBe('a + b');
  });

  it('columna y fila derivadas llevan su fórmula como ayuda', () => {
    const t: ReportTable = { key: 'global_balance', row_kind: 'stream', notes: [],
      columns: [{ key: 'mass_t_d', unit: 't/d', kind: 'label' },
                { key: 'mass_t_y', unit: 't/y', kind: 'label', formula: 'mass_t_d × 365' }],
      rows: [{ id: 'total_in', mass_t_d: 10, mass_t_y: 3650, formula: 'Σ mass_t_d (direction = in)' }] };
    render(<ReportTableView table={t} />);
    expect(screen.getByText('Masa anual (t/y)').closest('th')?.getAttribute('title'))
      .toBe('Masa × 365\nmass_t_d × 365');
    expect(screen.getByText('Total entra').closest('td')?.getAttribute('title')).toContain('Σ Masa (direction = in)');
    const celdas = screen.getAllByRole('cell');
    expect(celdas[1].getAttribute('title')).toContain('Σ mass_t_d (direction = in)');
    expect(celdas[2].getAttribute('title')).toContain('mass_t_d × 365');
  });
});

describe('recuperación de Li en barras', () => {
  const st = (stage: 'precon' | 'postliming', v: number | null) => ({ stage, kpis: { li_recovery_pct: v }, tables: [] });
  it('una barra por etapa y la del proceso, junto a las tarjetas', () => {
    render(<RecoveryBars stages={[st('precon', 80), st('postliming', null)]} processKpis={{ process_li_recovery_pct: 61.5 }} />);
    const barras = screen.getAllByRole('progressbar');
    expect(barras).toHaveLength(3);
    expect(barras[0].getAttribute('aria-valuenow')).toBe('80');
    expect(screen.getByText('61,50 %')).toBeTruthy();
    expect(screen.getByText('–')).toBeTruthy();
  });
  it('con una sola etapa no agrega nada a la tarjeta de KPIs', () => {
    const { container } = render(<RecoveryBars stages={[st('precon', 80)]} processKpis={{}} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('planta: los gráficos del reporte de antes, con sus datos', () => {
  const v = [1];
  const planta = (salesKey: string): DailySeries => ({
    stage: 'liming', dates: ['2024-01-01'], product_pond: null, composition: null, salts: null,
    groups: [
      { key: 'liming_flows', unit: 't/d', series: [{ key: 'limed_brine_out', values: v }] },
      { key: 'li_pct', unit: '%', series: [{ key: 'limed_brine_out', values: v }] },
      { key: 'reagents', unit: 't/d', series: [{ key: 'lime_feed', values: v }] },
      { key: 'reagent_solutions_t_d', unit: 't/d', series: [{ key: 'lime_slurry', formula: 'a + b', values: v },
        { key: 'cacl2_solution', values: v }] },
      { key: 'outlet_composition_pct', unit: '%w/w', series: [{ key: 'Li+', species: true, values: v }] },
      { key: 'outlet_composition_pct_old', unit: '%w/w', series: ['Li+', 'Mg++', 'H2O', 'K+', 'SO4--']
        .map((sp) => ({ key: sp, species: true, values: v })) },
      { key: 'salt_cake_t_d', unit: 't/d', series: [{ key: 'salt_cake_dry', values: v }] },
      { key: salesKey, unit: 't/d', series: [{ key: 'steps_salt_precipitated', values: v }] },
      { key: 'so4_mg_ratio', unit: '', series: [{ key: 'feed', values: v }] },
    ] });

  it('Li %, composición (Li+, Mg++, H2O, K+, SO4--), sales totales, reactivos, flujo y SO4/Mg primero', () => {
    for (const k of ['liming_salt_precipitated_t_d', 'salt_precipitated_t_d']) {
      expect(dailyGroups(planta(k), [], null).map((x) => x.key)).toEqual([
        'li_pct', 'outlet_composition_pct_old', 'liming_salt_precipitated_t_d', 'reagent_solutions_t_d',
        'liming_flows', 'so4_mg_ratio', 'reagents', 'outlet_composition_pct', 'salt_cake_t_d']);
    }
    expect(dailyGroups(planta('x'), [], null)[1].series.map((s) => s.key)).toEqual(['Li+', 'Mg++', 'H2O', 'K+', 'SO4--']);
  });

  it('en la cascada, "salt_precipitated_t_d" por poza sigue siendo la sal de cada poza', () => {
    const c: DailySeries = { ...cascada, groups: [{ key: 'salt_precipitated_t_d', unit: 't/d',
      series: [{ key: 'P1', pond: true, values: [1, 2, 3] }] }] };
    expect(dailyGroups(c, [], null).map((x) => x.key)).toContain('salt_precipitated_t_d');
  });
});
