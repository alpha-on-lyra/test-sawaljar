import { cloudRecordBatch, BatchItem } from '@/lib/cloud';
import { getCurrentUser } from '@/lib/supabase';

// While a student solves, NOTHING is sent to Supabase. Answers wait in memory (and in a small local copy, so a closed
// tab or crash does not lose them). When the test is finished, everything goes in ONE request.
// If a test is abandoned, the leftover answers are sent the next time the student opens the site.
type Pend = { kind: 'mcq' | 'ratta'; course: string; items: BatchItem[]; views: string[]; logs: { e: string; t: string }[] };
const PREFIX = 'sj_pend_';
const live = new Set<string>(); // runs that are still being solved on this page
const blank = (kind: Pend['kind'], course: string): Pend => ({ kind, course, items: [], views: [], logs: [] });
const filled = (p: Pend) => p.items.length > 0 || p.views.length > 0 || p.logs.length > 0;
const send = (p: Pend) => cloudRecordBatch(p.kind === 'mcq', p.items, p.views, p.course, p.logs);

export class AnswerBatcher {
  private id: string;
  private p: Pend;
  constructor(kind: Pend['kind'], course = '') {
    this.id = Math.random().toString(36).slice(2, 10);
    this.p = blank(kind, course);
    live.add(this.id);
  }
  private save() {
    try {
      if (filled(this.p)) localStorage.setItem(PREFIX + this.id, JSON.stringify(this.p));
      else localStorage.removeItem(PREFIX + this.id);
    } catch {
      // storage unavailable: answers stay in memory
    }
  }
  add(i: BatchItem) {
    this.p.items.push(i);
    this.save();
  }
  view(setId: string) {
    if (!this.p.views.includes(setId)) this.p.views.push(setId);
    this.save();
  }
  log(e: string, t: string) {
    if (this.p.logs.length < 20) this.p.logs.push({ e, t });
    this.save();
  }
  // The only moment answers are sent: when the student finishes
  async flush() {
    if (!filled(this.p)) return;
    const out = this.p;
    this.p = blank(out.kind, out.course);
    this.save();
    try {
      await send(out);
    } catch {
      this.p = { ...out, items: [...out.items, ...this.p.items], views: [...out.views, ...this.p.views], logs: [...out.logs, ...this.p.logs] };
      this.save(); // kept for the next visit
    }
  }
  release() {
    live.delete(this.id);
  }
}

let recovering = false;
// Sends answers left over from tests that were never finished (closed tab, lost connection)
export async function recoverPending() {
  if (recovering || typeof window === 'undefined') return;
  recovering = true;
  try {
    if (!(await getCurrentUser())) return;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      if (k.startsWith(PREFIX) && !live.has(k.slice(PREFIX.length))) keys.push(k);
    }
    for (const k of keys) {
      try {
        const p = JSON.parse(localStorage.getItem(k) || '{}') as Pend;
        if (p && Array.isArray(p.items) && filled(p)) await send(p);
        localStorage.removeItem(k);
      } catch {
        // leave it for the next visit
      }
    }
  } finally {
    recovering = false;
  }
}
