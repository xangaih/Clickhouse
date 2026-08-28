import { NextRequest, NextResponse } from 'next/server';
import { recordProposalEvent } from '@/lib/proposalLog';

// Never statically cache — this always needs to read live data, and Next.js
// GET route handlers are cached by default unless told otherwise.
export const dynamic = 'force-dynamic';

// Logging only — a dismissed proposal must never touch the database. This endpoint
// exists purely so the human-in-the-loop pattern is visible in server logs for the
// demo, not because dismissal needs to be persisted anywhere.
export async function POST(req: NextRequest) {
  try {
    const { studentId, proposalType, detail } = await req.json();
    if (!Number.isInteger(studentId) || typeof proposalType !== 'string') {
      return NextResponse.json({ error: 'studentId and proposalType are required' }, { status: 400 });
    }
    recordProposalEvent({
      studentId,
      proposalType,
      detail: typeof detail === 'string' ? detail.slice(0, 500) : '',
      outcome: 'dismissed',
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/proposals/dismiss failed', err);
    return NextResponse.json({ error: 'Failed to log dismissal' }, { status: 500 });
  }
}
