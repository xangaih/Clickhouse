import { NextRequest, NextResponse } from 'next/server';
import { getLatestSession, getSessionEvents } from '@/lib/queries';

// Never statically cache — this always needs to read live data, and Next.js
// GET route handlers are cached by default unless told otherwise.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const studentId = Number(params.id);
    const sessionId = await getLatestSession(studentId);
    if (!sessionId) {
      return NextResponse.json({ error: 'No sessions found' }, { status: 404 });
    }
    const events = await getSessionEvents(sessionId);
    return NextResponse.json({ sessionId, events });
  } catch (err) {
    console.error('GET /api/students/[id]/session failed', err);
    return NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
  }
}
