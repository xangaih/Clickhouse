import { NextResponse } from 'next/server';
import { sql, pgTimestampToIso } from '@/lib/db';
import { getDecliningStudents, getDecliningStudentsAsOf, getClassDailyAverage, getDailyAccuracy } from '@/lib/queries';
import { generateWeeklyDigest } from '@/lib/agent';
import { accuracyNearDate } from '@/lib/accuracy';
import type { WeeklyDigestInput } from '@/lib/types';

// Never statically cache — this always needs to read live data, and Next.js
// GET route handlers are cached by default unless told otherwise.
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const [currentlyFlagged, flaggedWeekAgo, classTrend, allStudents, interventions] = await Promise.all([
      getDecliningStudents(),
      getDecliningStudentsAsOf(7),
      getClassDailyAverage(),
      sql`SELECT id, name FROM students`,
      sql`
        SELECT DISTINCT ON (i.student_id) i.student_id, i.book_id, b.title AS book_title, i.created_at
        FROM interventions i
        JOIN books b ON b.id = i.book_id
        ORDER BY i.student_id, i.created_at DESC
      `,
    ]);

    const nameById = new Map(allStudents.map((s: any) => [s.id, s.name]));
    const currentlyFlaggedIds = new Set(currentlyFlagged.map((d) => d.student_id));
    const flaggedWeekAgoIds = new Set(flaggedWeekAgo.map((d) => d.student_id));

    const newlyFlagged = currentlyFlagged
      .filter((d) => !flaggedWeekAgoIds.has(d.student_id))
      .map((d) => ({
        name: nameById.get(d.student_id) ?? `Student ${d.student_id}`,
        recentAccuracy: d.recent_accuracy,
        baselineAccuracy: d.baseline_accuracy,
      }));

    const stillFlagged = currentlyFlagged
      .filter((d) => flaggedWeekAgoIds.has(d.student_id))
      .map((d) => ({
        name: nameById.get(d.student_id) ?? `Student ${d.student_id}`,
        recentAccuracy: d.recent_accuracy,
        baselineAccuracy: d.baseline_accuracy,
      }));

    const recovered: WeeklyDigestInput['recovered'] = [];
    for (const iv of interventions as any[]) {
      if (currentlyFlaggedIds.has(iv.student_id)) continue; // still flagged — not "recovered" yet
      const dailyAccuracy = await getDailyAccuracy(iv.student_id);
      const before = accuracyNearDate(dailyAccuracy, pgTimestampToIso(iv.created_at));
      const after = dailyAccuracy.at(-1)?.accuracy ?? null;
      if (before === null || after === null) continue;
      recovered.push({
        name: nameById.get(iv.student_id) ?? `Student ${iv.student_id}`,
        beforeAccuracy: before,
        afterAccuracy: after,
        bookTitle: iv.book_title,
      });
    }

    const recentWeek = classTrend.slice(-7);
    const priorWeek = classTrend.slice(-14, -7);
    const avg = (rows: { accuracy: number }[]) => rows.reduce((a, b) => a + b.accuracy, 0) / rows.length;

    const input: WeeklyDigestInput = {
      classTrend: {
        recentWeekAvg: recentWeek.length ? avg(recentWeek) : 0,
        priorWeekAvg: priorWeek.length ? avg(priorWeek) : 0,
      },
      newlyFlagged,
      stillFlagged,
      recovered,
    };

    const digest = await generateWeeklyDigest(input);
    return NextResponse.json({ digest, input });
  } catch (err) {
    console.error('POST /api/agent/digest failed', err);
    return NextResponse.json({ error: 'Digest generation failed' }, { status: 500 });
  }
}
