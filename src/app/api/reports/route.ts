import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mcq, kind, user, reason } = body;

    if (!mcq || !reason) {
      return NextResponse.json({ error: 'Missing required report fields' }, { status: 400 });
    }

    const client = getSupabase();
    if (client) {
      await client.from('reports').insert({
        mcq_text: mcq,
        kind: kind || 'MCQ',
        user_name: user || 'Anonymous',
        reason,
        status: 'pending',
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to submit report' },
      { status: 500 }
    );
  }
}
