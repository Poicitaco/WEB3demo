import { NextResponse } from 'next/server';
import { issueCsrf } from '@/lib/csrf';

export const runtime = 'nodejs';

export async function GET() {
  const token = await issueCsrf();
  return NextResponse.json({ csrf: token });
}

