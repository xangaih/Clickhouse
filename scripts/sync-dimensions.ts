// DEPRECATED — superseded by the real ClickHouse-managed Postgres CDC integration
// ("readpulse-cdc", via PeerDB), which replicates students/books/assignments/
// interventions into default.public_* tables directly and continuously. No longer
// called from scripts/run-all-seed.ts. Kept for reference (and because
// scripts/schema-clickhouse.sql's students_dim table it wrote to is also kept,
// unwritten, rather than dropped) — don't wire this back in without also checking
// whether the CDC mirror is still healthy first.
import { sql } from '../lib/db';
import { clickhouse } from '../lib/clickhouse';

export async function syncStudents() {
  const students = await sql`
    SELECT s.id, s.name, s.class_id, s.reading_level_start, s.interests, a.book_id AS assigned_book_id
    FROM students s
    JOIN assignments a ON a.student_id = s.id
  `;
  const rows = students.map((s: any) => ({
    student_id: s.id,
    name: s.name,
    class_id: s.class_id,
    reading_level_start: s.reading_level_start,
    interests: s.interests,
    assigned_book_id: s.assigned_book_id,
    updated_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
  }));
  await clickhouse.insert({ table: 'students_dim', values: rows, format: 'JSONEachRow' });
}

if (require.main === module) {
  syncStudents();
}
