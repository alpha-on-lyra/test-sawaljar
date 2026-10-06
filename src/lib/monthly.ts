import type { AppState, MCQ } from '@/lib/types';

export type MonthlyTest = {
  id: string;
  name: string;
  course: string;
  parts: { subject: string; count: number }[];
  minutes: number; // 0 = untimed
  live: boolean;
  created: number;
};

type SetLite = { course: string; subject?: string; ids: string[] };
const shuffle = <T,>(a: T[]): T[] => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

// How many MCQs a subject has in a course
export function availableFor(state: AppState, course: string, subject: string): number {
  const ex = (state as unknown as { extras?: { mcqSets?: SetLite[] } }).extras;
  return (ex?.mcqSets || []).filter((s) => s.course === course && s.subject === subject).reduce((n, s) => n + s.ids.length, 0);
}

// Use in the practice page: /practice?monthly=<id>. Picks random MCQs per subject, grouped by subject.
export function buildMonthly(state: AppState, test: MonthlyTest): MCQ[] {
  const ex = (state as unknown as { extras?: { mcqSets?: SetLite[] } }).extras;
  const sets = (ex?.mcqSets || []).filter((s) => s.course === test.course);
  return test.parts.flatMap((p) => {
    const ids = new Set(sets.filter((s) => s.subject === p.subject).flatMap((s) => s.ids));
    return shuffle(state.mcqs.filter((m) => ids.has(m.id))).slice(0, p.count);
  });
}
