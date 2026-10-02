import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventType, testTitle, details, userEmail } = body;

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '127.0.0.1';

    const client = getSupabase();
    if (client) {
      await client.from('anti_cheat_logs').insert({
        event_type: eventType,
        test_title: testTitle || 'Practice Session',
        details: details || {},
        user_email: userEmail || 'Anonymous',
        ip_address: ip,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to log event' },
      { status: 500 }
    );
  }
}
