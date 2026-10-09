import type { AppState, MCQ, RattaCard } from '@/lib/types';
import type { MonthlyTest } from '@/lib/monthly';
import { shuffle } from '@/lib/study';

// Question files live on YOUR OWN website and are opened by link when a student presses Solve or Revise.
// Supabase never stores or sends the questions; it only keeps statistics.
type Raw = Record<string, unknown>;
export type LinkSet = { id: string; name: string; course: string; subject?: string; topic: string; url?: string; ids: string[]; count?: number };

// A short, stable code for a question (survives re-ordering the JSON file). Used for per-question statistics.
export function qkey(q: string): string {
  const s = q.trim().toLowerCase();
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const arr = (v: unknown): string[] => (Array.isArray(v) ? v : v ? [v] : []).map((x) => String(x).trim()).filter(Boolean);
const valid = (kind: 'mcq' | 'ratta', x: Raw): boolean =>
  kind === 'mcq'
    ? typeof x.q === 'string' && x.q.trim() !== '' && Array.isArray(x.o) && x.o.length >= 2 && Number.isInteger(x.a) && (x.a as number) >= 0 && (x.a as number) < x.o.length
    : typeof x.q === 'string' && typeof x.a === 'string' && x.q.trim() !== '' && x.a.trim() !== '';

export function parseItems(raw: unknown, kind: 'mcq' | 'ratta'): Raw[] {
  const obj = (raw && !Array.isArray(raw) && typeof raw === 'object' ? raw : {}) as Raw;
  const list = Array.isArray(raw) ? raw : obj.items || obj.mcqs || obj.cards || obj.questions;
  return (Array.isArray(list) ? (list as Raw[]) : []).filter((x) => x && typeof x === 'object' && valid(kind, x));
}

// One download per file per visit. The browser also keeps its own copy, so set a Cache-Control header on your host.
const files = new Map<string, Promise<unknown>>();
function fetchFile(url: string): Promise<unknown> {
  let p = files.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`The file could not be loaded (${r.status})`);
      return r.json();
    });
    files.set(url, p);
    p.catch(() => files.delete(url));
  }
  return p;
}

export const isLinkSet = (s?: LinkSet) => !!s && !!s.url && s.ids.length === 0;

export async function loadMcqs(set: LinkSet): Promise<MCQ[]> {
  const rows = parseItems(await fetchFile(set.url as string), 'mcq');
  return rows.map((x) => ({
    id: `${set.id}:${qkey(String(x.q))}`, q: String(x.q).trim(), o: (x.o as unknown[]).map(String), a: x.a as number,
    topic: set.topic, course: set.course, src: String(x.src || ''), exp: String(x.exp || x.explanation || ''),
    yt: arr(x.youtube || x.yt), pdf: arr(x.pdf), subject: set.subject || '',
  })) as unknown as MCQ[];
}

export async function loadCards(set: LinkSet): Promise<RattaCard[]> {
  const rows = parseItems(await fetchFile(set.url as string), 'ratta');
  return rows.map((x) => ({
    id: `${set.id}:${qkey(String(x.q))}`, q: String(x.q).trim(), a: String(x.a).trim(),
    topic: set.topic, course: set.course, src: String(x.src || ''), exp: String(x.exp || x.explanation || ''),
    yt: arr(x.youtube || x.yt), pdf: arr(x.pdf), subject: set.subject || '',
  })) as unknown as RattaCard[];
}

// Monthly test: opens the files of the chosen subjects and draws random questions from each
export async function buildMonthlyAsync(st: AppState, test: MonthlyTest): Promise<MCQ[]> {
  const sets = (((st as unknown as { extras?: { mcqSets?: LinkSet[] } }).extras?.mcqSets) || []).filter((s) => s.course === test.course);
  const out: MCQ[] = [];
  for (const part of test.parts) {
    const lists = await Promise.all(
      sets.filter((s) => s.subject === part.subject).map((s) => {
        if (isLinkSet(s)) return loadMcqs(s).catch(() => [] as MCQ[]);
        const ids = new Set(s.ids);
        return Promise.resolve(st.mcqs.filter((m) => ids.has(m.id)));
      })
    );
    out.push(...shuffle(lists.flat()).slice(0, part.count));
  }
  return out;
}
