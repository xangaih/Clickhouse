import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getDailyAccuracy, getDecliningStudents, getBookCandidates } from '@/lib/queries';
import { generateAlert } from '@/lib/agent';
import { studentToEmbedding } from '@/lib/embeddings';

// Never statically cache — this always needs to read live data, and Next.js
// GET route handlers are cached by default unless told otherwise.
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const declining = await getDecliningStudents();
    const alerts = await Promise.all(
      declining.map(async (d) => {
        const [student] = await sql`
          SELECT id, name, reading_level_start, interests
          FROM students WHERE id = ${d.student_id}
        `;
        const dailyAccuracy = await getDailyAccuracy(d.student_id);
        const embedding = studentToEmbedding(student.interests);
        const candidates = await getBookCandidates(
          embedding,
          student.reading_level_start - 0.5,
          student.reading_level_start + 0.5
        );
        return generateAlert(d.student_id, student.name, dailyAccuracy, d.recent_accuracy, d.baseline_accuracy, candidates);
      })
    );
    return NextResponse.json(alerts);
  } catch (err) {
    console.error('POST /api/agent/run failed', err);
    return NextResponse.json({ error: 'Agent run failed' }, { status: 500 });
  }
}
