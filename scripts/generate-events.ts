import { clickhouse } from '../lib/clickhouse';
import { randomUUID } from 'crypto';

export type Trajectory = 'steady' | 'improving' | 'struggling' | 'quiet_decline' | 'recovered';

// Quiet-decline shape: flat, then a smooth, sustained linear decline over the
// last DECLINE_DAYS school days (~2.5 weeks), landing at a common end-accuracy
// target regardless of starting baseline — genuinely still "passing," not a
// cliff. The decline-detection query (lib/queries.ts) now compares a recent
// 7-day window against a non-overlapping earlier 8-20-day-back baseline window,
// so the baseline isn't diluted by the decline itself the way an end-anchored
// 14-day window was — that's what lets a gentle, realistic drop still clear the
// detection threshold with real margin, instead of needing an artificially
// steep one.
const DECLINE_DAYS = 13;
const DECLINE_END_ACCURACY = 0.72;

// 'recovered': same kind of decline as quiet_decline, but shorter (2 weeks) and
// followed by a 1-week recovery — the shape an intervention that actually worked
// would produce. Trough matches quiet_decline's end-accuracy target for
// consistency; recovery lands just under baseline, not a full snap-back.
const RECOVERED_DECLINE_DAYS = 10;
const RECOVERED_IMPROVE_DAYS = 5;
const RECOVERED_TROUGH_ACCURACY = 0.72;

// Exported so a live "simulate today's session" route can extrapolate the same
// curve one step past the seeded window (dayIndex = totalDays) rather than
// reimplementing trajectory shapes.
export function computeSkill(trajectory: Trajectory, dayIndex: number, totalDays: number, baseline: number) {
  const t = dayIndex / totalDays;
  switch (trajectory) {
    case 'steady': return baseline;
    case 'improving': return Math.min(0.97, baseline + 0.15 * t);
    case 'struggling': return baseline;
    case 'quiet_decline': {
      const declineStart = totalDays - DECLINE_DAYS;
      if (dayIndex < declineStart) return baseline;
      const frac = (dayIndex - declineStart) / (DECLINE_DAYS - 1);
      return baseline - (baseline - DECLINE_END_ACCURACY) * frac;
    }
    case 'recovered': {
      const declineStart = totalDays - RECOVERED_DECLINE_DAYS - RECOVERED_IMPROVE_DAYS;
      const improveStart = totalDays - RECOVERED_IMPROVE_DAYS;
      if (dayIndex < declineStart) return baseline;
      if (dayIndex < improveStart) {
        const frac = (dayIndex - declineStart) / (RECOVERED_DECLINE_DAYS - 1);
        return baseline - (baseline - RECOVERED_TROUGH_ACCURACY) * frac;
      }
      const recoveryTarget = baseline - 0.05;
      const frac = (dayIndex - improveStart + 1) / RECOVERED_IMPROVE_DAYS;
      return RECOVERED_TROUGH_ACCURACY + (recoveryTarget - RECOVERED_TROUGH_ACCURACY) * frac;
    }
  }
}

function bernoulli(p: number) { return Math.random() < p; }

function logNormal(mean: number, sigma: number) {
  const normal = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
  return Math.exp(Math.log(Math.max(mean, 1)) + sigma * normal);
}

export interface ReadingEvent {
  student_id: number;
  session_id: string;
  book_id: number;
  ts: string;
  word_index: number;
  is_correct: number;
  hesitation_ms: number;
}

// One session's worth of word-level events at a given skill level and timestamp.
// Shared by the bulk seed loop below and the live "simulate today's session" API
// route — the route computes `skill` via computeSkill() and passes real time.
export function generateSessionEvents(
  studentId: number,
  bookId: number,
  skill: number,
  timestamp: Date
): ReadingEvent[] {
  const events: ReadingEvent[] = [];
  const sessionId = randomUUID();
  const ts = timestamp.toISOString().replace('T', ' ').replace('Z', '');
  const wordCount = 50 + Math.floor(Math.random() * 100);

  for (let w = 0; w < wordCount; w++) {
    const noisySkill = Math.min(0.99, Math.max(0.02, skill + (Math.random() - 0.5) * 0.06));
    events.push({
      student_id: studentId,
      session_id: sessionId,
      book_id: bookId,
      ts,
      word_index: w,
      is_correct: bernoulli(noisySkill) ? 1 : 0,
      hesitation_ms: Math.round(logNormal(600 - 300 * skill, 0.4)),
    });
  }

  return events;
}

export async function generateForStudent(
  studentId: number,
  bookId: number,          // now a real assigned book, not hardcoded
  trajectory: Trajectory,
  baseline: number,
  weeks = 6
) {
  const totalDays = weeks * 5;
  const events: ReadingEvent[] = [];

  for (let day = 0; day < totalDays; day++) {
    const skill = Math.min(0.99, Math.max(0.05, computeSkill(trajectory, day, totalDays, baseline)));
    const ts = new Date(Date.now() - (totalDays - day) * 86400000);
    events.push(...generateSessionEvents(studentId, bookId, skill, ts));
  }

  await clickhouse.insert({ table: 'reading_events', values: events, format: 'JSONEachRow' });
}
