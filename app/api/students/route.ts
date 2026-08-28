import { NextResponse } from 'next/server';
import { sql, pgTimestampToIso } from '@/lib/db';
import { getDailyAccuracy, getDecliningStudents, getEngagementDrop } from '@/lib/queries';
import type { StudentMetric } from '@/lib/types';

export async function GET() {
  try {
    const students = await sql`SELECT id, name FROM students`;
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

    const metrics: StudentMetric[] = await Promise.all(
      students.map(async (s: any) => {
        const dailyAccuracy = await getDailyAccuracy(s.id);
        const d = declineByStudent.get(s.id);
        const iv = interventionByStudent.get(s.id);
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
        };
      })
    );

    return NextResponse.json(metrics);
  } catch (err) {
    console.error('GET /api/students failed', err);
    return NextResponse.json({ error: 'Failed to load students' }, { status: 500 });
  }
}
