import { loadAppState, saveAppState } from '@/lib/store';
import type { AppState } from '@/lib/types';
import { cloudBumpSet } from '@/lib/cloud';

type SetLite = { id: string; ids: string[] };
type Loose = { extras?: { mcqSets?: SetLite[]; rattaSets?: SetLite[]; stats?: Record<string, { views: number; attempts: number }> } };

// Call from the student MCQ and Ratta pages with the id of the question or card:
//   bumpItemStat(mcq.id, 'views')    when it is shown
//   bumpItemStat(mcq.id, 'attempts') when the student answers
// The count is added to the JSON file the item came from. With localStorage it counts per browser;
// it will add up across all students once data moves to Supabase.
export function bumpItemStat(itemId: string, field: 'views' | 'attempts') {
  const st = loadAppState();
  const ex = (st as unknown as Loose).extras || {};
  const set = [...(ex.mcqSets || []), ...(ex.rattaSets || [])].find((s) => s.ids.includes(itemId));
  if (!set) return;
  void cloudBumpSet(set.id, field).catch(() => undefined);
  const stats = { ...(ex.stats || {}) };
  const cur = stats[set.id] || { views: 0, attempts: 0 };
  stats[set.id] = { ...cur, [field]: cur[field] + 1 };
  saveAppState({ ...st, extras: { ...ex, stats } } as AppState);
}
