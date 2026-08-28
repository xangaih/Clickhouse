import { NextResponse } from 'next/server';
import { sql, pgTimestampToIso } from '@/lib/db';
import { getDailyAccuracy, getDecliningStudents, getEngagementDrop } from '@/lib/queries';
import type { StudentMetric } from '@/lib/types';

// Never statically cache — this always needs to read live data, and Next.js
// GET route handlers are cached by default unless told otherwise.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const students = await sql`
      SELECT id, name, needs_followup, needs_followup_at, needs_followup_reason
      FROM students
    `;
    const declining = await getDecliningStudents();
    const declineByStudent = new Map(declining.map((d) => [d.student_id, d]));
    const engagementDrops = await getEngagementDrop();
    const engagementDropIds = new Set(engagementDrops.map((e) => e.student_id));

    const interventions = await sql`
      SELECT DISTINCT ON (i.student_id)
        i.student_id, i.book_id, b.title AS book_title, i.note, i.created_at
      FROM interventions i
      JOIN books b ON b.id = i.book_id
      ORDER BY i.student_id, i.created_at DESC
    `;
    const interventionByStudent = new Map(interventions.map((i: any) => [i.student_id, i]));

    // Current book — the most recent assignments row per student. Read straight from
    // Postgres (not the CDC-replicated copy in ClickHouse), which has ~60s of lag —
    // this needs to reflect a just-confirmed reassignment in the same session.
    const currentAssignments = await sql`
      SELECT DISTINCT ON (a.student_id)
        a.student_id, a.book_id, b.title AS book_title, a.assigned_at
      FROM assignments a
      JOIN books b ON b.id = a.book_id
      ORDER BY a.student_id, a.assigned_at DESC
    `;
    const currentBookByStudent = new Map(currentAssignments.map((a: any) => [a.student_id, a]));

    const metrics: StudentMetric[] = await Promise.all(
      students.map(async (s: any) => {
        const dailyAccuracy = await getDailyAccuracy(s.id);
        const d = declineByStudent.get(s.id);
        const iv = interventionByStudent.get(s.id);
        const cb = currentBookByStudent.get(s.id);
        return {
          studentId: s.id,
          name: s.name,
          dailyAccuracy,
          recentAccuracy: d?.recent_accuracy ?? dailyAccuracy.at(-1)?.accuracy ?? 0,
          baselineAccuracy: d?.baseline_accuracy ?? dailyAccuracy[0]?.accuracy ?? 0,
          flagged: declineByStudent.has(s.id),
          readingLessOften: engagementDropIds.has(s.id),
          intervention: iv
            ? { bookId: iv.book_id, bookTitle: iv.book_title, note: iv.note, createdAt: pgTimestampToIso(iv.created_at) }
            : null,
          needsFollowup: Boolean(s.needs_followup),
          needsFollowupAt: s.needs_followup_at ? pgTimestampToIso(s.needs_followup_at) : null,
          needsFollowupReason: s.needs_followup_reason ?? null,
          currentBook: cb
            ? { bookId: cb.book_id, title: cb.book_title, assignedAt: pgTimestampToIso(cb.assigned_at) }
            : null,
        };
      })
    );

    return NextResponse.json(metrics);
  } catch (err) {
    console.error('GET /api/students failed', err);
    return NextResponse.json({ error: 'Failed to load students' }, { status: 500 });
  }
}
