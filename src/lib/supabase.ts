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
  const redirectTarget = redirectTo || `${origin}/admin`;

  if (!client) {
    // Demo mode: simulate Google sign in for immediate local test
    if (typeof window !== 'undefined') {
      const demoUser = {
        id: 'u1',
        name: 'Ayesha Khan (Google)',
        email: 'admin@sawaljar.com',
        role: 'admin',
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
    if (typeof window !== 'undefined') {
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

  const { data: { session } } = await client.auth.getSession();
  if (!session?.user) return null;

  // Fetch profile for role and ban status
  const { data: profile } = await client
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  return {
    id: session.user.id,
    email: session.user.email,
    name: profile?.name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
    role: profile?.role || 'user',
    status: profile?.status || 'active',
    avatar_url: profile?.avatar_url || session.user.user_metadata?.avatar_url,
  };
}
