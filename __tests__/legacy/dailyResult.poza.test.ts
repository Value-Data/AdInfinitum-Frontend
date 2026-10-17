import { describe, it, expect } from 'vitest';
import { pozaDelError } from '../../src/legacy/utils/dailyResult';

/**
 * En el resumen por día el fallo se marcaba solo como "Error", con el detalle escondido
 * en el tooltip. Con 365 filas eso obliga a pasar el mouse una por una para saber dónde
 * se cortó cada día, así que la poza se extrae del mensaje y se muestra en el badge.
 *
 * Hay dos formatos de mensaje y ambos tienen que resolverse.
 */

describe('pozaDelError', () => {
  it('lee el formato del motor', () => {
    const msg =
      'Error de cálculo en el motor termodinámico — Poza 6 (PC 6.1), iteración 2 de 200';
    expect(pozaDelError(msg)).toBe('PC 6.1');
  });

  it('lee el formato del backend', () => {
    const msg = 'float division by zero — falló en la poza 6 de 14 (PC 6.1). Causa probable: …';
    expect(pozaDelError(msg)).toBe('PC 6.1');
  });

  it('conserva nombres con espacios', () => {
    expect(pozaDelError('… — falló en la poza 1 de 14 (Buffer ).')).toBe('Buffer');
  });

  it('devuelve undefined cuando el mensaje no ubica la poza', () => {
    expect(pozaDelError('Proceso hijo falló: killed')).toBeUndefined();
    expect(pozaDelError('')).toBeUndefined();
    expect(pozaDelError(null)).toBeUndefined();
    expect(pozaDelError(undefined)).toBeUndefined();
  });

  it('no confunde una etapa con una poza', () => {
    expect(pozaDelError('ValueError: algo — falló en la etapa encalado.')).toBeUndefined();
  });
});
