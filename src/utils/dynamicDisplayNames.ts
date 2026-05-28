/* ============================================================
   Mapping engine pond names → doc convention (Pz1.x).
   Section 4 of dynamic-model implementation doc.

   Engine names → doc names:
     Cascade:    "1-1".."1-7"   → "Pz1.1".."Pz1.7"
     Postliming: "Pz10".."Pz18" → designation per postliming_ponds_ai.json
       Pz10 → "Pz1.8-A"
       Pz11 → "Pz1.8-B"
       Pz12 → "Pz1.8-C"
       Pz13 → "Pz1.9-A"
       Pz14 → "Pz1.9-B"
       Pz15 → "Pz1.9-C"
       Pz16 → "Pz1.9-D"
       Pz17 → "Pz1.9-tanque1"
       Pz18 → "Pz1.9-tanque2"
   Chain-merged ponds may be prefixed "CSC/" or "PL/" if there was a collision.
   ============================================================ */

const POSTLIMING_DESIGNATIONS: Record<string, string> = {
  Pz10: 'Pz1.8-A',
  Pz11: 'Pz1.8-B',
  Pz12: 'Pz1.8-C',
  Pz13: 'Pz1.9-A',
  Pz14: 'Pz1.9-B',
  Pz15: 'Pz1.9-C',
  Pz16: 'Pz1.9-D',
  Pz17: 'Pz1.9-tanque1',
  Pz18: 'Pz1.9-tanque2',
};

function transformBaseName(name: string): string {
  // Cascade pattern: "1-N" → "Pz1.N"
  const m = /^(\d+)-(\d+)$/.exec(name);
  if (m) return `Pz${m[1]}.${m[2]}`;
  // Postliming hardcoded map
  if (POSTLIMING_DESIGNATIONS[name]) return POSTLIMING_DESIGNATIONS[name];
  // Synthetic chain row (between cascade and postliming)
  if (name === 'Pta Qca') return 'Pta Qca';
  return name;
}

/**
 * Return the human-friendly display name for a pond.
 * Handles chain-merged prefixes ("CSC/", "PL/") by transforming the suffix
 * and keeping the prefix as a stage hint.
 */
export function displayPondName(name: string): string {
  // Chain-merged prefix?
  const prefixMatch = /^(CSC|PL)\/(.+)$/.exec(name);
  if (prefixMatch) {
    return `${prefixMatch[1]}/${transformBaseName(prefixMatch[2])}`;
  }
  return transformBaseName(name);
}
