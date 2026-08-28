import { NextResponse } from 'next/server';
import { getBookEffectiveness } from '@/lib/queries';

// Never statically cache — this always needs to read live data, and Next.js
// GET route handlers are cached by default unless told otherwise.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const books = await getBookEffectiveness();
    return NextResponse.json(books);
  } catch (err) {
    console.error('GET /api/library failed', err);
    return NextResponse.json({ error: 'Failed to load library' }, { status: 500 });
  }
}
