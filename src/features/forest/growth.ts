// Derive visible scale from planted_at without DB writes.
// <1 day → 0.55, 1–6 days → ease toward base, ≥7 days → base.
export function ageScale(plantedAt: string, baseScale: number, now = Date.now()): number {
  const ageMs = now - new Date(plantedAt).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (ageMs < day) return baseScale * 0.55;
  if (ageMs >= 7 * day) return baseScale;
  const t = (ageMs - day) / (6 * day); // 0..1 across days 1..7
  // ease-out cubic
  const eased = 1 - Math.pow(1 - t, 3);
  return baseScale * (0.55 + 0.45 * eased);
}

export function ageDescription(plantedAt: string, now = Date.now()): string {
  const ageMs = now - new Date(plantedAt).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (ageMs < day) return "Seedling";
  if (ageMs < 7 * day) return "Young tree";
  if (ageMs < 60 * day) return "Growing tree";
  if (ageMs < 365 * day) return "Established tree";
  return "Mature tree";
}
