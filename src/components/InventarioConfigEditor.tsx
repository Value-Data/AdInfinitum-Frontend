import React, { useCallback, useState } from 'react';
import type {
  DynamicConfig,
  DynamicEncaladoParams,
  DynamicPondConfig,
  DynamicPostlimingParams,
  DynamicPostlimingPondConfig,
  InventarioConfig,
  InventarioPond,
  SaltFactor,
} from '../types';
import { AQSOL_VERSIONS } from '../types';
import SectionHeader from './common/SectionHeader';
import BrineCompositionEditor from './common/BrineCompositionEditor';
import ClimateEditor from './common/ClimateEditor';
import FactorsEditor from './common/FactorsEditor';
import {
  EncaladoParamsSection,
  PostlimingParamsSection,
  PostlimingPondsSection,
  PreconPondsSection,
  SimulationSection,
} from './common/ConfigSections';
import { useT } from '../i18n/LanguageContext';

/**
 * Editor del escenario del modo con inventario.
 *
 * **Misma estructura que el modo dinámico**: las mismas secciones, en el mismo
 * orden, con las mismas tablas —son literalmente los mismos componentes, de
 * `common/ConfigSections`— más una sección propia: el inventario inicial. Lo demás
 * que cambia es de dónde sale cada valor dentro del blob, no cómo se ve.
 *
 * El inventario inicial es lo propio de este modo: define desde qué altura y con qué
 * composición arranca cada poza el día 1. Sin él la cascada empieza vacía y tarda
 * años simulados en llegar a régimen.
 *
 * El backend vuelca cada bloque a los archivos que el motor sabe leer justo antes de
 * correr (`inventario_runner._materializar`), así que lo editado llega al motor sin
 * tocarle una línea.
 */

// Valores por defecto de la geometría de operación. Las pozas intermedias operan a
// 0,20 m; la última mantiene más columna porque es la que alimenta al encalado.
const H_OBJETIVO = 0.2;
const H_OBJETIVO_ULTIMA = 0.92;
const H_MAX = 1;
const FACTOR_POZA = 0.7;
const IMPREGNACION_PCT = 10;
const FUGA_MM_DIA = 0.03;

/** Alturas de operación por defecto: 0,20 m en todas y 0,92 m en la última. */
function alturasPorDefecto(pozas: InventarioPond[]): InventarioPond[] {
  return pozas.map((p, i) => ({
    ...p,
    target_height_m: i === pozas.length - 1 ? H_OBJETIVO_ULTIMA : H_OBJETIVO,
    max_height_m: H_MAX,
  }));
}

// Del inventario inicial solo se edita la ALTURA y la composición. La masa líquida
// sale de la geometría —masa = altura × área × densidad— y se recalcula sola; la
// densidad y la actividad de agua vienen del escenario y se conservan sin mostrarse:
// son propiedades que el motor necesita pero que nadie tipea a mano.
const CAMPOS_INVENTARIO: { key: string; label: string; dec: number }[] = [
  { key: 'height_m', label: 'Altura (m)', dec: 4 },
];

interface Props {
  value: InventarioConfig;
  onChange: (next: InventarioConfig) => void;
}

export default function InventarioConfigEditor({ value, onChange }: Props) {
  const t = useT();
  const [abierto, setAbierto] = useState<Record<string, boolean>>({ sim: true });
  const toggle = useCallback(
    (k: string) => setAbierto((p) => ({ ...p, [k]: !p[k] })),
    [],
  );

  const pozas = (value.pozas as InventarioPond[] | undefined) ?? [];
  const feed = value.feed ?? {};
  const inventario = (value.inventario as Record<string, Record<string, unknown>> | undefined) ?? {};
  const clima = (value.clima as Record<string, unknown> | undefined) ?? {};
  const factores = (value.factores as Record<string, number> | undefined) ?? {};
  const composicion = (feed.composicion_pp as Record<string, number> | undefined) ?? {};
  const caudal = (feed.flowrate_tpd as number | undefined) ?? 0;

  const set = (campo: string, v: unknown) => onChange({ ...value, [campo]: v });

  // --- Pozas: se editan con la tabla del dinámico -------------------------------
  //
  // Los campos son los mismos que el motor de Mariana declara en su DynamicPondConfig
  // (es el mismo dataclass), pero en el escenario vienen parciales: lo que el JSON no
  // trae, el motor lo completa con su default. Acá se completa igual para poder
  // mostrarlo, y al guardar se conserva lo que el escenario traía de más —los
  // comentarios `_…` de la entrega, por ejemplo.
  const pozasComoDinamicas: DynamicPondConfig[] = pozas.map((p, i) => ({
    name: String(p.name ?? ''),
    number: (p.number as number | undefined) ?? i + 1,
    area_design_m2: Number(p.area_design_m2 ?? 0),
    pond_factor: Number(p.pond_factor ?? FACTOR_POZA),
    entrainment_pct: Number(p.entrainment_pct ?? IMPREGNACION_PCT),
    leakage_mm_day: Number(p.leakage_mm_day ?? FUGA_MM_DIA),
    dilution_frac: Number(p.dilution_frac ?? 0),
    target_height_m: (p.target_height_m as number | null | undefined) ?? null,
    max_height_m: (p.max_height_m as number | null | undefined) ?? null,
    is_terminal_buffer: Boolean(p.is_terminal_buffer),
    apply_berm_factor: Boolean(p.apply_berm_factor),
    control_mode: (p.control_mode as DynamicPondConfig['control_mode']) ?? 'ALTURA',
    target_outflow_t_day: (p.target_outflow_t_day as number | null | undefined) ?? null,
    utilization: Number(p.utilization ?? 1),
    height_floor_m: (p.height_floor_m as number | null | undefined) ?? null,
    h_arranque_m: Number(p.h_arranque_m ?? 0),
  }));

  const setPozas = (nuevas: DynamicPondConfig[]) => {
    // Se fusiona contra la poza previa para no perder las claves que el escenario
    // traiga de más. Por índice primero (cubre renombrar) y por nombre si no calza.
    const fusionadas: InventarioPond[] = nuevas.map((p, i) => {
      const previa =
        pozas[i]?.name === p.name ? pozas[i] : pozas.find((q) => q.name === p.name);
      const fusion: InventarioPond = { ...(previa ?? {}), ...p };
      // Dos escenarios de la entrega traen el marco de alturas, donde el setpoint de
      // control es `nivel_operacion_m` y le gana a `target_height_m` al cargarse. Si
      // no se sincroniza, editar la altura objetivo ahí no cambiaría nada y no habría
      // forma de darse cuenta.
      if (previa && previa.nivel_operacion_m !== undefined) {
        fusion.nivel_operacion_m = p.target_height_m;
      }
      return fusion;
    });

    // El inventario se sigue: una poza que ya no existe no queda sembrada, y una que
    // se renombró se lleva su estado inicial en vez de perderlo.
    let inv: Record<string, Record<string, unknown>>;
    if (nuevas.length === pozas.length) {
      inv = Object.fromEntries(
        pozas
          .map((p, i) => [nuevas[i].name, inventario[p.name]] as const)
          .filter(([, v]) => v != null),
      );
    } else {
      const vivas = new Set(nuevas.map((p) => p.name));
      inv = Object.fromEntries(Object.entries(inventario).filter(([k]) => vivas.has(k)));
    }
    onChange({ ...value, pozas: fusionadas, inventario: inv });
  };

  // --- Inventario inicial: se muestra y se edita en %, se guarda en toneladas ---
  //
  // El motor guarda la composición como masa absoluta por especie, y esa masa suma
  // exactamente `mass_liquid_ton`. Pedirle al usuario que edite toneladas sería
  // pedirle que mantenga esa identidad a mano: cambiar una especie obligaría a
  // recalcular el resto para que el total siga cerrando. Con porcentajes la
  // identidad la mantiene el editor, que es lo que corresponde.
  const especiesInventario = Object.keys(
    (Object.values(inventario).find((d) => d?.composition)?.composition as
      | Record<string, number>
      | undefined) ?? composicion,
  );

  const composicionPct = (inv: Record<string, unknown> | null): Record<string, number> => {
    const comp = (inv?.composition as Record<string, number> | undefined) ?? {};
    const total = Object.values(comp).reduce((a, b) => a + (b || 0), 0);
    if (total <= 0) return {};
    return Object.fromEntries(
      Object.entries(comp).map(([sp, v]) => [sp, (v / total) * 100]),
    );
  };

  const setInventarioPoza = (poza: string, estado: Record<string, unknown>) =>
    set('inventario', { ...inventario, [poza]: estado });

  const setEspeciePct = (poza: string, especie: string, nuevoPct: number) => {
    const inv = inventario[poza] ?? {};
    const masa = (inv.mass_liquid_ton as number | undefined) ?? 0;
    const pct = { ...composicionPct(inv), [especie]: nuevoPct };
    // Las toneladas se rearman desde los porcentajes contra la masa líquida, así el
    // total sigue cerrando aunque los porcentajes no sumen 100 mientras se tipea.
    setInventarioPoza(poza, {
      ...inv,
      composition: Object.fromEntries(
        Object.entries(pct).map(([sp, v]) => [sp, (v / 100) * masa]),
      ),
    });
  };

  /** Masa líquida de una poza a partir de su altura: h × área × densidad.
   *
   * La identidad se verifica contra los datos de la entrega al decimal, en las diez
   * pozas. Por eso la altura alcanza como única entrada: la masa deja de ser un
   * número que hay que mantener consistente a mano.
   */
  const masaDesdeAltura = (poza: string, altura: number, densidad: number): number => {
    const area = pozas.find((p) => p.name === poza)?.area_design_m2 ?? 0;
    return (altura * Number(area) * densidad) / 1000;
  };

  const setCampoInventario = (poza: string, campo: string, valor: number | null) => {
    const inv = inventario[poza] ?? {};
    const estado: Record<string, unknown> = { ...inv, [campo]: valor };
    if (campo === 'height_m' && valor != null) {
      const densidad = (inv.density_kg_m3 as number | undefined) ?? 0;
      const masa = masaDesdeAltura(poza, valor, densidad);
      estado.mass_liquid_ton = masa;
      // Las toneladas por especie siguen a la masa, conservando los porcentajes que
      // el usuario fijó: subir la altura no cambia la composición, cambia cuánto hay.
      const pct = composicionPct(inv);
      if (Object.keys(pct).length > 0) {
        estado.composition = Object.fromEntries(
          Object.entries(pct).map(([sp, v]) => [sp, (v / 100) * masa]),
        );
      }
    }
    setInventarioPoza(poza, estado);
  };

  // El clima del modo dinámico y el de este son las mismas dos series por día; solo
  // cambian los nombres de las claves de alrededor. Se traduce en la frontera para
  // poder editar con el mismo componente en vez de mantener dos tablas.
  const climaComoDinamico: DynamicConfig['climate'] = {
    series_start_date: String(value.start_date ?? ''),
    evaporation_mm_day: (clima.evaporation_mm_day as number[] | undefined) ?? [],
    temperature_C: (clima.temperature_C as number[] | undefined) ?? [],
    brine_flow_ton_day: null,
  };

  const diasClima = ((clima.evaporation_mm_day as number[] | undefined) ?? []).length;

  const setClima = (c: DynamicConfig['climate']) => {
    const n = c.evaporation_mm_day.length;
    onChange({
      ...value,
      clima: {
        ...clima,
        evaporation_mm_day: c.evaporation_mm_day,
        temperature_C: c.temperature_C,
        n_days_cycle: n,
        // `doy` etiqueta cada día del año típico. Se recorta o se completa para que
        // acompañe a las series: el motor exige que las tres tengan el mismo largo.
        doy: Array.from({ length: n }, (_, i) =>
          ((clima.doy as string[] | undefined) ?? [])[i] ?? String(i + 1),
        ),
      },
    });
  };

  // Los factores de la preconcentración se guardan como {nombre: factor} y el editor
  // compartido trabaja con la lista del dinámico. El índice es posicional: este motor
  // no expone otro. Los de encalado y postliming ya vienen como lista.
  const factoresComoLista: SaltFactor[] = Object.entries(factores).map(([name, f], i) => ({
    dll_index: i,
    name,
    precipitation_factor: f,
  }));

  const setFactores = (lista: SaltFactor[]) =>
    set('factores', Object.fromEntries(lista.map((f) => [f.name, f.precipitation_factor])));

  const encalado = value.encalado;
  const postliming = value.postliming;

  return (
    <div>
      {/* --- Simulación --- */}
      <SectionHeader
        title={t('section_simulation')}
        isOpen={!!abierto.sim}
        onToggle={() => toggle('sim')}
      >
        <SimulationSection
          nDays={(value.days_max as number | undefined) ?? 0}
          startDate={String(value.start_date ?? '')}
          avgFlow={caudal}
          // Vacío = el motor usa 1,5× el promedio, que es lo que hace su CLI.
          maxFlow={(feed.max_flow_tpd as number | undefined) ?? caudal * 1.5}
          onChange={(patch) => {
            const next: InventarioConfig = { ...value };
            if (patch.nDays !== undefined) next.days_max = patch.nDays;
            if (patch.startDate !== undefined) next.start_date = patch.startDate;
            if (patch.avgFlow !== undefined || patch.maxFlow !== undefined) {
              next.feed = {
                ...feed,
                ...(patch.avgFlow !== undefined ? { flowrate_tpd: patch.avgFlow } : {}),
                ...(patch.maxFlow !== undefined ? { max_flow_tpd: patch.maxFlow } : {}),
              };
            }
            onChange(next);
          }}
        />
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
          {t('invcfg_sim_hint')}
        </p>
      </SectionHeader>

      {/* --- Salmuera de pozo --- */}
      <SectionHeader
        title={t('section_brine')}
        tooltip={t('dyncfg_section_tip_brine')}
        isOpen={!!abierto.feed}
        onToggle={() => toggle('feed')}
      >
        {/* Base de catálogo y motor, igual que en el dinámico. Este motor viene solo
            en 027: la entrega de Mariana no trae la variante 066, así que el selector
            queda fijo en vez de ofrecer una opción que fallaría al ejecutar. */}
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div>
            <label className="label" title={t('invcfg_aqsol_tip')}>
              {t('aqsol_basis_dynamic')}
            </label>
            <select
              className="input w-40"
              value={String(value.aqsol_version ?? '027')}
              disabled
              title={t('invcfg_aqsol_tip')}
            >
              {AQSOL_VERSIONS.filter((v) => v.value === '027').map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
          <p className="text-xs mb-2 flex-1" style={{ color: 'var(--color-text-secondary)' }}>
            {t('invcfg_aqsol_tip')}
          </p>
        </div>
        <BrineCompositionEditor
          value={composicion}
          onChange={(c) => set('feed', { ...feed, composicion_pp: c })}
          totalFlow={caudal}
          species={Object.keys(composicion)}
        />
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
          {t('invcfg_feed_hint')}
        </p>
      </SectionHeader>

      {/* --- Pozas de preconcentración --- */}
      <SectionHeader
        title={`${t('section_precon_ponds')} (${pozas.length})`}
        isOpen={!!abierto.pozas}
        onToggle={() => toggle('pozas')}
      >
        <PreconPondsSection
          ponds={pozasComoDinamicas}
          onChange={setPozas}
          nameOf={(n) => `Poza ${n}`}
        />
        <button
          className="btn btn-outline btn-sm mt-3 ml-2"
          onClick={() => set('pozas', alturasPorDefecto(pozas))}
          title={t('invcfg_default_heights_tip')}
        >
          {t('invcfg_default_heights')}
        </button>
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
          {t('invcfg_ponds_hint')}
        </p>
      </SectionHeader>

      {/* --- Inventario inicial: lo único que este modo agrega al dinámico --- */}
      <SectionHeader
        title={`${t('invcfg_section_inventory')} (${Object.keys(inventario).length})`}
        tooltip={t('invcfg_inventory_tip')}
        isOpen={!!abierto.inv}
        onToggle={() => toggle('inv')}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 1100 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="text-left py-1">{t('invmode_pond')}</th>
                {CAMPOS_INVENTARIO.map((c) => (
                  <th key={c.key} className="text-right px-1">{c.label}</th>
                ))}
                <th className="text-right px-1">{t('brine_sum')} %</th>
                {especiesInventario.map((sp) => (
                  <th key={sp} className="text-right px-1 font-mono text-xs">{sp}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pozas.map((p) => {
                const inv = inventario[p.name] ?? null;
                const pct = composicionPct(inv);
                const suma = Object.values(pct).reduce((a, b) => a + b, 0);
                const cierra = Math.abs(suma - 100) < 0.01;
                return (
                  <tr key={p.name} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="py-1 font-medium">{p.name}</td>
                    {CAMPOS_INVENTARIO.map((c) => (
                      <td key={c.key} className="px-1">
                        <input
                          type="number"
                          className="input input-number w-28 text-right"
                          value={(inv?.[c.key] as number | undefined) ?? ''}
                          placeholder="—"
                          onChange={(e) =>
                            setCampoInventario(
                              p.name,
                              c.key,
                              e.target.value === '' ? null : parseFloat(e.target.value),
                            )
                          }
                        />
                      </td>
                    ))}
                    <td
                      className="px-1 text-right font-mono text-xs"
                      style={{ color: inv ? (cierra ? undefined : 'var(--color-danger)') : undefined }}
                    >
                      {inv ? suma.toFixed(3) : '—'}
                    </td>
                    {especiesInventario.map((sp) => (
                      <td key={sp} className="px-1">
                        <input
                          type="number"
                          className="input input-number w-24 text-right"
                          step={0.000001}
                          value={inv ? pct[sp] ?? 0 : ''}
                          placeholder="—"
                          disabled={!inv}
                          onChange={(e) =>
                            setEspeciePct(p.name, sp, parseFloat(e.target.value) || 0)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
          {t('invcfg_inventory_hint')}
        </p>
      </SectionHeader>

      {/* --- Factores de sales preconcentración --- */}
      <SectionHeader
        title={`${t('section_precon_factors')} (${Object.keys(factores).length})`}
        tooltip={t('dyncfg_section_tip_salt_factors')}
        isOpen={!!abierto.fact}
        onToggle={() => toggle('fact')}
      >
        <FactorsEditor
          label="Precon"
          factors={factoresComoLista}
          onChange={setFactores}
        />
      </SectionHeader>

      {/* --- Clima: la misma tabla editable que el dinámico --- */}
      <SectionHeader
        title={`${t('section_climate')} (${diasClima})`}
        tooltip={t('dyncfg_section_tip_climate')}
        isOpen={!!abierto.clima}
        onToggle={() => toggle('clima')}
      >
        {/* El largo de la serie es libre, igual que en el dinámico: el solver la cicla
            con `(día-1) % largo`. Con 365 días además se ancla al calendario —el día 1
            cae en el MM-DD de la fecha de inicio—, que es lo que hace la entrega. */}
        <ClimateEditor
          climate={climaComoDinamico}
          onChange={setClima}
          showFlow={false}
        />
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
          {t('invcfg_climate_hint')}
        </p>
      </SectionHeader>

      {/* --- Parámetros de encalado ---
          La entrega de Mariana no incluye encalado, así que la cadena lo corre con el
          motor del modelo dinámico. Los parámetros son los de ese motor y se editan
          acá, en el escenario del modo: son los que se van a usar en esta cadena, no
          los de la configuración dinámica del proyecto. */}
      <SectionHeader
        title={t('section_encalado_params')}
        isOpen={!!abierto.enc}
        onToggle={() => toggle('enc')}
      >
        {encalado?.config ? (
          <EncaladoParamsSection
            value={encalado.config}
            onChange={(c: DynamicEncaladoParams) =>
              set('encalado', { ...encalado, config: c })
            }
          />
        ) : (
          <BloqueFaltante texto={t('invcfg_stage_block_missing')} />
        )}
      </SectionHeader>

      <SectionHeader
        title={`${t('section_encalado_factors')} (${encalado?.factors?.length ?? 0})`}
        tooltip={t('dyncfg_section_tip_salt_factors')}
        isOpen={!!abierto.enc_fact}
        onToggle={() => toggle('enc_fact')}
      >
        {encalado ? (
          <FactorsEditor
            label="Encalado"
            factors={encalado.factors ?? []}
            onChange={(f) => set('encalado', { ...encalado, factors: f })}
          />
        ) : (
          <BloqueFaltante texto={t('invcfg_stage_block_missing')} />
        )}
      </SectionHeader>

      {/* --- Post-liming --- */}
      <SectionHeader
        title={`${t('section_postliming')} (${postliming?.ponds?.length ?? 0})`}
        isOpen={!!abierto.post}
        onToggle={() => toggle('post')}
      >
        {postliming ? (
          <>
            <PostlimingParamsSection
              params={postliming.config}
              onChange={(c: DynamicPostlimingParams) =>
                set('postliming', { ...postliming, config: c })
              }
            />
            <PostlimingPondsSection
              ponds={postliming.ponds ?? []}
              onChange={(ponds: DynamicPostlimingPondConfig[]) =>
                set('postliming', { ...postliming, ponds })
              }
            />
          </>
        ) : (
          <BloqueFaltante texto={t('invcfg_stage_block_missing')} />
        )}
      </SectionHeader>

      <SectionHeader
        title={`${t('section_postliming_factors')} (${postliming?.factors?.length ?? 0})`}
        tooltip={t('dyncfg_section_tip_salt_factors')}
        isOpen={!!abierto.post_fact}
        onToggle={() => toggle('post_fact')}
      >
        {postliming ? (
          <FactorsEditor
            label="Concentración"
            factors={postliming.factors ?? []}
            onChange={(f) => set('postliming', { ...postliming, factors: f })}
          />
        ) : (
          <BloqueFaltante texto={t('invcfg_stage_block_missing')} />
        )}
      </SectionHeader>
    </div>
  );
}

/** Aviso para un escenario guardado antes de que el modo tuviera estas dos etapas. */
function BloqueFaltante({ texto }: { texto: string }) {
  return (
    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
      {texto}
    </p>
  );
}

function Campo({
  label,
  valor,
  onChange,
  tipo = 'text',
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  tipo?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={tipo}
        className={`input w-full ${tipo === 'number' ? 'input-number' : ''}`}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
