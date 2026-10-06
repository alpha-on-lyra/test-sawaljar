import type { AppState } from '@/lib/types';
import type { MonthlyTest } from '@/lib/monthly';

export type SetLite = { id: string; name: string; course: string; subject?: string; topic: string; ids: string[]; yt?: { title: string; url: string }[]; pdf?: { title: string; url: string }[] };
export type Extras = {
  mcq?: { shuffleQ?: boolean; shuffleO?: boolean; showExp?: boolean; retake?: boolean; negMark?: boolean; perSession?: number; secPerQ?: number };
  ratta?: { shuffle?: boolean; selfCheck?: boolean; perSession?: number };
  mcqSets?: SetLite[];
  rattaSets?: SetLite[];
  monthly?: MonthlyTest[];
  offline?: Record<string, boolean>;
};
type OldQuiz = { shuffleQ?: boolean; shuffleO?: boolean; expl?: boolean; neg?: boolean; retake?: boolean; rself?: boolean; qn?: number; qt?: number; anim?: string };

export const extrasOf = (st: AppState): Extras => ((st as unknown as { extras?: Extras }).extras || {}) as Extras;
const oldQuiz = (st: AppState): OldQuiz => ((st as unknown as { quiz?: OldQuiz }).quiz || {}) as OldQuiz;
export const isHidden = (x: unknown) => !!(x as { hidden?: boolean }).hidden;

export function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

// Admin "Practice options" win; the older quiz settings are the fallback
export function mcqOpts(st: AppState) {
  const e = extrasOf(st).mcq || {};
  const q = oldQuiz(st);
  return {
    shuffleQ: e.shuffleQ ?? q.shuffleQ ?? true,
    shuffleO: e.shuffleO ?? q.shuffleO ?? true,
    showExp: e.showExp ?? q.expl ?? true,
    retake: e.retake ?? q.retake ?? true,
    negMark: e.negMark ?? q.neg ?? false,
    perSession: e.perSession ?? q.qn ?? 20,
    secPerQ: e.secPerQ ?? q.qt ?? 0,
  };
}

export function rattaOpts(st: AppState) {
  const e = extrasOf(st).ratta || {};
  const q = oldQuiz(st);
  return { shuffle: e.shuffle ?? true, selfCheck: e.selfCheck ?? q.rself ?? true, perSession: e.perSession ?? q.qn ?? 20, anim: q.anim || 'fade' };
}
