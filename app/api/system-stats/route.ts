import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { clickhouse } from '@/lib/clickhouse';
import { getDecliningStudents } from '@/lib/queries';

// Never statically cache — this always needs to read live data, and Next.js
// GET route handlers are cached by default unless told otherwise.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [eventsRows, studentsRows] = await Promise.all([
      clickhouse
        .query({ query: 'SELECT count() AS c FROM reading_events', format: 'JSONEachRow' })
        .then((r) => r.json<{ c: string }>()),
      sql`SELECT count(*) AS c FROM students`,
    ]);

    const totalEvents = Number(eventsRows[0]?.c ?? 0);
    const studentsTracked = Number(studentsRows[0]?.c ?? 0);

    // Real wall-clock time for the actual decline-detection query used to flag
    // students — not a synthetic/hardcoded number.
    const start = performance.now();
    const declining = await getDecliningStudents();
    const declineQueryMs = Math.round(performance.now() - start);

    return NextResponse.json({ totalEvents, studentsTracked, declineQueryMs, flaggedCount: declining.length });
  } catch (err) {
    console.error('GET /api/system-stats failed', err);
    return NextResponse.json({ error: 'Failed to load system stats' }, { status: 500 });
  }
}
