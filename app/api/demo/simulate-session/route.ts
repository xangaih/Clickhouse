import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { clickhouse } from '@/lib/clickhouse';
import { computeSkill, generateSessionEvents, type Trajectory } from '@/scripts/generate-events';
import { reconstructBaseline } from '@/lib/studentBaseline';

// Matches the seeded window (6 weeks * 5 days) baked into every trajectory curve —
// "today" is simulated as dayIndex = TOTAL_DAYS, i.e. one school day past the last
// seeded day, extrapolating the same curve rather than resetting to baseline.
const TOTAL_DAYS = 30;

export async function POST(req: NextRequest) {
  try {
    const { studentId } = await req.json();
    if (!Number.isInteger(studentId)) {
      return NextResponse.json({ error: 'studentId must be an integer' }, { status: 400 });
    }

    const [student] = await sql`
      SELECT s.id, s.name, s.trajectory, s.reading_level_start, a.book_id
      FROM students s
      JOIN assignments a ON a.student_id = s.id
      WHERE s.id = ${studentId}
      ORDER BY a.assigned_at DESC
      LIMIT 1
    `;
    if (!student) {
      return NextResponse.json({ error: 'Unknown studentId' }, { status: 400 });
    }

    const baseline = reconstructBaseline(student.name, student.reading_level_start);
    const trajectory = student.trajectory as Trajectory;
    const skill = Math.min(0.99, Math.max(0.05, computeSkill(trajectory, TOTAL_DAYS, TOTAL_DAYS, baseline)));
    const events = generateSessionEvents(studentId, student.book_id, skill, new Date());

    await clickhouse.insert({ table: 'reading_events', values: events, format: 'JSONEachRow' });

    const correctCount = events.filter((e) => e.is_correct === 1).length;
    return NextResponse.json({
      studentId,
      sessionId: events[0].session_id,
      wordCount: events.length,
      accuracy: correctCount / events.length,
    });
  } catch (err) {
    console.error('POST /api/demo/simulate-session failed', err);
    return NextResponse.json({ error: 'Failed to simulate session' }, { status: 500 });
  }
}
