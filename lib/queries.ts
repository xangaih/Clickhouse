import { chQuery } from './clickhouse';
import { sql } from './db';
import type { BookCandidate } from './types';

export async function getDailyAccuracy(studentId: number) {
  return chQuery<{ day: string; accuracy: number }>(
    `SELECT day, avgMerge(accuracy_state) AS accuracy
     FROM student_daily_agg
     WHERE student_id = {studentId:UInt32}
     GROUP BY student_id, day
     ORDER BY day`,
    { studentId }
  );
}

export async function getDecliningStudents() {
  return chQuery<{
    student_id: number;
    latest_day: string;
    recent_accuracy: number;
    baseline_accuracy: number;
  }>(`
    WITH daily AS (
        SELECT student_id, day, avgMerge(accuracy_state) AS accuracy
        FROM student_daily_agg
        GROUP BY student_id, day
    ),
    windows AS (
        SELECT
            student_id, day, accuracy,
            -- Non-overlapping windows: baseline looks at an earlier period (8-20
            -- days back), recent looks at the last week. The earlier 7d/14d
            -- design used two windows that both ended at the current row, so the
            -- "baseline" absorbed the same recent days as "recent" — as a
            -- student declined, baseline dropped with it and muted the signal.
            avg(accuracy) OVER (
                PARTITION BY student_id ORDER BY day
                ROWS BETWEEN 20 PRECEDING AND 8 PRECEDING
            ) AS rolling_baseline,
            avg(accuracy) OVER (
                PARTITION BY student_id ORDER BY day
                ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ) AS rolling_7d
        FROM daily
    )
    SELECT
        student_id,
        max(day) AS latest_day,
        argMax(rolling_7d, day)       AS recent_accuracy,
        argMax(rolling_baseline, day) AS baseline_accuracy
    FROM windows
    GROUP BY student_id
    HAVING recent_accuracy < baseline_accuracy * 0.92
       AND recent_accuracy > 0.70
    ORDER BY (baseline_accuracy - recent_accuracy) DESC
  `);
}

// Re-anchors the same decline check to `daysAgo` days before the latest data,
// by truncating the daily series before windowing — lets the weekly digest
// diff "flagged now" vs "flagged a week ago" without a stored history table.
export async function getDecliningStudentsAsOf(daysAgo: number) {
  return chQuery<{
    student_id: number;
    recent_accuracy: number;
    baseline_accuracy: number;
  }>(
    `
    WITH bounds AS (
        SELECT max(day) AS latest_day FROM student_daily_agg
    ),
    daily AS (
        SELECT student_id, day, avgMerge(accuracy_state) AS accuracy
        FROM student_daily_agg
        WHERE day <= (SELECT latest_day FROM bounds) - {daysAgo:UInt32}
        GROUP BY student_id, day
    ),
    windows AS (
        SELECT
            student_id, day, accuracy,
            avg(accuracy) OVER (
                PARTITION BY student_id ORDER BY day
                ROWS BETWEEN 20 PRECEDING AND 8 PRECEDING
            ) AS rolling_baseline,
            avg(accuracy) OVER (
                PARTITION BY student_id ORDER BY day
                ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ) AS rolling_7d
        FROM daily
    )
    SELECT
        student_id,
        argMax(rolling_7d, day)       AS recent_accuracy,
        argMax(rolling_baseline, day) AS baseline_accuracy
    FROM windows
    GROUP BY student_id
    HAVING recent_accuracy < baseline_accuracy * 0.92
       AND recent_accuracy > 0.70
    ORDER BY (baseline_accuracy - recent_accuracy) DESC
  `,
    { daysAgo }
  );
}

export async function getLatestSession(studentId: number): Promise<string | null> {
  const rows = await chQuery<{ session_id: string }>(
    `SELECT session_id
     FROM reading_events
     WHERE student_id = {studentId:UInt32}
     ORDER BY ts DESC
     LIMIT 1`,
    { studentId }
  );
  return rows[0]?.session_id ?? null;
}

export async function getSessionEvents(sessionId: string) {
  return chQuery<{ word_index: number; is_correct: number; hesitation_ms: number }>(
    `SELECT word_index, is_correct, hesitation_ms
     FROM reading_events
     WHERE session_id = {sessionId:UUID}
     ORDER BY word_index`,
    { sessionId }
  );
}

// Postgres, not ClickHouse — assignment history lives with the roster data, not the
// event stream. Lives here (rather than inline in a route) so the chat tool executor
// and any future caller share one implementation.
export async function getAssignmentHistory(studentId: number) {
  return sql`
    SELECT a.assigned_at, b.id AS book_id, b.title, b.reading_level, b.topic_tags
    FROM assignments a
    JOIN books b ON b.id = a.book_id
    WHERE a.student_id = ${studentId}
    ORDER BY a.assigned_at ASC
  `;
}

export async function getRecentSessions(studentId: number, limit: number) {
  return chQuery<{ session_id: string; session_date: string; word_count: number; accuracy: number }>(
    `SELECT session_id, min(ts) AS session_date, count() AS word_count, avg(is_correct) AS accuracy
     FROM reading_events
     WHERE student_id = {studentId:UInt32}
     GROUP BY session_id
     ORDER BY session_date DESC
     LIMIT {limit:UInt32}`,
    { studentId, limit }
  );
}

// Engagement (how often a student reads) as a signal separate from accuracy — a
// student can be reading less often while their accuracy on the days they DO read
// stays fine, which the decline-detection query would never catch. Compares the
// average days-between-sessions in the last 2 weeks vs the 2 weeks before that.
//
// lagInFrame() defaults to the ClickHouse Date epoch (1970-01-01) for a partition's
// first row when no default is given, not NULL — dateDiff against that produces a
// ~20,000-day gap that silently blows up an average if not handled. Passing the
// row's own session_date as the default makes the first session's gap a clean 0,
// filtered out below by `gap_days > 0`.
const ENGAGEMENT_GAPS_CTE = `
    WITH sessions AS (
        SELECT student_id, session_id, min(ts) AS session_ts
        FROM reading_events
        GROUP BY student_id, session_id
    ),
    daily_sessions AS (
        SELECT DISTINCT student_id, toDate(session_ts) AS session_date
        FROM sessions
    ),
    bounds AS (
        SELECT max(session_date) AS latest_date FROM daily_sessions
    ),
    gaps AS (
        SELECT
            student_id,
            session_date,
            dateDiff(
                'day',
                lagInFrame(session_date, 1, session_date) OVER (PARTITION BY student_id ORDER BY session_date),
                session_date
            ) AS gap_days
        FROM daily_sessions
    )
`;

export async function getEngagementDrop() {
  return chQuery<{
    student_id: number;
    recent_avg_gap: number;
    prior_avg_gap: number;
  }>(`
    ${ENGAGEMENT_GAPS_CTE}
    SELECT
        student_id,
        avgIf(gap_days, session_date > (SELECT latest_date FROM bounds) - 14) AS recent_avg_gap,
        avgIf(
            gap_days,
            session_date <= (SELECT latest_date FROM bounds) - 14
            AND session_date > (SELECT latest_date FROM bounds) - 28
        ) AS prior_avg_gap
    FROM gaps
    WHERE gap_days > 0
    GROUP BY student_id
    HAVING prior_avg_gap > 0
       AND recent_avg_gap > prior_avg_gap * 1.5
    ORDER BY (recent_avg_gap - prior_avg_gap) DESC
  `);
}

// Per-student version for the chat agent's get_engagement_pattern tool — every
// session date plus the gap since the previous one, so the model can reason about
// "is she still reading regularly?" directly rather than just a flagged/not verdict.
export async function getEngagementPattern(studentId: number) {
  return chQuery<{ session_date: string; gap_days: number }>(
    `
    ${ENGAGEMENT_GAPS_CTE}
    SELECT session_date, gap_days
    FROM gaps
    WHERE student_id = {studentId:UInt32}
    ORDER BY session_date
  `,
    { studentId }
  );
}

export async function getClassDailyAverage() {
  return chQuery<{ day: string; accuracy: number }>(
    `SELECT day, avgMerge(accuracy_state) AS accuracy
     FROM student_daily_agg
     GROUP BY day
     ORDER BY day`
  );
}

export async function getBookEffectiveness() {
  return chQuery<{
    book_id: number;
    title: string;
    reading_level: number;
    topic_tags: string[];
    avg_first_week_accuracy: number;
    avg_recent_accuracy: number;
    recovery_delta: number;
  }>(`
    WITH daily AS (
        SELECT student_id, day, avgMerge(accuracy_state) AS accuracy
        FROM student_daily_agg
        GROUP BY student_id, day
    ),
    ranked AS (
        SELECT
            student_id, day, accuracy,
            row_number() OVER (PARTITION BY student_id ORDER BY day ASC)  AS rn_asc,
            row_number() OVER (PARTITION BY student_id ORDER BY day DESC) AS rn_desc
        FROM daily
    ),
    per_student AS (
        SELECT
            student_id,
            avgIf(accuracy, rn_asc <= 5)  AS first_week_accuracy,
            avgIf(accuracy, rn_desc <= 5) AS recent_week_accuracy
        FROM ranked
        GROUP BY student_id
    )
    SELECT
        be.book_id                                            AS book_id,
        any(be.title)                                         AS title,
        any(be.reading_level)                                 AS reading_level,
        any(be.topic_tags)                                    AS topic_tags,
        avg(ps.first_week_accuracy)                            AS avg_first_week_accuracy,
        avg(ps.recent_week_accuracy)                           AS avg_recent_accuracy,
        avg(ps.recent_week_accuracy) - avg(ps.first_week_accuracy) AS recovery_delta
    FROM per_student ps
    -- Current book comes from the real CDC-replicated assignments table
    -- (default.public_assignments), not the old students_dim.assigned_book_id
    -- (that was a synthetic column our own sync script denormalized in — it never
    -- existed in Postgres, so CDC has no way to replicate it). A student's
    -- "current" book is whichever assignment row has the latest assigned_at;
    -- reassignments (see /api/reassignments) insert a new row rather than
    -- updating in place, so this is also where assignment HISTORY lives now.
    --
    -- public_assignments is a PeerDB ReplacingMergeTree keyed by Postgres row id,
    -- versioned by _peerdb_version with soft-deletes via _peerdb_is_deleted — dedupe
    -- each row to its latest version and drop deleted rows before picking, per
    -- student, the row with the latest assigned_at.
    JOIN (
        SELECT student_id, argMax(book_id, assigned_at) AS book_id
        FROM (
            SELECT
                id,
                argMax(student_id, _peerdb_version) AS student_id,
                argMax(book_id, _peerdb_version)     AS book_id,
                argMax(assigned_at, _peerdb_version)  AS assigned_at,
                argMax(_peerdb_is_deleted, _peerdb_version) AS is_deleted
            FROM default.public_assignments
            GROUP BY id
        )
        WHERE is_deleted = 0
        GROUP BY student_id
    ) ca ON ca.student_id = ps.student_id
    JOIN book_embeddings be ON be.book_id = ca.book_id
    GROUP BY be.book_id
    ORDER BY recovery_delta DESC
  `);
}

export async function getBookCandidates(
  studentEmbedding: number[],
  levelMin: number,
  levelMax: number
): Promise<BookCandidate[]> {
  return chQuery<BookCandidate>(
    `SELECT book_id AS bookId, title, topic_tags AS topicTags,
            reading_level AS readingLevel,
            cosineDistance(embedding, {studentEmbedding:Array(Float32)}) AS distance
     FROM book_embeddings
     WHERE reading_level BETWEEN {levelMin:Float32} AND {levelMax:Float32}
     ORDER BY distance ASC
     LIMIT 3`,
    { studentEmbedding, levelMin, levelMax }
  );
}
