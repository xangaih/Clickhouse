import 'dotenv/config';
import { seedPostgres } from './seed-postgres';
import { seedBooks } from './seed-books';
import { assignBooks } from './assign-books';
import { generateForStudent } from './generate-events';

async function main() {
  const students = await seedPostgres();      // Postgres: teacher, class, 40 students
  await seedBooks();                          // Postgres + ClickHouse: 24 books
  const assignments = await assignBooks(students); // Postgres: one book per student
  // Dimension sync is no longer a manual step — the ClickHouse-managed Postgres CDC
  // integration ("readpulse-cdc") replicates students/books/assignments/interventions
  // continuously. See scripts/sync-dimensions.ts for why it's kept but unused.

  for (const s of students) {
    await generateForStudent(s.id, assignments[s.id], s.trajectory, s.baseline);
    console.log(`Generated events for student ${s.id} (${s.trajectory})`);
  }

  console.log('Seeding complete. Run the decline-detection query next to verify.');
}

main();
