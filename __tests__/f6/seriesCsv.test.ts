import { describe, expect, it } from 'vitest';
import { parseSeriesCsv, serializeSeriesCsv, toIsoDate } from '../../src/f6/sectionModel';

const cols = ['evaporation_mm_d', 'temperature_C', 'brine_flow_t_d'];

describe('serie diaria en CSV', () => {
  it('con ; y coma decimal, encabezado por nombre en cualquier orden, BOM y CRLF', () => {
    const r = parseSeriesCsv('﻿fecha;temperature_C;evaporation_mm_d\r\n2024-01-23;12,5;6,25\r\n2024-01-24;13;7\r\n', cols);
    expect(r).toEqual({ ok: true, n: 2, start: '2024-01-23', composition: null,
      values: { evaporation_mm_d: [6.25, 7], temperature_C: [12.5, 13] } });
  });

  it('el CSV de la versión anterior (coma, punto decimal, caudal opcional vacío)', () => {
    const r = parseSeriesCsv('day,date,evap_mm_day,temp_C,flow_ton_day\n1,23-01-2024,5.5,10,\n2,24-01-2024,6,11,1200.5\n', cols);
    expect(r.ok && r.values).toEqual({ evaporation_mm_d: [5.5, 6], temperature_C: [10, 11], brine_flow_t_d: [null, 1200.5] });
    expect(r.ok && r.start).toBe('2024-01-23');
  });

  it('sin encabezado: fecha opcional, columnas y especies por posición', () => {
    const r = parseSeriesCsv('2024-01-01;1,5;20;100;0,2\n2024-01-02;2;21;110;\n', cols, ['Li+']);
    expect(r.ok && r.values.brine_flow_t_d).toEqual([100, 110]);
    expect(r.ok && r.composition).toEqual([{ 'Li+': 0.2 }, null]);
    expect(parseSeriesCsv('1;2;3\n', cols)).toMatchObject({ ok: true, start: null, n: 1 });
  });

  it('errores: vacío o sin ninguna columna conocida', () => {
    expect(parseSeriesCsv('\n\n', cols)).toEqual({ ok: false, error: 'empty' });
    expect(parseSeriesCsv('foo;bar\n1;2\n', cols)).toEqual({ ok: false, error: 'no_columns' });
  });

  it('exportar y volver a importar da lo mismo, en español y en inglés', () => {
    const values = { evaporation_mm_d: [5.25, null, 7], temperature_C: [10, 11.5, 12], brine_flow_t_d: [1000, 1000.5, null] };
    const comp = [{ 'Li+': 0.15 }, null, { 'Li+': 0.2 }];
    for (const lang of ['es', 'en'] as const) {
      const csv = serializeSeriesCsv('2024-12-31', cols, values, lang, ['Li+'], comp);
      expect(csv.split('\r\n')[0]).toBe(`﻿${['day', 'date', ...cols, 'Li+'].join(lang === 'es' ? ';' : ',')}`);
      expect(parseSeriesCsv(csv, cols, ['Li+'])).toEqual({ ok: true, n: 3, start: '2024-12-31', values,
        composition: comp });
    }
    expect(serializeSeriesCsv(null, ['temperature_C'], { temperature_C: [1.5] }, 'es')).toContain('\r\n1;;1,5\r\n');
  });

  it('fechas aceptadas', () => {
    expect(toIsoDate('2024-02-03')).toBe('2024-02-03');
    expect(toIsoDate('3/2/2024')).toBe('2024-02-03');
    expect(toIsoDate('12,5')).toBeNull();
  });
});
