CREATE TABLE reading_events
(
    event_id      UUID DEFAULT generateUUIDv4(),
    student_id    UInt32,
    session_id    UUID,
    book_id       UInt32,
    ts            DateTime64(3),
    word_index    UInt32,
    is_correct    UInt8,
    hesitation_ms UInt32
)
ENGINE = MergeTree
ORDER BY (student_id, ts)
PARTITION BY toYYYYMM(ts);

-- DEPRECATED — no longer written to or read from as of the ClickHouse-managed Postgres
-- CDC integration ("readpulse-cdc", via PeerDB). CDC replicates the real Postgres tables
-- directly into `default.public_students` / `public_books` / `public_assignments` /
-- `public_interventions` (ReplacingMergeTree, versioned by `_peerdb_version`, soft-deletes
-- via `_peerdb_is_deleted`) — that's what app code reads now (see lib/queries.ts). This
-- table is left in place, unwritten, rather than dropped, in case anything still expects
-- it to exist; scripts/sync-dimensions.ts (which used to populate it) is similarly kept
-- but no longer called from scripts/run-all-seed.ts. Two differences worth knowing if you
-- ever need this table again: (1) `assigned_book_id` here was synthetic — denormalized at
-- sync time from an assignments join — and has no equivalent in CDC's public_students,
-- since it was never a real Postgres column; book-effectiveness queries now derive
-- "current book" from public_assignments (latest assigned_at per student) instead.
-- (2) CDC's replicated columns are Nullable throughout (mirroring Postgres nullability),
-- where this table's are not.
CREATE TABLE students_dim
(
    student_id           UInt32,
    name                 String,
    class_id             UInt32,
    reading_level_start  Float32,
    interests            Array(String),
    assigned_book_id     UInt32,   -- denormalized from Postgres assignments, for book-effectiveness joins
    updated_at           DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY student_id;

-- CORRECT aggregating materialized view. A plain `avg()` GROUP BY in a materialized
-- view only aggregates WITHIN each insert batch, not across a student's full history.
-- Use AggregatingMergeTree + -State combinators, always read through -Merge.
CREATE TABLE student_daily_agg
(
    student_id       UInt32,
    day              Date,
    words_state      AggregateFunction(count),
    accuracy_state   AggregateFunction(avg, UInt8),
    hesitation_state AggregateFunction(avg, UInt32)
)
ENGINE = AggregatingMergeTree
ORDER BY (student_id, day);

CREATE MATERIALIZED VIEW mv_student_daily_agg TO student_daily_agg AS
SELECT
    student_id,
    toDate(ts) AS day,
    countState()             AS words_state,
    avgState(is_correct)     AS accuracy_state,
    avgState(hesitation_ms)  AS hesitation_state
FROM reading_events
GROUP BY student_id, day;

-- book_id here MUST match the SERIAL ids generated when books are inserted into
-- Postgres in section 11, since assignments reference the same book_id.
CREATE TABLE book_embeddings
(
    book_id        UInt32,
    title          String,
    reading_level  Float32,
    topic_tags     Array(String),
    embedding      Array(Float32)   -- length 8, matches TOPIC_VOCAB in lib/embeddings.ts
)
ENGINE = MergeTree
ORDER BY book_id;
