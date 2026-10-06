import { loadAppState, saveAppState } from '@/lib/store';
import type { AppState } from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase';

export type Status = 'active' | 'suspended' | 'banned';
type Row = { id: string; name: string; email: string; status: string; last?: number; [k: string]: unknown };
const rows = (st: AppState) => st.users as unknown as Row[];

// Read-only check, used when another tab changes the data
export function getAccountStatus(email?: string): Status {
  if (!email || isSupabaseConfigured) return 'active'; // with Supabase the status comes from the profile
  const st = loadAppState();
  const u = st ? rows(st).find((x) => x.email?.toLowerCase() === email.toLowerCase()) : undefined;
  return u?.status === 'banned' || u?.status === 'suspended' ? u.status : 'active';
}

// Called once after sign-in: adds the student to the admin Users list if new, and returns their status
export function syncAccount(u: { id?: string; email?: string; name?: string }): Status {
  if (isSupabaseConfigured) return 'active'; // the database creates the profile and keeps the status
  const st = loadAppState();
  if (!st || !u.email) return 'active';
  const email = u.email.toLowerCase();
  const list = rows(st);
  const now = Date.now();
  const found = list.find((x) => x.email?.toLowerCase() === email);
  if (found) found.last = now;
  else list.push({ id: u.id || email, name: u.name || email.split('@')[0], email, course: '', status: 'active', solved: 0, acc: 0, streak: 0, last: now, acts: [['Signed up', now]] });
  saveAppState({ ...st, users: list as unknown as AppState['users'] });
  return found?.status === 'banned' || found?.status === 'suspended' ? found.status : 'active';
}

// Called after every answered MCQ so the leaderboard reflects real practice
export function recordSolve(email: string | undefined, correct: boolean, streakDays: number) {
  if (!email || isSupabaseConfigured) return; // the database keeps these numbers (record_answer)
  const st = loadAppState();
  const list = rows(st);
  const u = list.find((x) => x.email?.toLowerCase() === email.toLowerCase());
  if (!u) return;
  const solved = Number(u.solved) || 0;
  const right = Math.round(((Number(u.acc) || 0) / 100) * solved) + (correct ? 1 : 0);
  u.solved = solved + 1;
  u.acc = Math.round((right / (solved + 1)) * 100);
  u.streak = streakDays;
  u.last = Date.now();
  saveAppState({ ...st, users: list as unknown as AppState['users'] });
}
