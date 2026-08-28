import { sql } from '../lib/db';
import { TOPIC_VOCAB } from '../lib/embeddings';

type Trajectory = 'steady' | 'improving' | 'struggling' | 'quiet_decline' | 'recovered';

const FIRST_NAMES = ['Maya', 'Diego', 'Ava', 'Liam', 'Zoe', 'Noah', 'Priya', 'Kai', 'Ella',
  'Owen', 'Mia', 'Leo', 'Ivy', 'Sam', 'Nora', 'Theo', 'Luna', 'Eli', 'Ruby', 'Max'];
const LAST_NAMES = ['Chen', 'Ramirez', 'Patel', 'Nguyen', 'Osei', 'Novak', 'Silva', 'Kim',
  'Haddad', 'Rossi'];

function randomInterests(): string[] {
  const shuffled = [...TOPIC_VOCAB].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 1 + Math.floor(Math.random() * 2)); // 1-2 interests
}

function randomName(usedNames: Set<string>): string {
  let name: string;
  do {
    const f = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const l = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    name = `${f} ${l}`;
  } while (usedNames.has(name));
  usedNames.add(name);
  return name;
}

async function seedPostgres() {
  const [teacher] = await sql`
    INSERT INTO teachers (name, email) VALUES ('Ms. Rivera', 'rivera@example.edu') RETURNING id
  `;
  const [cls] = await sql`
    INSERT INTO classes (teacher_id, name, grade_level)
    VALUES (${teacher.id}, 'Room 12', 4) RETURNING id
  `;

  const usedNames = new Set<string>();
  const students: { id: number; trajectory: Trajectory; baseline: number }[] = [];

  // Deterministic personas — always the ones you demo. Sam Haddad is 'recovered'
  // (declines, then comes back up after an intervention) rather than a plain
  // quiet_decline, so the bulk-random quiet_decline count below is 6, not 7.
  const personas: { name: string; trajectory: Trajectory; baseline: number }[] = [
    { name: 'Maya Chen', trajectory: 'quiet_decline', baseline: 0.88 },
    { name: 'Diego Ramirez', trajectory: 'quiet_decline', baseline: 0.85 },
    { name: 'Sam Haddad', trajectory: 'recovered', baseline: 0.877 },
  ];
  usedNames.add('Maya Chen');
  usedNames.add('Diego Ramirez');
  usedNames.add('Sam Haddad');

  for (const p of personas) {
    const [row] = await sql`
      INSERT INTO students (class_id, name, reading_level_start, interests, trajectory)
      VALUES (${cls.id}, ${p.name}, ${2.5 + p.baseline * 2}, ${randomInterests()}, ${p.trajectory})
      RETURNING id
    `;
    students.push({ id: row.id, trajectory: p.trajectory, baseline: p.baseline });
  }

  // 37 bulk-random students at the target distribution: 50% steady, 20% improving,
  // 10% struggling, 20% quiet_decline (roughly — small sample so it won't be exact;
  // one quiet_decline slot moved to the deterministic Sam Haddad persona above).
  const distribution: Trajectory[] = [
    ...Array(19).fill('steady'),
    ...Array(8).fill('improving'),
    ...Array(4).fill('struggling'),
    ...Array(6).fill('quiet_decline'),
  ];

  for (const trajectory of distribution) {
    const name = randomName(usedNames);
    const baseline =
      trajectory === 'struggling' ? 0.5 + Math.random() * 0.1 :
      trajectory === 'quiet_decline' ? 0.82 + Math.random() * 0.08 :
      0.75 + Math.random() * 0.15;
    const readingLevelStart = 1.5 + baseline * 3; // maps skill baseline onto the 1-5 scale
    const [row] = await sql`
      INSERT INTO students (class_id, name, reading_level_start, interests, trajectory)
      VALUES (${cls.id}, ${name}, ${readingLevelStart}, ${randomInterests()}, ${trajectory})
      RETURNING id
    `;
    students.push({ id: row.id, trajectory, baseline });
  }

  console.log(`Seeded ${students.length} students (${personas.length} named personas + ${students.length - personas.length} random).`);
  return students;
}

if (require.main === module) {
  seedPostgres();
}

export { seedPostgres };
