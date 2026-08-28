import { NextResponse } from 'next/server';
import { getBookEffectiveness } from '@/lib/queries';

export async function GET() {
  try {
    const books = await getBookEffectiveness();
    return NextResponse.json(books);
  } catch (err) {
    console.error('GET /api/library failed', err);
    return NextResponse.json({ error: 'Failed to load library' }, { status: 500 });
  }
}
