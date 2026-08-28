# ReadPulse

Reading-fluency decline detection + book recommendation, built on Postgres (roster,
source of truth) + ClickHouse (event stream, rolling trend, vector search) + a Claude
agent that turns the trend into a plain-language alert for the teacher.

See the full build spec for architecture rationale, query designs, and demo script.

## Setup

1. `npm install`
2. Fill in `.env.local`:
   - `DATABASE_URL` — Postgres connection string (ClickHouse Cloud's bundled Postgres
     service, not Neon — see `lib/db.ts` for why that matters for the driver used)
   - `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD` — ClickHouse Cloud service
   - `ANTHROPIC_API_KEY` — Anthropic API key
3. Run `scripts/schema-postgres.sql` against Postgres and `scripts/schema-clickhouse.sql`
   against ClickHouse.
4. `npm run seed` — seeds students/books/assignments in Postgres and generates ~6 weeks
   of synthetic reading events per student. Dimension replication into ClickHouse is
   handled continuously by the CDC integration, not this script (see below).
5. `npm run dev` and open http://localhost:3000.

## Verification checkpoints

- `SELECT count() FROM reading_events` in ClickHouse should be in the ~100k+ range.
- `SELECT count(*) FROM assignments` in Postgres should equal the student count.
- The decline-detection query (see spec section 7) should surface Maya Chen and Diego
  Ramirez plus a plausible handful of random `quiet_decline` students.
- `/api/students` should return `flagged: true` for Maya and Diego.
- "Run agent" on the dashboard should produce alert text with no diagnostic language.

## Known simplifications

- Synthetic reading data, not real speech-to-text.
- Bag-of-tags embeddings instead of a real embedding model (removes a network dependency
  from the demo-day critical path — the vector search itself is real ClickHouse
  `cosineDistance`).
- Single class, single teacher — no auth, no multi-tenancy.

## Data pipeline

Postgres → ClickHouse dimension replication is real CDC, not a script: the
ClickHouse-managed Postgres integration ("readpulse-cdc", via PeerDB) continuously
replicates `students`, `books`, `assignments`, and `interventions` into
`default.public_students` / `public_books` / `public_assignments` /
`public_interventions`. `lib/queries.ts` reads from these directly (see
`getBookEffectiveness` for the pattern: dedupe each PeerDB `ReplacingMergeTree` row to
its latest `_peerdb_version`, drop `_peerdb_is_deleted = 1` rows, then use the data).
`scripts/sync-dimensions.ts` and the old `students_dim` table are deprecated —
kept in place (unwritten) rather than deleted; see the comments in
`scripts/schema-clickhouse.sql` and `scripts/sync-dimensions.ts` for why.
