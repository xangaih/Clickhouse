// The three named personas got a deterministic baseline (and a different
// reading_level_start formula) in scripts/seed-postgres.ts; every other student's
// baseline is reconstructible exactly from reading_level_start = 1.5 + baseline*3.
// Needed wherever live code has to regenerate/extrapolate a student's skill curve
// (scripts/regenerate-*.ts one-offs, and the live "simulate session" route) without
// a stored baseline column.
export const PERSONA_BASELINES: Record<string, number> = {
  'Maya Chen': 0.88,
  'Diego Ramirez': 0.85,
  'Sam Haddad': 0.877,
};

export function reconstructBaseline(name: string, readingLevelStart: number): number {
  return PERSONA_BASELINES[name] ?? (readingLevelStart - 1.5) / 3;
}
