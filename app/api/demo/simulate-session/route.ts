import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { clickhouse, chQuery } from '@/lib/clickhouse';
import { computeSkill, generateSessionEvents, type Trajectory } from '@/scripts/generate-events';
import { reconstructBaseline } from '@/lib/studentBaseline';

// Never statically cache — this always needs to read live data, and Next.js
// GET route handlers are cached by default unless told otherwise.
export const dynamic = 'force-dynamic';

// The trajectory curves are shaped relative to a 30-day (6-week) seeded window —
// dayIndex counts school days from a student's first-ever recorded day.
const SEED_TOTAL_DAYS = 30;

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

    // Advance to the day AFTER this student's latest recorded day — not "today" by
    // wall clock. Clicking Simulate repeatedly in one sitting (the whole point of
    // the button, and the whole point of a live demo moment) needs to extend the
    // chart by one new day each time; using new Date() unconditionally made every
    // click in the same real-world day collapse onto the same "today" point,
    // re-averaging it instead of visibly adding a new one.
    const [span] = await chQuery<{ last_day: string; days_span: number }>(
      `SELECT
         max(toDate(ts)) AS last_day,
         dateDiff('day', min(toDate(ts)), max(toDate(ts))) AS days_span
       FROM reading_events
       WHERE student_id = {studentId:UInt32}`,
      { studentId }
    );

    const dayIndex = (span?.days_span ?? SEED_TOTAL_DAYS - 1) + 1;
    const nextTimestamp = span?.last_day
      ? new Date(new Date(`${span.last_day}T12:00:00Z`).getTime() + 86400000)
      : new Date();

    const baseline = reconstructBaseline(student.name, student.reading_level_start);
    const trajectory = student.trajectory as Trajectory;
    const skill = Math.min(0.99, Math.max(0.05, computeSkill(trajectory, dayIndex, SEED_TOTAL_DAYS, baseline)));
    const events = generateSessionEvents(studentId, student.book_id, skill, nextTimestamp);

    await clickhouse.insert({ table: 'reading_events', values: events, format: 'JSONEachRow' });

    const correctCount = events.filter((e) => e.is_correct === 1).length;
    return NextResponse.json({
      studentId,
      sessionId: events[0].session_id,
      wordCount: events.length,
      accuracy: correctCount / events.length,
      simulatedDay: nextTimestamp.toISOString().slice(0, 10),
    });
  } catch (err) {
    console.error('POST /api/demo/simulate-session failed', err);
    return NextResponse.json({ error: 'Failed to simulate session' }, { status: 500 });
  }
}
