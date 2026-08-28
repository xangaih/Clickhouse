export function accuracyNearDate(
  dailyAccuracy: { day: string; accuracy: number }[],
  targetIso: string
): number | null {
  if (dailyAccuracy.length === 0) return null;
  const targetTime = new Date(targetIso).getTime();
  let closest = dailyAccuracy[0];
  let closestDiff = Math.abs(new Date(closest.day).getTime() - targetTime);
  for (const d of dailyAccuracy) {
    const diff = Math.abs(new Date(d.day).getTime() - targetTime);
    if (diff < closestDiff) {
      closest = d;
      closestDiff = diff;
    }
  }
  return closest.accuracy;
}
