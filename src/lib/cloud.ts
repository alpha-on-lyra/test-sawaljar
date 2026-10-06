import { getSupabase, getCurrentUser, isSupabaseConfigured } from '@/lib/supabase';
import { loadAppState, writeLocalState, setSaveHook } from '@/lib/store';
import type { AppState } from '@/lib/types';
import type { Stats } from '@/lib/userStats';
import {
  Rec, splitState, applyRows, hashesOf, userFromProfile, reportFromRow, logFromRow, auditFromRow,
  snapUsers, diffUsers, snapStatus, diffReports, newerThan, UserSnap,
} from '@/lib/cloudmap';

// ---------------------------------------------------------------------------------------------
// Keeps the browser copy of the data in step with Supabase.
//   everyone : pulls the content they are allowed to read (RLS decides which rows come back)
//   admin    : also pushes every change made in the admin panel, and pulls users and reports
//   students : write only through the safe functions in the database (answers, stats, reports)
// ---------------------------------------------------------------------------------------------
export type CloudStatus = { mode: 'off' | 'idle' | 'syncing' | 'ok' | 'error'; role: 'none' | 'user' | 'admin'; at?: number; msg?: string };
let status: CloudStatus = { mode: isSupabaseConfigured ? 'idle' : 'off', role: 'none' };
const listeners = new Set<() => void>();
const set = (p: Partial<CloudStatus>) => {
  status = { ...status, ...p };
  listeners.forEach((f) => f());
};
export const getCloudStatus = () => status;
export const subscribeCloud = (f: () => void) => {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
};

const VER_KEY = 'sj_cloud_ver';
const readVer = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(VER_KEY) || '{}');
  } catch {
    return {};
  }
};
const writeVer = (v: Record<string, string>) => {
  try {
    localStorage.setItem(VER_KEY, JSON.stringify(v));
  } catch {
    // storage unavailable
  }
};

let ready = false; // first successful pull done
let snap: Record<string, string> = {};
let userSnap: UserSnap = {};
let usersReady = false;
let reportSnap: Record<string, string> = {};
let logIds = new Set<string>();
let auditT = 0;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;
let lastPull = 0;
let pulling: Promise<void> | null = null;

const msg = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Something went wrong');

async function doPull() {
  const sb = getSupabase();
  if (!sb) return;
  set({ mode: 'syncing' });
  try {
    const me = (await getCurrentUser()) as { role?: string; status?: string } | null;
    let role: CloudStatus['role'] = me ? 'user' : 'none';
    if (me && me.role === 'admin' && me.status === 'active') {
      const unlocked = await sb.rpc('admin_is_unlocked'); // admin role AND the admin username and password were entered
      if (unlocked.data === true) role = 'admin';
    }

    const meta = await sb.from('content').select('key,updated_at');
    if (meta.error) throw meta.error;
    const metaRows = (meta.data || []) as { key: string; updated_at: string }[];
    const ver = readVer();
    const first = Object.keys(ver).length === 0;
    const changed = metaRows.filter((r) => ver[r.key] !== r.updated_at).map((r) => r.key);
    const gone = Object.keys(ver).filter((k) => !metaRows.some((r) => r.key === k));
    const rows: { key: string; value: unknown }[] = [];
    for (let i = 0; i < changed.length; i += 25) {
      const part = await sb.from('content').select('key,value').in('key', changed.slice(i, i + 25));
      if (part.error) throw part.error;
      rows.push(...((part.data || []) as { key: string; value: unknown }[]));
    }

    let st = loadAppState() as unknown as Rec;
    st = applyRows(st, rows, gone, first && metaRows.length > 0);

    if (role === 'admin') {
      const [pr, rp, ac, au, ss] = await Promise.all([
        sb.from('profiles').select('*').order('created_at', { ascending: false }).limit(2000),
        sb.from('reports').select('*').order('created_at', { ascending: false }).limit(500),
        sb.from('anti_cheat_logs').select('*').order('created_at', { ascending: false }).limit(300),
        sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
        sb.from('set_stats').select('*'),
      ]);
      usersReady = !pr.error;
      if (!pr.error) st.users = (pr.data || []).map((p) => userFromProfile(p as Rec));
      if (!rp.error) st.reports = (rp.data || []).map((r) => reportFromRow(r as Rec));
      if (!ac.error) st.antiCheatLogs = (ac.data || []).map((r) => logFromRow(r as Rec));
      if (!au.error) st.audit = (au.data || []).map((r) => auditFromRow(r as Rec));
      if (!ss.error) {
        const stats: Record<string, { views: number; attempts: number }> = {};
        (ss.data || []).forEach((r) => {
          const x = r as { set_id: string; views: number; attempts: number };
          stats[x.set_id] = { views: x.views, attempts: x.attempts };
        });
        st.extras = { ...((st.extras as Rec) || {}), stats };
      }
      userSnap = snapUsers((st.users as Rec[]) || []);
      reportSnap = snapStatus((st.reports as Rec[]) || []);
      logIds = new Set(((st.antiCheatLogs as Rec[]) || []).map((l) => l.id as string));
      auditT = Math.max(0, ...(((st.audit as Rec[]) || []).map((a) => Number(a.t) || 0)));
      // When the cloud is still empty, nothing counts as synced yet, so the first admin save uploads everything
      snap = metaRows.length === 0 ? {} : hashesOf(splitState(st));
    }

    writeLocalState(st as unknown as AppState);
    const nv: Record<string, string> = {};
    metaRows.forEach((r) => (nv[r.key] = r.updated_at));
    writeVer(nv);
    ready = true;
    lastPull = Date.now();
    set({ mode: 'ok', role, at: Date.now(), msg: undefined });
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('sj_cloud_pulled'));
  } catch (e) {
    set({ mode: 'error', msg: msg(e) });
  }
}

export function syncFromCloud(force = false): Promise<void> {
  if (!isSupabaseConfigured || typeof window === 'undefined') return Promise.resolve();
  if (pushTimer || pushing) return Promise.resolve(); // never overwrite edits that are still being saved
  if (!force && Date.now() - lastPull < 20000) return Promise.resolve();
  if (!pulling) pulling = doPull().finally(() => (pulling = null));
  return pulling;
}

async function pushNow() {
  const sb = getSupabase();
  if (!sb || status.role !== 'admin' || !ready) return;
  pushing = true;
  set({ mode: 'syncing' });
  try {
    const st = loadAppState() as unknown as Rec;
    const rows = splitState(st);
    const hs = hashesOf(rows);
    const upserts = Object.keys(rows).filter((k) => snap[k] !== hs[k]).map((k) => ({ key: k, value: rows[k] }));
    const dels = Object.keys(snap).filter((k) => !(k in hs) && /^(mcq|ratta):/.test(k));
    const ver = readVer();
    for (let i = 0; i < upserts.length; i += 6) {
      const res = await sb.from('content').upsert(upserts.slice(i, i + 6), { onConflict: 'key' }).select('key,updated_at');
      if (res.error) throw res.error;
      (res.data || []).forEach((r) => (ver[(r as { key: string }).key] = (r as { updated_at: string }).updated_at));
    }
    if (dels.length) {
      const res = await sb.from('content').delete().in('key', dels);
      if (res.error) throw res.error;
      dels.forEach((k) => delete ver[k]);
    }
    writeVer(ver);
    snap = hs;

    const users = (st.users as Rec[]) || [];
    if (usersReady) {
      const d = diffUsers(userSnap, users);
      if (d.remove.length > 3) throw new Error('Too many users were removed at once, so nothing was deleted. Delete them one at a time.');
      for (const u of d.status) {
        const r = await sb.from('profiles').update({ status: u.status }).eq('id', u.id);
        if (r.error) throw r.error;
      }
      for (const id of d.reset) {
        const r = await sb.rpc('admin_reset_user', { p_id: id });
        if (r.error) throw r.error;
      }
      for (const id of d.remove) {
        const r = await sb.rpc('admin_delete_user', { p_id: id });
        if (r.error) throw r.error;
      }
      userSnap = snapUsers(users);
    }
    const rd = diffReports(reportSnap, (st.reports as Rec[]) || []);
    for (const r of rd.status) {
      const x = await sb.from('reports').update({ status: r.status }).eq('id', r.id);
      if (x.error) throw x.error;
    }
    if (rd.remove.length) {
      const x = await sb.from('reports').delete().in('id', rd.remove);
      if (x.error) throw x.error;
    }
    reportSnap = snapStatus((st.reports as Rec[]) || []);

    const logs = (st.antiCheatLogs as Rec[]) || [];
    const logGone = Array.from(logIds).filter((id) => !logs.some((l) => l.id === id));
    if (logGone.length) {
      const x = await sb.from('anti_cheat_logs').delete().in('id', logGone);
      if (x.error) throw x.error;
    }
    logIds = new Set(logs.map((l) => l.id as string));

    const fresh = newerThan((st.audit as Rec[]) || [], auditT);
    if (fresh.length) {
      const x = await sb.from('audit_logs').insert(fresh.map((a) => ({ action: String(a.a).slice(0, 300) })));
      if (x.error) throw x.error;
      auditT = Math.max(auditT, ...fresh.map((a) => Number(a.t) || 0));
    }
    set({ mode: 'ok', at: Date.now(), msg: undefined });
  } catch (e) {
    set({ mode: 'error', msg: msg(e) });
  } finally {
    pushing = false;
  }
}

function schedulePush() {
  if (status.role !== 'admin' || !ready) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushNow();
  }, 700);
}

// Admin button: send everything from this browser to the cloud (used when the cloud is still empty)
export async function pushAll() {
  if (status.role !== 'admin') return;
  snap = {};
  await pushNow();
}

let started = false;
export function initCloud() {
  if (started || !isSupabaseConfigured) return;
  started = true;
  setSaveHook(() => schedulePush());
}

// ---------- student side: small safe calls (the database checks everything again) ----------
export async function cloudRecordAnswer(correct: boolean, subject: string) {
  const sb = getSupabase();
  if (sb) await sb.rpc('record_answer', { p_correct: correct, p_subject: subject });
}
export async function cloudBumpSet(setId: string, field: 'views' | 'attempts') {
  const sb = getSupabase();
  if (sb) await sb.rpc('bump_set_stat', { p_set: setId, p_field: field });
}
export async function cloudTouch(course: string) {
  const sb = getSupabase();
  if (sb) await sb.rpc('touch_me', { p_course: course });
}
export async function cloudMyStats(): Promise<Stats | null> {
  const sb = getSupabase();
  const me = (await getCurrentUser()) as { id?: string } | null;
  if (!sb || !me?.id) return null;
  const since = new Date(Date.now() - 60 * 86400000).toLocaleDateString('en-CA');
  const [p, d, s] = await Promise.all([
    sb.from('profiles').select('solved,correct').eq('id', me.id).maybeSingle(),
    sb.from('user_daily_stats').select('day,attempted,correct').eq('user_id', me.id).gte('day', since),
    sb.from('user_subject_stats').select('subject,attempted,correct').eq('user_id', me.id),
  ]);
  if (p.error || !p.data) return null;
  const out: Stats = { attempted: p.data.solved || 0, correct: p.data.correct || 0, byDay: {}, bySubject: {} };
  (d.data || []).forEach((r) => (out.byDay[r.day as string] = { a: r.attempted as number, c: r.correct as number }));
  (s.data || []).forEach((r) => (out.bySubject[r.subject as string] = { a: r.attempted as number, c: r.correct as number }));
  return out;
}
export async function cloudLeaderboard(course: string) {
  const sb = getSupabase();
  if (!sb) return null;
  const r = await sb.rpc('get_leaderboard', { p_course: course || null });
  if (r.error) return null;
  return ((r.data || []) as { id: string; name: string; course: string | null; solved: number; accuracy: number; streak: number }[]).map((x) => ({
    id: x.id, name: x.name, course: x.course || '', solved: x.solved, acc: x.accuracy, streak: x.streak, email: '', status: 'active',
  }));
}

// ---------- admin helpers: storage meter and old-log cleanup ----------
export async function cloudDbUsage(): Promise<{ bytes: number; limit: number } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const r = await sb.rpc('admin_db_usage');
  if (r.error || r.data == null) return null;
  return { bytes: Number(r.data), limit: 500 * 1024 * 1024 };
}
export async function cloudCleanup(): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase is not connected');
  const r = await sb.rpc('admin_cleanup');
  if (r.error) throw r.error;
  return String(r.data);
}
