// Pure helpers: how the app data is split into database rows and put back together.
// No network code here, so it is easy to test.
export type Rec = Record<string, unknown>;

// Keys a visitor who is not signed in may read (must match the SQL policy "content public keys")
export const PUBLIC_KEYS = ['courses', 'site', 'maint', 'strip', 'ann'];

const SIMPLE: [string, string][] = [
  ['courses', 'courses'], ['topics', 'topics'], ['ann', 'ann'], ['ads', 'ads'], ['flags', 'flags'],
  ['maint', 'maint'], ['site', 'site'], ['quiz', 'quiz'], ['prot', 'prot'], ['sec', 'sec'], ['srcs', 'srcs'],
];

export const hash = (v: unknown): string => {
  const s = JSON.stringify(v) ?? '';
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
};
export const hashesOf = (rows: Rec): Record<string, string> => {
  const o: Record<string, string> = {};
  Object.keys(rows).forEach((k) => (o[k] = hash(rows[k])));
  return o;
};

type Kind = 'mcq' | 'ratta';
const itemKey = (kind: Kind, it: Rec) => `${kind}:${(it.setId as string) || '_loose'}`;

// App state -> content rows (key -> JSON)
export function splitState(st: Rec): Rec {
  const out: Rec = {};
  SIMPLE.forEach(([k, f]) => {
    if (st[f] !== undefined) out[k] = st[f];
  });
  const ex = { ...((st.extras as Rec) || {}) };
  const strip = ex.strip;
  delete ex.strip;
  delete ex.stats; // set statistics live in their own table
  out.extras = ex;
  if (strip !== undefined) out.strip = strip;
  (['mcq', 'ratta'] as Kind[]).forEach((kind) => {
    const list = ((kind === 'mcq' ? st.mcqs : st.ratta) as Rec[]) || [];
    const groups: Record<string, Rec[]> = {};
    list.forEach((it) => {
      const k = itemKey(kind, it);
      (groups[k] = groups[k] || []).push(it);
    });
    Object.keys(groups).forEach((k) => (out[k] = groups[k]));
  });
  return out;
}

// Content rows -> app state. replaceAll = start from the cloud copy (used on the first pull).
export function applyRows(st: Rec, rows: { key: string; value: unknown }[], gone: string[] = [], replaceAll = false): Rec {
  const next: Rec = { ...st };
  let ex: Rec = { ...((st.extras as Rec) || {}) };
  let mcqs = replaceAll ? [] : [...(((st.mcqs as Rec[]) || []))];
  let ratta = replaceAll ? [] : [...(((st.ratta as Rec[]) || []))];
  rows.forEach(({ key, value }) => {
    if (key.startsWith('mcq:')) mcqs = mcqs.filter((m) => itemKey('mcq', m) !== key).concat(((value as Rec[]) || []));
    else if (key.startsWith('ratta:')) ratta = ratta.filter((m) => itemKey('ratta', m) !== key).concat(((value as Rec[]) || []));
    else if (key === 'strip') ex = { ...ex, strip: value };
    else if (key === 'extras') ex = { ...((value as Rec) || {}), strip: ex.strip, stats: ex.stats };
    else {
      const f = SIMPLE.find(([k]) => k === key);
      if (f) next[f[1]] = value;
    }
  });
  gone.forEach((key) => {
    if (key.startsWith('mcq:')) mcqs = mcqs.filter((m) => itemKey('mcq', m) !== key);
    else if (key.startsWith('ratta:')) ratta = ratta.filter((m) => itemKey('ratta', m) !== key);
    else if (key === 'strip') {
      ex = { ...ex };
      delete ex.strip;
    }
  });
  next.mcqs = mcqs;
  next.ratta = ratta;
  next.extras = ex;
  return next;
}

// ---- database rows -> the objects the admin screens already use ----
const ms = (v: unknown) => (v ? Date.parse(String(v)) || 0 : 0);
export const userFromProfile = (p: Rec): Rec => ({
  id: p.id, name: p.name || p.email || 'Student', email: p.email || '', course: p.enrolled_course || '', status: p.status || 'active',
  solved: p.solved ?? 0, acc: p.accuracy ?? 0, streak: p.streak ?? 0, last: ms(p.last_seen), role: p.role || 'user', multiAccountFlag: false,
  acts: [['Joined SawalJar', ms(p.created_at)], ['Last seen', ms(p.last_seen)]],
});
export const reportFromRow = (r: Rec): Rec => ({ id: r.id, mcq: r.mcq_text, kind: r.kind, user: r.user_name, reason: r.reason, status: r.status, t: ms(r.created_at) });
export const logFromRow = (r: Rec): Rec => ({ id: r.id, userEmail: r.user_email, eventType: r.event_type, testTitle: r.test_title, ip: 'Browser', t: ms(r.created_at) });
export const auditFromRow = (r: Rec): Rec => ({ a: r.action, t: ms(r.created_at) });

// ---- what changed since the last sync (the admin edits these lists in the UI) ----
export type UserSnap = Record<string, { status: string; solved: number }>;
export const snapUsers = (list: Rec[]): UserSnap => {
  const o: UserSnap = {};
  list.forEach((u) => (o[u.id as string] = { status: u.status as string, solved: Number(u.solved) || 0 }));
  return o;
};
export function diffUsers(prev: UserSnap, next: Rec[]) {
  const ids = new Set(next.map((u) => u.id as string));
  const status: { id: string; status: string }[] = [];
  const reset: string[] = [];
  next.forEach((u) => {
    const p = prev[u.id as string];
    if (!p) return;
    if (u.status !== p.status) status.push({ id: u.id as string, status: u.status as string });
    if (p.solved > 0 && Number(u.solved) === 0) reset.push(u.id as string);
  });
  return { status, reset, remove: Object.keys(prev).filter((id) => !ids.has(id)) };
}
export const snapStatus = (list: Rec[]): Record<string, string> => {
  const o: Record<string, string> = {};
  list.forEach((r) => (o[r.id as string] = r.status as string));
  return o;
};
export function diffReports(prev: Record<string, string>, next: Rec[]) {
  const ids = new Set(next.map((r) => r.id as string));
  return {
    status: next.filter((r) => prev[r.id as string] !== undefined && prev[r.id as string] !== r.status).map((r) => ({ id: r.id as string, status: r.status as string })),
    remove: Object.keys(prev).filter((id) => !ids.has(id)),
  };
}
export const newerThan = (list: Rec[], t: number) => list.filter((x) => Number(x.t) > t);
