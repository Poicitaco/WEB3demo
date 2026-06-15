import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    getDb().prepare('SELECT 1 AS healthy').get();
    return NextResponse.json({
      ok: true,
      database: 'ready',
      storageProvider: process.env.STORAGE_PROVIDER || 'local',
    });
  } catch {
    return NextResponse.json({ ok: false, database: 'unavailable' }, { status: 503 });
  }
}
