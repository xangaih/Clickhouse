import { NextRequest, NextResponse } from 'next/server';
import { sql, pgTimestampToIso } from '@/lib/db';
import { recordProposalEvent } from '@/lib/proposalLog';

// Never statically cache — this always needs to read live data, and Next.js
// GET route handlers are cached by default unless told otherwise.
export const dynamic = 'force-dynamic';

const NOTE_MAX_LENGTH = 500;

export async function POST(req: NextRequest) {
  try {
    const { studentId, bookId, note } = await req.json();

    // Never trust that a confirmed proposal — or any client payload — is safe to
    // write as-is: re-validate studentId/bookId are real rows regardless of source.
    if (!Number.isInteger(studentId) || !Number.isInteger(bookId)) {
      return NextResponse.json({ error: 'studentId and bookId must be integers' }, { status: 400 });
    }
    const [student] = await sql`SELECT id FROM students WHERE id = ${studentId}`;
    if (!student) {
      return NextResponse.json({ error: 'Unknown studentId' }, { status: 400 });
    }
    const [book] = await sql`SELECT id FROM books WHERE id = ${bookId}`;
    if (!book) {
      return NextResponse.json({ error: 'Unknown bookId' }, { status: 400 });
    }
    const safeNote = typeof note === 'string' ? note.slice(0, NOTE_MAX_LENGTH) : null;

    const [row] = await sql`
      INSERT INTO interventions (student_id, book_id, note)
      VALUES (${studentId}, ${bookId}, ${safeNote})
      RETURNING id, student_id, book_id, note, created_at
    `;

    recordProposalEvent({
      studentId,
      proposalType: 'intervention',
      detail: `book=${bookId} note="${safeNote ?? ''}"`,
      outcome: 'confirmed',
    });

    return NextResponse.json({ ...row, created_at: pgTimestampToIso(row.created_at) });
  } catch (err) {
    console.error('POST /api/interventions failed', err);
    return NextResponse.json({ error: 'Failed to record intervention' }, { status: 500 });
  }
}
