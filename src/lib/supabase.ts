import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder') &&
  supabaseUrl.startsWith('https://')
);

let cachedClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    });
  }
  return cachedClient;
}

/**
 * Trigger "Continue with Google" OAuth sign-in
 */
export async function signInWithGoogle(redirectTo?: string) {
  const client = getSupabase();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const redirectTarget = redirectTo || `${origin}/dashboard`;

  if (!client) {
    // Demo sign-in exists only on a developer machine. A live site without Supabase keys must never sign anyone in.
    if (process.env.NODE_ENV === 'production') return { error: new Error('Sign-in is not configured') };
    if (typeof window !== 'undefined') {
      const demoUser = {
        id: 'u1',
        name: 'Ayesha Khan (Google)',
        email: 'ayesha.khan@student.edu.pk',
        role: 'user',
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face'
      };
      localStorage.setItem('sj_demo_auth', JSON.stringify(demoUser));
      window.location.href = redirectTarget;
    }
    return { error: null };
  }

  return await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTarget,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      }
    }
  });
}

/**
 * Sign out current session
 */
export async function signOut() {
  const client = getSupabase();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('sj_demo_auth');
  }
  if (!client) {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    return { error: null };
  }
  const result = await client.auth.signOut();
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
  return result;
}

/**
 * Get current session user
 */
export async function getCurrentUser() {
  const client = getSupabase();
  if (!client) {
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      const demo = localStorage.getItem('sj_demo_auth');
      if (demo) {
        try {
          return JSON.parse(demo);
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  try {
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    if (sessionError || !session?.user) return null;

    // Fetch profile for role and ban status with maybeSingle to avoid 406/error if profile not yet created
    const { data: profile } = await client
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    return {
      id: session.user.id,
      email: session.user.email,
      name: profile?.name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0],
      role: profile?.role || 'user',
      status: profile?.status || 'active',
      avatar_url: profile?.avatar_url || session.user.user_metadata?.avatar_url,
    };
  } catch (err) {
    console.error('Error fetching Supabase session/user:', err);
    return null;
  }
}

/**
 * Persist question report directly to Supabase if configured
 */
export async function submitReportToSupabase(report: {
  mcq: string;
  kind?: 'MCQ' | 'Ratta';
  user?: string;
  reason: string;
}) {
  const client = getSupabase();
  if (!client) return;
  try {
    const currentUser = await getCurrentUser();
    await client.from('reports').insert({
      mcq_text: report.mcq,
      kind: report.kind || 'MCQ',
      user_name: report.user || currentUser?.name || 'Anonymous',
      user_id: currentUser?.id || null,
      reason: report.reason,
      status: 'pending',
    });
  } catch (err) {
    console.warn('Failed to sync report to Supabase:', err);
  }
}

/**
 * Persist anti-cheat violation directly to Supabase if configured
 */
export async function logAntiCheatToSupabase(log: {
  eventType: string;
  testTitle?: string;
  details?: Record<string, unknown>;
  userEmail?: string;
}) {
  const client = getSupabase();
  if (!client) return;
  try {
    const currentUser = await getCurrentUser();
    await client.from('anti_cheat_logs').insert({
      event_type: log.eventType,
      test_title: log.testTitle || 'Practice Session',
      details: log.details || {},
      user_email: log.userEmail || currentUser?.email || 'Anonymous',
      user_id: currentUser?.id || null,
    });
  } catch (err) {
    console.warn('Failed to sync anti-cheat log to Supabase:', err);
  }
}
