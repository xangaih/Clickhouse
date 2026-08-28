import { NextResponse } from 'next/server';
import { getClassDailyAverage } from '@/lib/queries';

// Never statically cache — this always needs to read live data, and Next.js
// GET route handlers are cached by default unless told otherwise.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getClassDailyAverage();
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/class-trend failed', err);
    return NextResponse.json({ error: 'Failed to load class trend' }, { status: 500 });
  }
}
