import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const course = searchParams.get('course');
  const sanitize = searchParams.get('secure') === 'true';

  const client = getSupabase();
  if (!client) {
    return NextResponse.json({
      message: 'Supabase offline fallback. Please use client local store.',
      data: [],
    });
  }

  let query = client.from('mcqs').select('*');
  if (course) {
    query = query.eq('course', course);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Content Protection: strip answer key if in exam mode
  const formatted = sanitize
    ? (data || []).map((m: any) => ({
        id: m.id,
        q: m.question,
        o: m.options,
        topic: m.topic,
        course: m.course,
        src: m.source,
      }))
    : (data || []).map((m: any) => ({
        id: m.id,
        q: m.question,
        o: m.options,
        a: m.answer_index,
        topic: m.topic,
        course: m.course,
        src: m.source,
        exp: m.explanation,
      }));

  return NextResponse.json({ data: formatted });
}
