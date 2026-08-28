import { NextResponse } from 'next/server';
import { getClassDailyAverage } from '@/lib/queries';

export async function GET() {
  try {
    const data = await getClassDailyAverage();
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/class-trend failed', err);
    return NextResponse.json({ error: 'Failed to load class trend' }, { status: 500 });
  }
}
