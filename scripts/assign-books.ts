import { sql } from '../lib/db';

export async function assignBooks(students: { id: number }[]) {
  const books = await sql`SELECT id, reading_level, topic_tags FROM books`;
  const assignments: Record<number, number> = {}; // studentId -> bookId

  for (const s of students) {
    const [student] = await sql`SELECT reading_level_start, interests FROM students WHERE id = ${s.id}`;
    const scored = books
      .map((b: any) => {
        const levelDist = Math.abs(b.reading_level - student.reading_level_start);
        const tagOverlap = b.topic_tags.some((t: string) => student.interests.includes(t)) ? -0.3 : 0;
        return { bookId: b.id, score: levelDist + tagOverlap };
      })
      .sort((a, b) => a.score - b.score);

    const chosen = scored[0].bookId;
    assignments[s.id] = chosen;
    await sql`INSERT INTO assignments (student_id, book_id) VALUES (${s.id}, ${chosen})`;
  }

  return assignments; // pass this into generate-events.ts
}
