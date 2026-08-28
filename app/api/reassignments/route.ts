import { NextRequest, NextResponse } from 'next/server';
import { sql, pgTimestampToIso } from '@/lib/db';
import { recordProposalEvent } from '@/lib/proposalLog';

export async function POST(req: NextRequest) {
  try {
    const { studentId, bookId } = await req.json();

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

    // A reassignment is a new assignments row, not an update — this is what makes
    // getAssignmentHistory (used by the chat agent's get_reading_history tool)
    // actually have more than one entry per student over time.
    const [row] = await sql`
      INSERT INTO assignments (student_id, book_id)
      VALUES (${studentId}, ${bookId})
      RETURNING id, student_id, book_id, assigned_at
    `;

    recordProposalEvent({
      studentId,
      proposalType: 'reassignment',
      detail: `newBook=${bookId}`,
      outcome: 'confirmed',
    });

    return NextResponse.json({ ...row, assigned_at: pgTimestampToIso(row.assigned_at) });
  } catch (err) {
    console.error('POST /api/reassignments failed', err);
    return NextResponse.json({ error: 'Failed to record reassignment' }, { status: 500 });
  }
}
