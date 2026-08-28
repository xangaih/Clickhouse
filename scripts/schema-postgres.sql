CREATE TABLE teachers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE
);

CREATE TABLE classes (
  id SERIAL PRIMARY KEY,
  teacher_id INT REFERENCES teachers(id),
  name TEXT,
  grade_level INT
);

CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  class_id INT REFERENCES classes(id),
  name TEXT,
  reading_level_start FLOAT,   -- 1.0 (easiest) to 5.0 (hardest); same scale as books.reading_level
  interests TEXT[],            -- values drawn from the fixed TOPIC_VOCAB in lib/embeddings.ts
  trajectory TEXT,             -- 'steady' | 'improving' | 'struggling' | 'quiet_decline' | 'recovered'
                                -- — stored so the generator and any debugging can look up what each student "is"
  needs_followup BOOLEAN DEFAULT false,   -- set by a confirmed propose_followup_flag chat proposal
  needs_followup_at TIMESTAMP,
  needs_followup_reason TEXT
);

CREATE TABLE books (
  id SERIAL PRIMARY KEY,
  title TEXT,
  author TEXT,
  reading_level FLOAT,
  topic_tags TEXT[]
);

CREATE TABLE assignments (
  id SERIAL PRIMARY KEY,
  student_id INT REFERENCES students(id),
  book_id INT REFERENCES books(id),
  assigned_at TIMESTAMP DEFAULT now()
);

CREATE TABLE interventions (
  id SERIAL PRIMARY KEY,
  student_id INT REFERENCES students(id),
  book_id INT REFERENCES books(id),
  note TEXT,
  created_at TIMESTAMP DEFAULT now()
);
