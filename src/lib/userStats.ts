import { cloudRecordAnswer } from '@/lib/cloud';

export type Bucket = { a: number; c: number };
export type Stats = { attempted: number; correct: number; byDay: Record<string, Bucket>; bySubject: Record<string, Bucket> };

const key = (uid: string) => `sj_stats_${uid}`;
const today = () => new Date().toLocaleDateString('en-CA');
export const emptyStats = (): Stats => ({ attempted: 0, correct: 0, byDay: {}, bySubject: {} });

export function getStats(uid: string): Stats {
  try {
    return { ...emptyStats(), ...JSON.parse(localStorage.getItem(key(uid)) || '{}') };
  } catch {
    return emptyStats();
  }
}

// Call from the practice page every time a student answers an MCQ
export function recordAttempt(uid: string, correct: boolean, subject = 'General') {
  const s = getStats(uid);
  const add = (b: Bucket | undefined): Bucket => ({ a: (b?.a || 0) + 1, c: (b?.c || 0) + (correct ? 1 : 0) });
  s.attempted += 1;
  if (correct) s.correct += 1;
  s.byDay[today()] = add(s.byDay[today()]);
  s.bySubject[subject] = add(s.bySubject[subject]);
  try {
    localStorage.setItem(key(uid), JSON.stringify(s));
  } catch {
    // storage unavailable
  }
  void cloudRecordAnswer(correct, subject).catch(() => undefined); // the database keeps the real totals
}

export function resetStats(uid: string) {
  try {
    localStorage.removeItem(key(uid));
  } catch {
    // storage unavailable
  }
}

export function streak(s: Stats): number {
  let n = 0;
  const d = new Date();
  if (!s.byDay[d.toLocaleDateString('en-CA')]) d.setDate(d.getDate() - 1);
  while (s.byDay[d.toLocaleDateString('en-CA')]?.a) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
