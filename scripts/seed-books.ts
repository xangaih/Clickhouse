import { sql } from '../lib/db';
import { clickhouse } from '../lib/clickhouse';
import { tagsToVector } from '../lib/embeddings';

const BOOKS = [
  { title: 'The Tiny Dinosaur', author: 'A. Cole', level: 1.2, tags: ['dinosaurs', 'animals'] },
  { title: 'My First Trip to Space', author: 'R. Byun', level: 1.5, tags: ['space'] },
  { title: 'Goalie Cat', author: 'M. Ford', level: 1.3, tags: ['sports', 'animals'] },
  { title: 'The Mystery of the Missing Sock', author: 'J. Lin', level: 1.8, tags: ['mystery', 'friendship'] },
  { title: 'Big Rex, Little Rex', author: 'A. Cole', level: 2.0, tags: ['dinosaurs'] },
  { title: 'Stars Above My House', author: 'R. Byun', level: 2.1, tags: ['space', 'science'] },
  { title: 'The New Kid at Recess', author: 'S. Ade', level: 2.2, tags: ['friendship'] },
  { title: 'Team Comet', author: 'M. Ford', level: 2.4, tags: ['sports', 'friendship'] },
  { title: 'The Dragon Who Couldn’t Fly', author: 'T. Okoye', level: 2.5, tags: ['fantasy'] },
  { title: 'Detective Whiskers', author: 'J. Lin', level: 2.6, tags: ['mystery', 'animals'] },
  { title: 'Bones in the Backyard', author: 'A. Cole', level: 2.8, tags: ['dinosaurs', 'science'] },
  { title: 'The Rocket Club', author: 'R. Byun', level: 3.0, tags: ['space', 'friendship'] },
  { title: 'Underdogs United', author: 'M. Ford', level: 3.1, tags: ['sports'] },
  { title: 'The Missing Map', author: 'J. Lin', level: 3.2, tags: ['mystery'] },
  { title: 'Wildlife Detectives', author: 'S. Ade', level: 3.3, tags: ['animals', 'science'] },
  { title: 'The Last Dragon Egg', author: 'T. Okoye', level: 3.5, tags: ['fantasy'] },
  { title: 'Moon Base Zero', author: 'R. Byun', level: 3.7, tags: ['space', 'science'] },
  { title: 'Fossil Hunters', author: 'A. Cole', level: 3.8, tags: ['dinosaurs', 'mystery'] },
  { title: 'The Championship Season', author: 'M. Ford', level: 4.0, tags: ['sports', 'friendship'] },
  { title: 'Secrets of the Sunken Ship', author: 'J. Lin', level: 4.2, tags: ['mystery'] },
  { title: 'Realm of the Silver Wolves', author: 'T. Okoye', level: 4.4, tags: ['fantasy', 'animals'] },
  { title: 'The Comet That Changed Everything', author: 'R. Byun', level: 4.6, tags: ['space', 'science'] },
  { title: 'A Field Guide to Everything Wild', author: 'S. Ade', level: 4.8, tags: ['animals', 'science'] },
  { title: 'The Bracket', author: 'M. Ford', level: 5.0, tags: ['sports', 'mystery'] },
];

async function seedBooks() {
  const insertedIds: number[] = [];
  for (const b of BOOKS) {
    const [row] = await sql`
      INSERT INTO books (title, author, reading_level, topic_tags)
      VALUES (${b.title}, ${b.author}, ${b.level}, ${b.tags})
      RETURNING id
    `;
    insertedIds.push(row.id);
  }

  const chRows = BOOKS.map((b, i) => ({
    book_id: insertedIds[i],
    title: b.title,
    reading_level: b.level,
    topic_tags: b.tags,
    embedding: tagsToVector(b.tags),
  }));
  await clickhouse.insert({ table: 'book_embeddings', values: chRows, format: 'JSONEachRow' });

  console.log(`Seeded ${insertedIds.length} books into Postgres + ClickHouse.`);
  return insertedIds;
}

if (require.main === module) {
  seedBooks();
}

export { seedBooks, BOOKS };
