import { NextRequest, NextResponse } from 'next/server';
import { sql, pgTimestampToIso } from '@/lib/db';
import { recordProposalEvent } from '@/lib/proposalLog';

// Never statically cache — this always needs to read live data, and Next.js
// GET route handlers are cached by default unless told otherwise.
export const dynamic = 'force-dynamic';

const REASON_MAX_LENGTH = 500;

export async function POST(req: NextRequest) {
  try {
    const { studentId, reason } = await req.json();

    if (!Number.isInteger(studentId)) {
      return NextResponse.json({ error: 'studentId must be an integer' }, { status: 400 });
    }
    const [student] = await sql`SELECT id FROM students WHERE id = ${studentId}`;
    if (!student) {
      return NextResponse.json({ error: 'Unknown studentId' }, { status: 400 });
    }
    const safeReason = typeof reason === 'string' ? reason.slice(0, REASON_MAX_LENGTH) : null;

    const [row] = await sql`
      UPDATE students
      SET needs_followup = true, needs_followup_at = now(), needs_followup_reason = ${safeReason}
      WHERE id = ${studentId}
      RETURNING needs_followup_at
    `;

    recordProposalEvent({
      studentId,
      proposalType: 'followup',
      detail: `reason="${safeReason ?? ''}"`,
      outcome: 'confirmed',
    });

    return NextResponse.json({
      studentId,
      needsFollowup: true,
      needsFollowupAt: pgTimestampToIso(row.needs_followup_at),
      needsFollowupReason: safeReason,
    });
  } catch (err) {
    console.error('POST /api/followups failed', err);
    return NextResponse.json({ error: 'Failed to record follow-up flag' }, { status: 500 });
  }
}
