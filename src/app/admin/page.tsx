'use client';

import type { MonthlyTest } from '@/lib/monthly';
import { useUser } from '@/lib/useUser';
import { useTheme } from '@/lib/useTheme';
import { StripBar, DEFAULT_STRIP } from '@/components/TopStrip';
import { useCloudSync } from '@/lib/useCloud';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { syncFromCloud, pushAll, cloudDbUsage, cloudCleanup, cloudQuestionStats } from '@/lib/cloud';
import { loadMcqs, loadCards, qkey } from '@/lib/bank';
import type { LinkSet } from '@/lib/bank';
import type { Strip } from '@/components/TopStrip';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { AdminNav, AdminViewKey } from '@/components/AdminNav';
import {
  loadAppState,
  saveAppState,
  addAuditLog,
  seedInitialData,
  uid,
  THEME_KEY,
} from '@/lib/store';
import {
  AppState,
  Course,
  Topic,
  TopicResource,
  User,
  MCQ,
  RattaCard,
  Report,
  JsonSourceItem,
} from '@/lib/types';

type BankOpts = { shuffleQ: boolean; shuffleO: boolean; showExp: boolean; retake: boolean; negMark: boolean; perSession: number; secPerQ: number };
type RattaOpts = { shuffle: boolean; selfCheck: boolean; perSession: number };
type Res = { title: string; url: string };
type BankSet = { id: string; name: string; kind: 'upload' | 'link'; url?: string; course: string; subject?: string; topic: string; ids: string[]; count?: number; yt: Res[]; pdf: Res[]; updated: number };
type Extras = { mcq: BankOpts; ratta: RattaOpts; mcqSets: BankSet[]; rattaSets: BankSet[]; stats?: Record<string, { views: number; attempts: number }>; monthly?: MonthlyTest[]; offline?: Record<string, boolean>; adSlots?: Record<string, AdSlot>; strip?: Strip };
type AdSlot = { on: boolean; provider: 'adsense' | 'adsterra'; code: string; height: number };
type BankKind = 'mcq' | 'ratta';
type BankForm = { course: string; subject: string; newSubject: string; topic: string; newTopic: string; mode: 'upload' | 'link'; url: string; name: string; text: string; file: string };
type Parsed = { items: Record<string, unknown>[]; yt: Res[]; pdf: Res[]; name?: string; skipped: number };
const NEW_TOPIC = '__new';
const EMPTY_FORM: BankForm = { course: '', subject: '', newSubject: '', topic: '', newTopic: '', mode: 'link', url: '', name: '', text: '', file: '' };
const toRes = (v: unknown, label: string): Res[] => {
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  return arr
    .map((x, i) => {
      if (typeof x === 'string') return { title: `${label} ${i + 1}`, url: x.trim() };
      const o = (x || {}) as { title?: string; url?: string };
      return { title: (o.title || `${label} ${i + 1}`).trim(), url: (o.url || '').trim() };
    })
    .filter((r) => /^https?:\/\//.test(r.url));
};
const parseBank = (text: string, kind: BankKind): Parsed | string => {
  let d: unknown;
  try {
    d = JSON.parse(text);
  } catch {
    return 'Invalid JSON. Check commas and quotes.';
  }
  const root = (Array.isArray(d) ? {} : d || {}) as Record<string, unknown>;
  const list = Array.isArray(d) ? d : root.mcqs ?? root.cards ?? root.items ?? root.questions;
  if (!Array.isArray(list)) return 'JSON must be an array, or an object with an "mcqs" or "cards" array.';
  let skipped = 0;
  const items: Record<string, unknown>[] = [];
  list.forEach((x) => {
    const o = (x || {}) as Record<string, unknown>;
    const a = o.a as number;
    const ok =
      typeof o.q === 'string' && o.q.trim() &&
      (kind === 'mcq'
        ? Array.isArray(o.o) && o.o.length >= 2 && Number.isInteger(a) && a >= 0 && a < o.o.length
        : typeof o.a === 'string' && o.a.trim());
    if (ok) items.push(o);
    else skipped++;
  });
  if (!items.length) return `No valid ${kind === 'mcq' ? 'MCQs' : 'cards'} found (${skipped} skipped).`;
  return { items, skipped, yt: toRes(root.youtube, 'Video'), pdf: toRes(root.pdf, 'PDF'), name: typeof root.title === 'string' ? root.title : undefined };
};
type GaRow = { dims: string[]; metrics: number[] };
const DEFAULT_EXTRAS: Extras = {
  mcq: { shuffleQ: true, shuffleO: true, showExp: true, retake: true, negMark: false, perSession: 20, secPerQ: 60 },
  ratta: { shuffle: true, selfCheck: true, perSession: 20 },
  mcqSets: [],
  rattaSets: [],
};
// Reads the Supabase session token that supabase-js keeps in localStorage
const getSbToken = (): string => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || '';
      if (/^sb-.*-auth-token$/.test(k)) {
        const v = JSON.parse(localStorage.getItem(k) || '{}');
        if (v.access_token) return v.access_token as string;
      }
    }
  } catch {
    // ignore storage errors
  }
  return '';
};

function FilePick({ name, onFile }: { name?: string; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <button type="button" className="b" onClick={() => ref.current?.click()}>Choose JSON file</button>
      <span className="text-xs text-[var(--mut)] truncate">{name || 'No file chosen'}</span>
      <input
        ref={ref}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function AdminApp() {
  const [state, setState] = useState<AppState>(seedInitialData());
  const cloud = useCloudSync(true);
  const [usage, setUsage] = useState<{ bytes: number; limit: number } | null>(null);
  useEffect(() => {
    const f = () => setState(loadAppState());
    window.addEventListener('sj_cloud_pulled', f);
    return () => window.removeEventListener('sj_cloud_pulled', f);
  }, []);
  useEffect(() => {
    if (cloud.role === 'admin' && cloud.mode === 'ok') void cloudDbUsage().then(setUsage).catch(() => undefined);
  }, [cloud.role, cloud.mode, cloud.at]);
  const [view, setView] = useState<AdminViewKey>('dash');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);

  // Users view state
  const [userQuery, setUserQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');

  // MCQ view state
  const [mcqQuery, setMcqQuery] = useState('');

  // Course & Topic state
  const [selectedAdminCourse, setSelectedAdminCourse] = useState<string>('MDCAT');
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseBadge, setNewCourseBadge] = useState('Medical');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCourseIcon, setNewCourseIcon] = useState('📚');

  // Topic states
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');

  // Resource states
  const [resourceModalTopic, setResourceModalTopic] = useState<Topic | null>(null);
  const [newResType, setNewResType] = useState<'youtube' | 'pdf'>('youtube');
  const [newResTitle, setNewResTitle] = useState('');
  const [newResUrl, setNewResUrl] = useState('');

  // Single MCQ Creator state

  // Ratta state

  // Announcements state
  const [annTitle, setAnnTitle] = useState('');
  const [annMsg, setAnnMsg] = useState('');
  const [annKind, setAnnKind] = useState<'info' | 'warning' | 'success'>('info');

  // Security state
  const [newIp, setNewIp] = useState('');


  // Load from local storage on mount
  useEffect(() => {
    const loaded = loadAppState();
    setState(loaded);

    // Apply saved theme
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) {
      document.documentElement.dataset.theme = savedTheme;
    }

  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMsg(null), 2000);
  };

  const updateStateAndSave = (updater: (prev: AppState) => AppState, auditDesc?: string) => {
    setState((prev) => {
      let next = updater(prev);
      if (auditDesc) {
        next = addAuditLog(next, auditDesc);
      }
      saveAppState(next);
      return next;
    });
  };

  const toggleTheme = () => {
    const current = document.documentElement.dataset.theme || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    showToast(`Switched to ${next} mode`);
  };

  // Time-ago formatter
  const timeAgo = (t: number) => {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.round(m / 60)}h ago`;
    return `${Math.round(m / 1440)}d ago`;
  };

  // CSV Exporter
  const exportCsv = (title: string, rows: (string | number)[][]) => {
    const csvContent = rows
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    setModalContent(
      <div>
        <h3 className="text-base font-bold mb-1">{title}</h3>
        <p className="sub mb-3">Copy and paste into Excel, Google Sheets or save as .csv</p>
        <textarea
          readOnly
          value={csvContent}
          className="w-full h-48 p-2 font-mono text-xs border rounded-lg bg-[var(--bg)]"
        />
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            className="b p"
            onClick={() => {
              navigator.clipboard.writeText(csvContent);
              showToast('CSV Copied to clipboard!');
            }}
          >
            Copy
          </button>
          <button type="button" className="b" onClick={() => setModalContent(null)}>
            Close
          </button>
        </div>
      </div>
    );
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    const q = userQuery.toLowerCase().trim();
    return state.users.filter((u) => {
      const matchQ = (u.name + u.email + u.course).toLowerCase().includes(q);
      const matchStatus = !userStatusFilter || u.status === userStatusFilter;
      return matchQ && matchStatus;
    });
  }, [state.users, userQuery, userStatusFilter]);

  // Filtered MCQs
  const filteredMcqs = useMemo(() => {
    const q = mcqQuery.toLowerCase().trim();
    return state.mcqs.filter((m) =>
      (m.q + m.topic + m.course + (m.src || '')).toLowerCase().includes(q)
    );
  }, [state.mcqs, mcqQuery]);

  // ==========================================
  // VIEW RENDERERS
  // ==========================================

  const [gaRange, setGaRange] = useState('28');
  const [gaCourse, setGaCourse] = useState('');
  const [gaRows, setGaRows] = useState<Record<string, GaRow[]>>({});
  const [gaLoading, setGaLoading] = useState(false);
  const [gaErr, setGaErr] = useState('');

  const extrasRaw = (state as AppState & { extras?: Partial<Extras> }).extras;
  const extras: Extras = {
    mcq: { ...DEFAULT_EXTRAS.mcq, ...(extrasRaw?.mcq || {}) },
    ratta: { ...DEFAULT_EXTRAS.ratta, ...(extrasRaw?.ratta || {}) },
    mcqSets: extrasRaw?.mcqSets || [],
    rattaSets: extrasRaw?.rattaSets || [],
    stats: extrasRaw?.stats || {},
    monthly: extrasRaw?.monthly || [],
    offline: extrasRaw?.offline || {},
    adSlots: extrasRaw?.adSlots || {},
    strip: extrasRaw?.strip,
  };
  const saveExtras = (patch: Partial<Extras>, msg: string) =>
    updateStateAndSave((prev) => ({ ...prev, extras: { ...((prev as AppState & { extras?: Partial<Extras> }).extras || {}), ...patch } } as AppState), msg);

  const topicsFor = (course: string): string[] => {
    const fromTopics = state.topics
      .filter((t) => t.courseName === course)
      .map((t) => {
        const x = t as unknown as { name?: string; title?: string };
        return x.name || x.title || '';
      });
    const all = [
      ...fromTopics,
      ...state.mcqs.filter((m) => m.course === course).map((m) => m.topic),
      ...state.ratta.filter((c) => c.course === course).map((c) => c.topic),
      ...extras.mcqSets.filter((x) => x.course === course).map((x) => x.topic),
      ...extras.rattaSets.filter((x) => x.course === course).map((x) => x.topic),
    ];
    return Array.from(new Set(all)).filter(Boolean);
  };

  const tg = (label: string, desc: string, on: boolean, set: (v: boolean) => void) => (
    <div className="tg" key={label}>
      <div>
        {label}
        <small>{desc}</small>
      </div>
      <label className="sw">
        <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
        <span />
      </label>
    </div>
  );
  const numBox = (label: string, v: number, min: number, max: number, set: (n: number) => void) => (
    <div key={label}>
      <small className="sub">{label}</small>
      <input type="number" min={min} max={max} value={v} onChange={(e) => set(Math.min(max, Math.max(min, Number(e.target.value) || min)))} />
    </div>
  );

  const renderMcqOptions = () => {
    const o = extras.mcq;
    const set = (p: Partial<BankOpts>) => saveExtras({ mcq: { ...o, ...p } }, 'Updated MCQ practice options');
    return (
      <div className="card">
        <h3>Practice options for MCQs</h3>
        {tg('Shuffle questions', 'New random order every session', o.shuffleQ, (v) => set({ shuffleQ: v }))}
        {tg('Shuffle options', 'Randomise A, B, C, D for each question', o.shuffleO, (v) => set({ shuffleO: v }))}
        {tg('Show explanation after answering', 'Uses the explanation saved with each MCQ', o.showExp, (v) => set({ showExp: v }))}
        {tg('Allow retakes', 'Students can repeat a session', o.retake, (v) => set({ retake: v }))}
        {tg('Negative marking', 'A wrong answer loses marks', o.negMark, (v) => set({ negMark: v }))}
        <div className="row mt-3">
          {numBox('Questions per session', o.perSession, 5, 200, (n) => set({ perSession: n }))}
          {numBox('Seconds per question (0 = untimed)', o.secPerQ, 0, 600, (n) => set({ secPerQ: n }))}
        </div>
      </div>
    );
  };

  const renderRattaOptions = () => {
    const o = extras.ratta;
    const set = (p: Partial<RattaOpts>) => saveExtras({ ratta: { ...o, ...p } }, 'Updated Ratta Card options');
    return (
      <div className="card">
        <h3>Revision options for Ratta Cards</h3>
        {tg('Shuffle cards', 'Random order every session', o.shuffle, (v) => set({ shuffle: v }))}
        {tg('Self-check buttons', 'Show "I knew it / I did not" after the answer is revealed', o.selfCheck, (v) => set({ selfCheck: v }))}
        <div className="row mt-3">{numBox('Cards per session', o.perSession, 5, 200, (n) => set({ perSession: n }))}</div>
      </div>
    );
  };

  const subjectsFor = (course: string): string[] => Array.from(new Set([...extras.mcqSets, ...extras.rattaSets].filter((x) => x.course === course && x.subject).map((x) => x.subject as string)));
  const topicsIn = (course: string, subject: string): string[] =>
    Array.from(new Set([...extras.mcqSets, ...extras.rattaSets].filter((x) => x.course === course && x.subject === subject).map((x) => x.topic))).filter(Boolean);
  const [bm, setBm] = useState<Record<BankKind, BankForm>>({ mcq: { ...EMPTY_FORM }, ratta: { ...EMPTY_FORM } });
  const [qsOpen, setQsOpen] = useState<{ k: BankKind; s: BankSet } | null>(null);
  const [qsRows, setQsRows] = useState<{ q: string; attempts: number; pct: number }[] | null>(null);
  const [qsErr, setQsErr] = useState('');
  const openQs = async (k: BankKind, s: BankSet) => {
    setQsOpen({ k, s });
    setQsRows(null);
    setQsErr('');
    try {
      const own = s.url && !s.ids.length;
      const [stats, items] = await Promise.all([
        cloudQuestionStats(s.id),
        own ? (k === 'mcq' ? loadMcqs(s as unknown as LinkSet) : loadCards(s as unknown as LinkSet)) : Promise.resolve((k === 'mcq' ? state.mcqs : state.ratta).filter((x) => s.ids.includes(x.id))),
      ]);
      const by = new Map(stats.map((r) => [r.qkey, r]));
      const rows = (items as { q: string }[]).map((it) => {
        const r = by.get(qkey(it.q));
        return { q: it.q, attempts: r?.attempts || 0, pct: r && r.attempts ? Math.round((r.correct / r.attempts) * 100) : -1 };
      });
      rows.sort((a, b) => Number(a.attempts === 0) - Number(b.attempts === 0) || a.pct - b.pct);
      setQsRows(rows);
    } catch (e) {
      setQsErr((e as Error).message || 'Could not load the statistics');
    }
  };
  const [bq, setBq] = useState('');
  const [bcf, setBcf] = useState('');
  const patchBm = (k: BankKind, p: Partial<BankForm>) => setBm((s) => ({ ...s, [k]: { ...s[k], ...p } }));
  const setsOf = (k: BankKind): BankSet[] => (k === 'mcq' ? extras.mcqSets : extras.rattaSets);
  const courseOf = (k: BankKind) => (state.courses.some((c) => c.name === bm[k].course) ? bm[k].course : state.courses[0]?.name || '');
  const fileLabel = (u?: string) => {
    try {
      return new URL(u || '', window.location.origin).pathname.split('/').pop() || 'link';
    } catch {
      return 'link';
    }
  };

  const commitSet = (k: BankKind, p: Parsed, meta: { name: string; kind: 'upload' | 'link'; url?: string; course: string; subject?: string; topic: string }, replaceId?: string) => {
    const setId = replaceId || uid('s');
    const ids: string[] = [];
    const mcqs: MCQ[] = [];
    const cards: RattaCard[] = [];
    // A linked file stays on your own website: only its name, count and links are saved, never the questions
    (meta.kind === 'link' ? [] : p.items).forEach((o) => {
      const course = String(o.course || meta.course);
      const topic = String(o.topic || meta.topic);
      if (k === 'mcq') {
        const m: MCQ = { id: uid('q'), q: String(o.q).trim(), o: (o.o as unknown[]).map(String), a: o.a as number, topic, course, src: String(o.src || ''), exp: String(o.exp || '') };
        ids.push(m.id);
        mcqs.push(m);
      } else {
        const c: RattaCard = { id: uid('c'), q: String(o.q).trim(), a: String(o.a).trim(), topic, course, src: String(o.src || '') };
        ids.push(c.id);
        cards.push(c);
      }
    });
    const key = k === 'mcq' ? 'mcqSets' : 'rattaSets';
    updateStateAndSave((prev) => {
      const ex = ((prev as AppState & { extras?: Partial<Extras> }).extras || {}) as Partial<Extras>;
      const old = (ex[key] || []) as BankSet[];
      const prevSet = old.find((s) => s.id === setId);
      const drop = new Set(prevSet?.ids || []);
      const set: BankSet = { id: setId, name: meta.name, kind: meta.kind, url: meta.url, course: meta.course, subject: meta.subject || 'General', topic: meta.topic, ids, count: p.items.length, yt: p.yt, pdf: p.pdf, updated: Date.now() };
      const sets = prevSet ? old.map((s) => (s.id === setId ? set : s)) : [set, ...old];
      const next = { ...prev, extras: { ...ex, [key]: sets } } as AppState;
      return k === 'mcq' ? { ...next, mcqs: [...mcqs, ...prev.mcqs.filter((m) => !drop.has(m.id))] } : { ...next, ratta: [...cards, ...prev.ratta.filter((c) => !drop.has(c.id))] };
    }, `${replaceId ? 'Updated' : 'Imported'} ${k === 'mcq' ? 'MCQ' : 'Ratta'} file "${meta.name}" (${p.items.length} items)`);
  };

  const fetchBank = async (url: string): Promise<string | null> => {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return null;
      return await r.text();
    } catch {
      return null;
    }
  };

  const importNow = async (k: BankKind) => {
    const f = bm[k];
    const course = courseOf(k);
    const subject = f.subject === NEW_TOPIC ? f.newSubject.trim() : f.subject || subjectsFor(course)[0] || '';
    const topic = f.topic === NEW_TOPIC ? f.newTopic.trim() : f.topic || topicsIn(course, subject)[0] || '';
    if (!course) return showToast('Add a course first');
    if (!subject) return showToast('Choose a subject or create a new one');
    if (!topic) return showToast('Choose a topic or create a new one');
    let text = f.text;
    let url: string | undefined;
    if (f.mode === 'link') {
      url = f.url.trim();
      if (!/^https?:\/\/\S+$/.test(url)) return showToast('Paste a full https link to a JSON file');
      const got = await fetchBank(url);
      if (got === null) return showToast('Could not load that link. It must be public and allow cross-origin access');
      text = got;
    } else if (!text) return showToast('Choose a JSON file first');
    const p = parseBank(text, k);
    if (typeof p === 'string') return showToast(p);
    commitSet(k, p, { name: f.name.trim() || p.name || (f.mode === 'link' ? fileLabel(url) : f.file.replace(/\.json$/i, '')) || 'Untitled', kind: f.mode, url, course, subject, topic });
    patchBm(k, { text: '', file: '', url: '', name: '', newTopic: '', newSubject: '' });
    showToast(`Linked ${p.items.length} items${p.skipped ? `, ${p.skipped} skipped` : ''}`);
  };

  const refreshSet = async (k: BankKind, s: BankSet) => {
    const got = s.url ? await fetchBank(s.url) : null;
    if (got === null) return showToast('Could not reload the link');
    const p = parseBank(got, k);
    if (typeof p === 'string') return showToast(p);
    commitSet(k, p, { name: s.name, kind: 'link', url: s.url, course: s.course, subject: s.subject, topic: s.topic }, s.id);
    showToast('Refreshed from link');
  };

  const deleteSet = (k: BankKind, s: BankSet) => {
    if (!confirm(`Delete "${s.name}" and its ${s.count ?? s.ids.length} items?`)) return;
    const drop = new Set(s.ids);
    const key = k === 'mcq' ? 'mcqSets' : 'rattaSets';
    updateStateAndSave((prev) => {
      const ex = ((prev as AppState & { extras?: Partial<Extras> }).extras || {}) as Partial<Extras>;
      const sets = ((ex[key] || []) as BankSet[]).filter((x) => x.id !== s.id);
      const next = { ...prev, extras: { ...ex, [key]: sets } } as AppState;
      return k === 'mcq' ? { ...next, mcqs: prev.mcqs.filter((m) => !drop.has(m.id)) } : { ...next, ratta: prev.ratta.filter((c) => !drop.has(c.id)) };
    }, `Deleted ${k === 'mcq' ? 'MCQ' : 'Ratta'} file "${s.name}"`);
    showToast('File deleted');
  };

  const saveEdit = (k: BankKind, s: BankSet) => {
    const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value || '';
    const p = parseBank(val('es-json'), k);
    if (typeof p === 'string') return showToast(p);
    const topic = val('es-topic').trim();
    if (!topic) return showToast('Topic cannot be empty');
    commitSet(k, p, { name: p.name || s.name, kind: 'upload', course: val('es-course'), subject: val('es-subject').trim() || 'General', topic }, s.id);
    setModalContent(null);
    showToast('File updated');
  };

  const editSet = (k: BankKind, s: BankSet) => {
    if (s.kind === 'link') return showToast('Editing is not supported for external links. Change the file at its source, then press Refresh.');
    const items = (k === 'mcq' ? state.mcqs : state.ratta).filter((x) => s.ids.includes(x.id)).map((x) => {
      const { id, course, topic, ...rest } = x as unknown as Record<string, unknown>;
      void id;
      void course;
      return topic !== s.topic ? { ...rest, topic } : rest;
    });
    const body = JSON.stringify({ title: s.name, youtube: s.yt, pdf: s.pdf, [k === 'mcq' ? 'mcqs' : 'cards']: items }, null, 2);
    setModalContent(
      <div>
        <h3 className="text-base font-bold mb-2">Edit &quot;{s.name}&quot;</h3>
        <div className="row">
          <select id="es-course" defaultValue={s.course}>
            {state.courses.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
          </select>
          <input id="es-subject" type="text" list="es-subjects" defaultValue={s.subject || ''} placeholder="Subject" />
          <datalist id="es-subjects">{subjectsFor(s.course).map((t) => (<option key={t} value={t} />))}</datalist>
          <input id="es-topic" type="text" list="es-topics" defaultValue={s.topic} placeholder="Topic" />
          <datalist id="es-topics">{topicsFor(s.course).map((t) => (<option key={t} value={t} />))}</datalist>
        </div>
        <p className="sub mb-1">Edit the JSON, or load a replacement file to update it.</p>
        <FilePick
          onFile={(file) => {
            const r = new FileReader();
            r.onload = () => {
              (document.getElementById('es-json') as HTMLTextAreaElement).value = String(r.result || '');
            };
            r.readAsText(file);
          }}
        />
        <textarea id="es-json" defaultValue={body} className="w-full h-64 mt-2" spellCheck={false} />
        <div className="flex gap-2 mt-3">
          <button type="button" className="b p" onClick={() => saveEdit(k, s)}>Save changes</button>
          <button type="button" className="b" onClick={() => setModalContent(null)}>Cancel</button>
        </div>
      </div>
    );
  };

  const renderBank = (k: BankKind) => {
    const f = bm[k];
    const course = courseOf(k);
    const subjects = subjectsFor(course);
    const subject = f.subject === NEW_TOPIC ? f.newSubject.trim() : f.subject || subjects[0] || '';
    const topics = topicsIn(course, subject);
    const sets = setsOf(k);
    const q = bq.toLowerCase().trim();
    const shown = sets.filter((s) => (!bcf || s.course === bcf) && (s.name + s.course + s.topic).toLowerCase().includes(q));
    const st = (id: string) => extras.stats?.[id] || { views: 0, attempts: 0 };
    const noun = k === 'mcq' ? 'MCQs' : 'Ratta Cards';
    const sample = k === 'mcq'
      ? '{\n  "title": "Cell Biology Set 1",\n  "youtube": ["https://www.youtube.com/watch?v=..."],\n  "pdf": ["https://example.com/notes.pdf"],\n  "mcqs": [\n    { "q": "Which organelle makes ATP?", "o": ["Nucleus","Mitochondria","Ribosome","Golgi"], "a": 1, "src": "MDCAT 2022", "exp": "Mitochondria produce ATP." }\n  ]\n}'
      : '{\n  "title": "Cell Biology Cards",\n  "youtube": ["https://www.youtube.com/watch?v=..."],\n  "pdf": ["https://example.com/notes.pdf"],\n  "cards": [\n    { "q": "______ is the powerhouse of the cell.", "a": "Mitochondria", "src": "MDCAT 2022" }\n  ]\n}';
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="stat"><span>JSON files</span><b>{sets.length}</b></div>
          <div className="stat"><span>Total {noun}</span><b>{sets.reduce((n, x) => n + (x.count ?? x.ids.length), 0)}</b></div>
          <div className="stat"><span>Attempts</span><b>{sets.reduce((n, x) => n + st(x.id).attempts, 0)}</b></div>
        </div>

        <div className="card">
          <h3>Import {noun} from JSON</h3>
          <div className="row">
            <div>
              <small className="sub">Course</small>
              <select value={course} onChange={(e) => patchBm(k, { course: e.target.value, subject: '', topic: '' })}>
                {state.courses.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
              </select>
            </div>
            <div>
              <small className="sub">Subject</small>
              <select value={f.subject || subjects[0] || NEW_TOPIC} onChange={(e) => patchBm(k, { subject: e.target.value, topic: '' })}>
                {subjects.map((t) => (<option key={t} value={t}>{t}</option>))}
                <option value={NEW_TOPIC}>+ Create new subject</option>
              </select>
            </div>
            {(f.subject === NEW_TOPIC || !subjects.length) && (
              <div>
                <small className="sub">New subject name</small>
                <input type="text" placeholder="e.g. Biology" value={f.newSubject} onChange={(e) => patchBm(k, { newSubject: e.target.value, subject: NEW_TOPIC })} />
              </div>
            )}
            <div>
              <small className="sub">Topic</small>
              <select value={f.topic || topics[0] || NEW_TOPIC} onChange={(e) => patchBm(k, { topic: e.target.value })}>
                {topics.map((t) => (<option key={t} value={t}>{t}</option>))}
                <option value={NEW_TOPIC}>+ Create new topic</option>
              </select>
            </div>
            {(f.topic === NEW_TOPIC || !topics.length) && (
              <div>
                <small className="sub">New topic name</small>
                <input type="text" placeholder="e.g. Cell Biology" value={f.newTopic} onChange={(e) => patchBm(k, { newTopic: e.target.value, topic: NEW_TOPIC })} />
              </div>
            )}
          </div>
          <p className="sub mb-3">Questions stay on your own website. Paste the link to a JSON file: students open it when they press Solve, and Supabase keeps only the file name, count and statistics. The host must allow cross-origin access (CORS).</p>
          <div className="row">
            {f.mode === 'upload' ? (
              <FilePick
                key="bank-file"
                name={f.file}
                onFile={(file) => {
                  if (file.size > 2_000_000) return showToast('File is too large (2 MB max)');
                  const r = new FileReader();
                  r.onload = () => patchBm(k, { text: String(r.result || ''), file: file.name });
                  r.readAsText(file);
                }}
              />
            ) : (
              <input key="bank-link" type="text" placeholder="https://example.com/file.json" value={f.url} onChange={(e) => patchBm(k, { url: e.target.value })} />
            )}
            <input type="text" placeholder="Name (optional)" value={f.name} onChange={(e) => patchBm(k, { name: e.target.value })} />
            <button type="button" className="b p" onClick={() => void importNow(k)}>{f.mode === 'upload' ? 'Import file' : 'Add link'}</button>
          </div>
          <details>
            <summary className="sub cursor-pointer">JSON format (explanations, YouTube and PDF suggestions)</summary>
            <pre className="text-xs p-3 mt-2 rounded-lg overflow-auto bg-[var(--bg)]">{sample}</pre>
          </details>
        </div>

        <div className="card">
          <h3>{sets.length} JSON {sets.length === 1 ? 'file' : 'files'}</h3>
          <div className="row">
            <input type="search" placeholder="Search files" value={bq} onChange={(e) => setBq(e.target.value)} />
            <select value={bcf} onChange={(e) => setBcf(e.target.value)} aria-label="Filter by course">
              <option value="">All courses</option>
              {state.courses.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
            </select>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr><th>File</th><th>Course / Topic</th><th>{noun}</th><th>Suggestions</th><th>Attempts</th><th>Updated</th><th /></tr>
              </thead>
              <tbody>
                {shown.length ? shown.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.name}</b>
                      <small>{s.kind === 'link' ? 'External link' : 'Uploaded file'}</small>
                    </td>
                    <td>{s.course}<small>{s.subject || 'No subject: use Edit to set one'} › {s.topic}</small></td>
                    <td>{s.count ?? s.ids.length}</td>
                    <td className="text-xs">{s.yt.length} video, {s.pdf.length} PDF</td>
                    <td>{st(s.id).attempts}<small>{st(s.id).views} views</small></td>
                    <td className="text-xs text-[var(--mut)]">{timeAgo(s.updated)}</td>
                    <td className="whitespace-nowrap">
                      <button type="button" className="b" onClick={() => void openQs(k, s)}>Question stats</button>
                      <button type="button" className="b" onClick={() => editSet(k, s)}>Edit</button>
                      {s.kind === 'link' && (<button type="button" className="b" onClick={() => void refreshSet(k, s)}>Refresh</button>)}
                      <button type="button" className="b d" onClick={() => deleteSet(k, s)}>Delete</button>
                    </td>
                  </tr>
                )) : (<tr><td colSpan={7}>{sets.length ? 'No files match your search.' : 'No files yet. Import your first JSON file above.'}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
        {qsOpen && qsOpen.k === k && (
          <div className="card">
            <div className="row">
              <h3 style={{ flex: 1, margin: 0 }}>Question statistics: {qsOpen.s.name}</h3>
              <button type="button" className="b" onClick={() => setQsOpen(null)}>Close</button>
            </div>
            {qsErr ? <p className="sub" style={{ color: 'var(--red, #c0392b)' }}>{qsErr}</p> : !qsRows ? <p className="sub">Loading...</p> : (
              <div className="tw">
                <table>
                  <thead><tr><th>Question</th><th>Answers</th><th>Correct</th></tr></thead>
                  <tbody>
                    {qsRows.slice(0, 100).map((r, i) => (<tr key={i}><td>{r.q}</td><td>{r.attempts}</td><td>{r.pct < 0 ? 'No answers yet' : `${r.pct}%`}</td></tr>))}
                    {!qsRows.length && <tr><td colSpan={3}>No questions found in this file.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            <p className="sub mt-2">Hardest questions first. Statistics come from Supabase; the question text is read from your file.</p>
          </div>
        )}
        {k === 'mcq' ? renderMcqOptions() : renderRattaOptions()}
      </div>
    );
  };

  const loadGa = async () => {
    setGaLoading(true);
    setGaErr('');
    try {
      const out: Record<string, GaRow[]> = {};
      for (const r of ['sources', 'pages', 'topics', 'countries']) {
        const res = await fetch(`/api/ga?report=${r}&days=${gaRange}`, { headers: { Authorization: `Bearer ${getSbToken()}` } });
        if (!res.ok) {
          const j = await res.json().catch(() => ({ error: '' }));
          throw new Error(j.error || `Request failed (${res.status})`);
        }
        out[r] = ((await res.json()) as { rows?: GaRow[] }).rows || [];
      }
      setGaRows(out);
    } catch (e) {
      setGaErr(e instanceof Error ? e.message : 'Could not load analytics');
    }
    setGaLoading(false);
  };

  useEffect(() => {
    if (view === 'ana') void loadGa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, gaRange]);

  const renderAnalytics = () => {
    const tbl = (title: string, head: string[], rows: string[][]) => (
      <div className="card">
        <h3>{title}</h3>
        <div className="tw">
          <table>
            <thead><tr>{head.map((h) => (<th key={h}>{h}</th>))}</tr></thead>
            <tbody>
              {rows.length ? rows.map((r, i) => (<tr key={i}>{r.map((c, j) => (<td key={j}>{c}</td>))}</tr>)) : (<tr><td colSpan={head.length}>No data yet.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    );
    const g = (k: string) => gaRows[k] || [];
    const fmt = (rows: GaRow[]) => rows.map((r) => [...r.dims, ...r.metrics.map((n) => n.toLocaleString())]);
    const topicRows = g('topics').filter((r) => !gaCourse || r.dims[0] === gaCourse);
    const coverage = state.courses.flatMap((c) =>
      topicsFor(c.name).map((t) => [c.name, t, String(state.mcqs.filter((m) => m.course === c.name && m.topic === t).length), String(state.ratta.filter((x) => x.course === c.name && x.topic === t).length)])
    );
    return (
      <div className="flex flex-col gap-4">
        <div className="card">
          <div className="row">
            <select value={gaRange} onChange={(e) => setGaRange(e.target.value)}>
              <option value="7">Last 7 days</option>
              <option value="28">Last 28 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <select value={gaCourse} onChange={(e) => setGaCourse(e.target.value)}>
              <option value="">All courses (topic views)</option>
              {state.courses.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
            </select>
            <button type="button" className="b p" onClick={() => void loadGa()} disabled={gaLoading}>{gaLoading ? 'Loading...' : 'Refresh'}</button>
          </div>
          {gaErr && <p className="text-sm" style={{ color: 'var(--red)' }}>{gaErr}. Check the setup steps below.</p>}
        </div>
        {tbl('Where visitors come from', ['Source', 'Medium', 'Sessions', 'Users'], fmt(g('sources')))}
        {tbl('Top pages', ['Page', 'Views', 'Users'], fmt(g('pages')))}
        {tbl(gaCourse ? `Topic views in ${gaCourse}` : 'Topic views by course', ['Course', 'Topic', 'Views'], fmt(topicRows))}
        {tbl('Countries', ['Country', 'Users', 'Sessions'], fmt(g('countries')))}
        {tbl('Content in your bank', ['Course', 'Topic', 'MCQs', 'Ratta Cards'], coverage)}
        <details className="card">
          <summary className="font-bold cursor-pointer">Setup steps (Google Analytics 4 on Cloudflare Pages)</summary>
          <ol className="sub list-decimal pl-5 mt-2 space-y-1">
            <li>Create a GA4 property and copy its Measurement ID (G-XXXXXXX). Add it as NEXT_PUBLIC_GA_ID in your Cloudflare Pages build variables.</li>
            <li>In GA4 Admin, Custom definitions, create two event-scoped dimensions named course and topic.</li>
            <li>Create a Google Cloud service account, enable the Google Analytics Data API, and add its email as a Viewer on your GA4 property.</li>
            <li>In Cloudflare Pages, add secrets GA_PROPERTY_ID, GA_CLIENT_EMAIL, GA_PRIVATE_KEY, SUPABASE_URL and SUPABASE_ANON_KEY.</li>
            <li>In Supabase, mark your account as admin so only you can read these reports.</li>
          </ol>
        </details>
      </div>
    );
  };

  const renderCloud = () => {
    const mb = (b: number) => (b / 1048576).toFixed(1);
    const pct = usage ? Math.min(100, Math.round((usage.bytes / usage.limit) * 100)) : 0;
    const text =
      cloud.mode === 'off' ? 'Not connected. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart the dev server.'
      : cloud.mode === 'error' ? `Error: ${cloud.msg}`
      : cloud.role === 'admin' ? 'Connected as admin. Every change you make is saved to Supabase.'
      : cloud.role === 'user' ? 'You are signed in, but this account is not an admin, so changes are NOT saved to the cloud. Run the "make yourself admin" line from the SQL file.'
      : 'You are not signed in, so changes are NOT saved to the cloud. Sign in with your admin Google account.';
    const good = cloud.role === 'admin' && cloud.mode !== 'error';
    return (
      <div className="card mb-4">
        <h3>Cloud sync <span className={`badge ${good ? '' : 'pending'}`}>{cloud.mode === 'syncing' ? 'Syncing...' : good ? 'Connected' : 'Check this'}</span></h3>
        <p className="sub mb-3">{text}</p>
        {usage && (
          <div className="mb-3">
            <div className="flex justify-between text-xs"><span>Database storage</span><b>{mb(usage.bytes)} MB of {mb(usage.limit)} MB</b></div>
            <div className="h-2 rounded-full bg-[var(--line)] mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 70 ? 'var(--bad, #b3261e)' : 'var(--pri)' }} /></div>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <button type="button" className="b p" onClick={() => void syncFromCloud(true)}>Sync now</button>
          {cloud.role === 'admin' && (
            <>
              <button type="button" className="b" onClick={() => { if (confirm('Upload everything in this browser to Supabase? Use this once when the database is still empty.')) void pushAll().then(() => showToast('Uploaded to Supabase')); }}>Upload everything</button>
              <button type="button" className="b" onClick={() => void cloudCleanup().then((m) => showToast(m)).catch((e: Error) => showToast(e.message))}>Clean old logs</button>
            </>
          )}
          <button type="button" className="b" onClick={() => setView('ana')}>Open analytics</button>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    const activeUsers = state.users.filter((u) => u.status === 'active');
    const pendingReports = state.reports.filter((r) => r.status === 'pending');
    const maxWeekVal = Math.max(...state.week, 1);
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-4">
          <div className="stat">
            <span>Total Users</span>
            <b>{state.users.length}</b>
          </div>
          <div className="stat">
            <span>Ratta Cards</span>
            <b>{state.ratta.length}</b>
          </div>
          <div className="stat">
            <span>Active Accounts</span>
            <b>{activeUsers.length}</b>
          </div>
          <div className="stat">
            <span>MCQs in Bank</span>
            <b>{state.mcqs.length}</b>
          </div>
          <div className="stat">
            <span>Pending Reports</span>
            <b className={pendingReports.length > 0 ? 'text-[var(--amb)]' : ''}>
              {pendingReports.length}
            </b>
          </div>
          <div className="stat">
            <span>Ads Status</span>
            <b>{state.ads.on ? 'ON' : 'OFF'}</b>
          </div>
        </div>

        {renderCloud()}

        <div className="card">
          <h3>Enrolled Course Distribution</h3>
          <div className="flex flex-col gap-2">
            {state.courses.map((course) => {
              const uCount = state.users.filter((u) => u.course === course.name).length;
              const qCount = state.mcqs.filter((m) => m.course === course.name).length;
              const tCount = state.topics.filter((t) => t.courseName === course.name).length;
              return (
                <div key={course.id} className="tg">
                  <div className="flex items-center gap-2">
                    <span>{course.icon}</span>
                    <span className="font-bold">{course.name}</span>
                    <span className="badge text-[10px]">{course.badge}</span>
                  </div>
                  <span className="text-xs text-[var(--mut)]">
                    <b>{uCount}</b> users · <b>{tCount}</b> topics · <b>{qCount}</b> MCQs
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderUsers = () => {
    return (
      <div className="card">
        <div className="row">
          <input
            type="search"
            placeholder="Search name, email or course..."
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
          />
          <select
            value={userStatusFilter}
            onChange={(e) => setUserStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
          <button
            type="button"
            className="b"
            onClick={() =>
              exportCsv(
                'Users Export',
                [
                  ['Name', 'Email', 'Course', 'Status', 'Solved', 'Accuracy', 'Streak', 'MultiAccountFlag'],
                  ...state.users.map((u) => [
                    u.name,
                    u.email,
                    u.course,
                    u.status,
                    u.solved,
                    `${u.acc}%`,
                    u.streak,
                    u.multiAccountFlag ? 'YES' : 'NO',
                  ]),
                ]
              )
            }
          >
            Export CSV
          </button>
        </div>

        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Course</th>
                <th>Solved · Acc</th>
                <th>Status</th>
                <th>Security / Device</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-[var(--mut)]">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <b>{u.name}</b>
                      <small>{u.email}</small>
                    </td>
                    <td>{u.course}</td>
                    <td>
                      {u.solved} · {u.acc}%
                    </td>
                    <td>
                      <span className={`badge ${u.status}`}>{u.status}</span>
                    </td>
                    <td>
                      {u.multiAccountFlag ? (
                        <span className="badge banned" title="Multiple accounts detected on this device">
                          ⚠️ Multi-Acc
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--mut)]">Verified single</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        <button
                          type="button"
                          className="b text-xs"
                          onClick={() => {
                            setModalContent(
                              <div>
                                <h3 className="text-base font-bold mb-1">{u.name}</h3>
                                <p className="sub mb-3">
                                  {u.email} · {u.course} ·{' '}
                                  <span className={`badge ${u.status}`}>{u.status}</span>
                                </p>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                  <div className="stat p-2">
                                    <span>Solved</span>
                                    <b>{u.solved}</b>
                                  </div>
                                  <div className="stat p-2">
                                    <span>Accuracy</span>
                                    <b>{u.acc}%</b>
                                  </div>
                                  <div className="stat p-2">
                                    <span>Streak</span>
                                    <b>{u.streak}d</b>
                                  </div>
                                </div>
                                <h4 className="font-bold text-xs mb-1">Activity Log</h4>
                                <div className="feed max-h-48 overflow-y-auto mb-3">
                                  {u.acts.map((act, idx) => (
                                    <div key={idx} className="py-1 text-xs">
                                      {act[0]} <small className="text-[var(--mut)]">· {timeAgo(act[1])}</small>
                                    </div>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  className="b"
                                  onClick={() => setModalContent(null)}
                                >
                                  Close
                                </button>
                              </div>
                            );
                          }}
                        >
                          View
                        </button>
                        {u.status === 'active' ? (
                          <>
                            <button
                              type="button"
                              className="b text-xs"
                              onClick={() => {
                                updateStateAndSave(
                                  (prev) => ({
                                    ...prev,
                                    users: prev.users.map((x) =>
                                      x.id === u.id ? { ...x, status: 'suspended' } : x
                                    ),
                                  }),
                                  `Suspended user ${u.name}`
                                );
                                showToast(`${u.name} suspended`);
                              }}
                            >
                              Suspend
                            </button>
                            <button
                              type="button"
                              className="b d text-xs"
                              onClick={() => {
                                updateStateAndSave(
                                  (prev) => ({
                                    ...prev,
                                    users: prev.users.map((x) =>
                                      x.id === u.id ? { ...x, status: 'banned' } : x
                                    ),
                                  }),
                                  `Banned user ${u.name}`
                                );
                                showToast(`${u.name} banned`);
                              }}
                            >
                              Ban
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="b p text-xs"
                            onClick={() => {
                              updateStateAndSave(
                                (prev) => ({
                                  ...prev,
                                  users: prev.users.map((x) =>
                                    x.id === u.id ? { ...x, status: 'active' } : x
                                  ),
                                }),
                                `Restored user ${u.name}`
                              );
                              showToast(`${u.name} restored to active`);
                            }}
                          >
                            Restore
                          </button>
                        )}
                        <button
                          type="button"
                          className="b text-xs"
                          onClick={() => {
                            if (confirm(`Reset progress for ${u.name}?`)) {
                              updateStateAndSave(
                                (prev) => ({
                                  ...prev,
                                  users: prev.users.map((x) =>
                                    x.id === u.id
                                      ? {
                                          ...x,
                                          solved: 0,
                                          acc: 0,
                                          streak: 0,
                                          acts: [['Progress reset by admin', Date.now()], ...x.acts],
                                        }
                                      : x
                                  ),
                                }),
                                `Reset progress: ${u.name}`
                              );
                              showToast('Progress reset');
                            }
                          }}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          className="b d text-xs"
                          onClick={() => {
                            if (confirm(`Permanently delete ${u.name}?`)) {
                              updateStateAndSave(
                                (prev) => ({
                                  ...prev,
                                  users: prev.users.filter((x) => x.id !== u.id),
                                }),
                                `Deleted user ${u.name}`
                              );
                              showToast('User deleted');
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCourses = () => {
    return (
      <div className="card">
        <div className="row">
          <input
            type="text"
            placeholder="New course name (e.g. NUST NET, USAT, GAT)..."
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
          />
          <button
            type="button"
            className="b p"
            onClick={() => {
              const val = newCourseName.trim();
              if (!val) return showToast('Please enter a course name');
              if (state.courses.some((c) => c.name.toLowerCase() === val.toLowerCase())) return showToast('Course already exists');
              const newCourse: Course = {
                id: uid('c'),
                name: val,
                slug: val.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                badge: 'General',
                description: `${val} examination preparation track`,
                icon: '📚',
                color: '#2563eb',
              };
              updateStateAndSave(
                (prev) => ({ ...prev, courses: [...prev.courses, newCourse] }),
                `Added course ${val}`
              );
              setNewCourseName('');
              showToast(`Course "${val}" added`);
            }}
          >
            Add Course
          </button>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          {state.courses.map((course) => {
            const uCount = state.users.filter((u) => u.course === course.name).length;
            const qCount = state.mcqs.filter((m) => m.course === course.name).length;
            return (
              <div key={course.id} className="tg">
                <div>
                  <b className="text-base flex items-center gap-1.5">{course.name}{extras.offline?.[course.id] && <span className="badge pending">Offline</span>}</b>
                  <small>
                    {uCount} users selected · {qCount} MCQs in bank
                  </small>
                </div>
                <div className="flex gap-2 flex-wrap">
                <button type="button" className={`b ${extras.offline?.[course.id] ? 'p' : ''}`} onClick={() => setOffline(course.id, !extras.offline?.[course.id], course.name)}>{extras.offline?.[course.id] ? 'Offline: bring online' : 'Take offline'}</button>
                <button
                  type="button"
                  className="b d"
                  onClick={() => {
                    if (confirm(`Remove course ${course.name}?`)) {
                      updateStateAndSave(
                        (prev) => ({
                          ...prev,
                          courses: prev.courses.filter((c) => c.id !== course.id),
                        }),
                        `Removed course ${course.name}`
                      );
                      showToast(`Removed ${course.name}`);
                    }
                  }}
                >
                  Remove
                </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const exOf = (p: AppState): Partial<Extras> => ((p as AppState & { extras?: Partial<Extras> }).extras || {}) as Partial<Extras>;
  const patchEx = (patch: Partial<Extras>, msg: string) => updateStateAndSave((prev) => ({ ...prev, extras: { ...exOf(prev), ...patch } } as AppState), msg);
  const [mf, setMf] = useState<{ name: string; course: string; minutes: number; counts: Record<string, number> }>({ name: '', course: '', minutes: 0, counts: {} });

  const setOffline = (id: string, off: boolean, name: string) => {
    patchEx({ offline: { ...(extras.offline || {}), [id]: off } }, `${off ? 'Took offline' : 'Brought online'} course ${name}`);
    showToast(off ? `${name} is now offline` : `${name} is live`);
  };

  const subjCounts = (course: string) => {
    const m: Record<string, number> = {};
    extras.mcqSets.filter((s) => s.course === course).forEach((s) => {
      if (!s.subject) return;
      m[s.subject] = (m[s.subject] || 0) + (s.count ?? s.ids.length);
    });
    return m;
  };

  const createMonthly = (course: string, avail: Record<string, number>) => {
    if (!mf.name.trim()) return showToast('Give the monthly test a name');
    const parts = Object.keys(avail).map((s) => ({ subject: s, count: Math.floor(mf.counts[`${course}|${s}`] || 0) })).filter((p) => p.count > 0);
    if (!parts.length) return showToast('Take questions from at least one subject');
    const over = parts.find((p) => p.count > avail[p.subject]);
    if (over) return showToast(`${over.subject} has only ${avail[over.subject]} MCQs`);
    const t: MonthlyTest = { id: uid('m'), name: mf.name.trim(), course, parts, minutes: mf.minutes, live: true, created: Date.now() };
    patchEx({ monthly: [t, ...(extras.monthly || [])] }, `Created monthly test ${t.name}`);
    setMf({ name: '', course: '', minutes: 0, counts: {} });
    showToast('Monthly test created');
  };

  const renderMonthly = () => {
    const course = mf.course && state.courses.some((c) => c.name === mf.course) ? mf.course : state.courses[0]?.name || '';
    const avail = subjCounts(course);
    const subs = Object.keys(avail);
    const list = extras.monthly || [];
    return (
      <div className="flex flex-col gap-4">
        <div className="card">
          <h3>Create a monthly test</h3>
          <p className="sub mb-3">Choose a course, then how many questions to take from each subject. Students get a fresh random set every time they start it.</p>
          <div className="row">
            <input type="text" placeholder="e.g. October 2026 Monthly Test" value={mf.name} onChange={(e) => setMf({ ...mf, name: e.target.value })} />
            <select value={course} onChange={(e) => setMf({ ...mf, course: e.target.value })} aria-label="Course">
              {state.courses.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
            </select>
            <div>
              <small className="sub">Minutes (0 = untimed)</small>
              <input type="number" min={0} max={600} value={mf.minutes} onChange={(e) => setMf({ ...mf, minutes: Math.max(0, Number(e.target.value) || 0) })} />
            </div>
          </div>
          {subs.length ? subs.map((s) => (
            <div className="tg" key={s}>
              <div>{s}<small>{avail[s]} MCQs available</small></div>
              <input type="number" min={0} max={avail[s]} style={{ width: 96 }} value={mf.counts[`${course}|${s}`] || 0} onChange={(e) => setMf({ ...mf, counts: { ...mf.counts, [`${course}|${s}`]: Math.max(0, Number(e.target.value) || 0) } })} aria-label={`Questions from ${s}`} />
            </div>
          )) : <p className="sub">No MCQ files with subjects in {course || 'this course'} yet. Import MCQ JSON files first.</p>}
          <button type="button" className="b p mt-3" onClick={() => createMonthly(course, avail)}>Create monthly test</button>
        </div>
        <div className="card">
          <h3>{list.length} monthly {list.length === 1 ? 'test' : 'tests'}</h3>
          <div className="tw">
            <table>
              <thead><tr><th>Name</th><th>Course</th><th>Subjects</th><th>Questions</th><th>Time</th><th /></tr></thead>
              <tbody>
                {list.length ? list.map((m) => {
                  const a = subjCounts(m.course);
                  const short = m.parts.some((p) => p.count > (a[p.subject] || 0));
                  return (
                    <tr key={m.id}>
                      <td><b>{m.name}</b>{!m.live && <span className="badge pending ml-1">Hidden</span>}{short && <span className="badge banned ml-1">Needs more MCQs</span>}</td>
                      <td>{m.course}</td>
                      <td className="text-xs">{m.parts.map((p) => `${p.subject} ${p.count}`).join(' · ')}</td>
                      <td>{m.parts.reduce((n, p) => n + p.count, 0)}</td>
                      <td>{m.minutes ? `${m.minutes} min` : 'Untimed'}</td>
                      <td>
                        <button type="button" className="b" onClick={() => patchEx({ monthly: list.map((x) => (x.id === m.id ? { ...x, live: !x.live } : x)) }, `${m.live ? 'Hid' : 'Showed'} monthly test ${m.name}`)}>{m.live ? 'Hide' : 'Show'}</button>
                        <button type="button" className="b d" onClick={() => { if (confirm(`Delete "${m.name}"?`)) patchEx({ monthly: list.filter((x) => x.id !== m.id) }, `Deleted monthly test ${m.name}`); }}>Delete</button>
                      </td>
                    </tr>
                  );
                }) : (<tr><td colSpan={6}>No monthly tests yet.</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const [sf, setSf] = useState<Strip>(DEFAULT_STRIP);
  useEffect(() => {
    if (extras.strip) setSf({ ...DEFAULT_STRIP, ...extras.strip });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extras.strip?.v]);

  const saveStrip = (on: boolean) => {
    if (on && !sf.text.trim()) return showToast('Write the message first');
    const url = sf.linkUrl.trim();
    if (url && !/^(https?:\/\/|\/)/.test(url)) return showToast('The link must start with https:// or /');
    const next: Strip = { ...sf, on, text: sf.text.trim(), linkText: sf.linkText.trim(), linkUrl: url, v: Date.now() };
    setSf(next);
    patchEx({ strip: next }, on ? 'Published the top strip' : 'Turned the top strip off');
    showToast(on ? 'Strip is live' : 'Strip is off');
  };
  const removeStrip = () => {
    if (!confirm('Remove the top strip?')) return;
    setSf(DEFAULT_STRIP);
    patchEx({ strip: { ...DEFAULT_STRIP, v: Date.now() } }, 'Removed the top strip');
    showToast('Strip removed');
  };

  const renderStrip = () => (
    <div className="card">
      <h3>
        Top strip {extras.strip?.on ? <span className="badge">Live</span> : <span className="badge pending">Off</span>}
      </h3>
      <p className="sub mb-3">A thin bar above the header on your landing page and student pages. Use it for news, offers or notices.</p>
      {sf.text.trim() && (
        <div className="rounded-xl overflow-hidden mb-3 border border-[var(--line)]">
          <StripBar strip={{ ...sf, on: true }} />
        </div>
      )}
      <textarea className="w-full" style={{ minHeight: 60, fontFamily: 'inherit' }} maxLength={160} placeholder="Message, e.g. The October monthly test is now live" value={sf.text} onChange={(e) => setSf({ ...sf, text: e.target.value })} aria-label="Strip message" />
      <div className="row mt-2">
        <input type="text" placeholder="Button text (optional), e.g. Start now" value={sf.linkText} onChange={(e) => setSf({ ...sf, linkText: e.target.value })} />
        <input type="text" placeholder="Link, e.g. /dashboard or https://..." value={sf.linkUrl} onChange={(e) => setSf({ ...sf, linkUrl: e.target.value })} />
        <select value={sf.kind} onChange={(e) => setSf({ ...sf, kind: e.target.value as Strip['kind'] })} aria-label="Strip colour">
          <option value="info">Blue (notice)</option>
          <option value="warning">Yellow (important)</option>
          <option value="success">Green (good news)</option>
        </select>
      </div>
      {tg('Let visitors close it', 'They will see it again when you publish a new message', sf.dismissible, (v) => setSf({ ...sf, dismissible: v }))}
      {tg('Scroll the message', 'Good for long messages', sf.scroll, (v) => setSf({ ...sf, scroll: v }))}
      <div className="flex gap-2 flex-wrap mt-3">
        <button type="button" className="b p" onClick={() => saveStrip(true)}>{extras.strip?.on ? 'Update strip' : 'Publish strip'}</button>
        {extras.strip?.on && <button type="button" className="b" onClick={() => saveStrip(false)}>Turn off</button>}
        {!!extras.strip?.text && <button type="button" className="b d" onClick={removeStrip}>Remove</button>}
      </div>
    </div>
  );

  const AD_KEYS: [string, string, number][] = [['dash_top', 'Dashboard top banner', 90], ['dash_side', 'Dashboard sidebar', 250], ['mcq', 'MCQ practice page', 90], ['revision', 'Ratta Cards page', 90], ['result', 'Result page', 250], ['between', 'Between questions', 250]];
  const slotOf = (key: string, h: number): AdSlot => ({ on: false, provider: 'adsense', code: '', height: h, ...(extras.adSlots?.[key] || {}) });
  const setSlot = (key: string, h: number, patch: Partial<AdSlot>) => patchEx({ adSlots: { ...(extras.adSlots || {}), [key]: { ...slotOf(key, h), ...patch } } }, `Updated ad slot ${key}`);

  const adblock = ((state.site as unknown as { adblock?: { on: boolean; strict: boolean } }).adblock) || { on: false, strict: false };
  const setAdblock = (patch: Partial<{ on: boolean; strict: boolean }>) =>
    updateStateAndSave((prev) => ({ ...prev, site: { ...prev.site, adblock: { ...(((prev.site as unknown as { adblock?: { on: boolean; strict: boolean } }).adblock) || { on: false, strict: false }), ...patch } } } as AppState), 'Updated the ad blocker message');

  const renderAds = () => (
    <div className="flex flex-col gap-4">
      <div className="card">
        {tg('Show ads to students', 'Master switch. When off, every ad area disappears from the student pages (and the ad blocker message is switched off too)', state.ads.on, (v) =>
          updateStateAndSave((prev) => ({ ...prev, ads: { ...prev.ads, on: v }, ...(v ? {} : { site: { ...prev.site, adblock: { ...(((prev.site as unknown as { adblock?: { on: boolean; strict: boolean } }).adblock) || { on: false, strict: false }), on: false } } }) } as AppState), `Ads ${v ? 'enabled' : 'disabled'}`)
        )}
        {tg('Ask visitors to turn off their ad blocker', 'Shows a message with your picture (public/adblock.svg) when a blocker is detected. Works on every page except the Privacy Policy and admin. Only use it while ads are on.', !!adblock.on, (v) => setAdblock({ on: v && state.ads.on }))}
        {tg('Do not let visitors close the message', 'Strict mode: they must turn the blocker off to continue. Detection is not perfect, so a few visitors may be stopped by mistake.', !!adblock.strict, (v) => setAdblock({ strict: v }))}
        <details className="mt-2">
          <summary className="text-sm font-bold cursor-pointer">How to paste your ad code</summary>
          <ul className="sub list-disc pl-5 mt-2 space-y-1">
            <li>Google AdSense: paste the full ad unit code (the adsbygoogle script, the ins tag and the push script). Your site must be approved, and you need a public/ads.txt file.</li>
            <li>Adsterra: paste the full banner or native code exactly as Adsterra gives it. It runs in a protected frame, so set the height to match the banner (90 for 728x90, 250 for 300x250).</li>
            <li>Use a different provider in each slot if you like. A slot with no code, or switched off, shows nothing.</li>
          </ul>
        </details>
      </div>
      {AD_KEYS.map(([key, label, h]) => {
        const s = slotOf(key, h);
        return (
          <div className="card" key={key}>
            {tg(label, !s.on ? 'Off' : !s.code.trim() ? 'On, but no code saved yet' : state.ads.on ? 'Live' : 'Saved, waiting for the master switch', s.on, (v) => setSlot(key, h, { on: v }))}
            <div className="row mt-2">
              <select value={s.provider} onChange={(e) => setSlot(key, h, { provider: e.target.value as AdSlot['provider'] })} aria-label="Ad provider">
                <option value="adsense">Google AdSense</option>
                <option value="adsterra">Adsterra</option>
              </select>
              <input type="number" min={40} max={800} value={s.height} onChange={(e) => setSlot(key, h, { height: Math.min(800, Math.max(40, Number(e.target.value) || h)) })} aria-label="Ad height in pixels" />
            </div>
            <textarea key={`${key}-${s.provider}`} className="w-full" style={{ minHeight: 120 }} defaultValue={s.code} placeholder={s.provider === 'adsense' ? '<script async src="https://pagead2.googlesyndication.com/..."></script>\n<ins class="adsbygoogle" ...></ins>\n<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>' : '<script>atOptions = { key: "...", format: "iframe", height: 90, width: 728, params: {} };</script>\n<script src="//.../invoke.js"></script>'} onBlur={(e) => e.target.value !== s.code && setSlot(key, h, { code: e.target.value })} aria-label="Ad code" />
          </div>
        );
      })}
    </div>
  );

  const renderMcqs = () => renderBank('mcq');

  const renderRatta = () => renderBank('ratta');

  const renderReports = () => {
    return (
      <div className="card">
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Target Question</th>
                <th>Reported By</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.reports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-[var(--mut)]">
                    No reports submitted yet.
                  </td>
                </tr>
              ) : (
                state.reports.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="badge mr-2">{r.kind || 'MCQ'}</span>
                      <span className="font-semibold">{r.mcq}</span>
                      <small>{timeAgo(r.t)}</small>
                    </td>
                    <td>{r.user}</td>
                    <td>{r.reason}</td>
                    <td>
                      <span className={`badge ${r.status}`}>{r.status}</span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="b text-xs"
                          onClick={() => {
                            updateStateAndSave(
                              (prev) => ({
                                ...prev,
                                reports: prev.reports.map((x) =>
                                  x.id === r.id ? { ...x, status: 'fixed' } : x
                                ),
                              }),
                              `Report marked fixed: ${r.mcq}`
                            );
                            showToast('Marked as Fixed');
                          }}
                        >
                          Fixed
                        </button>
                        <button
                          type="button"
                          className="b text-xs"
                          onClick={() => {
                            updateStateAndSave(
                              (prev) => ({
                                ...prev,
                                reports: prev.reports.map((x) =>
                                  x.id === r.id ? { ...x, status: 'rejected' } : x
                                ),
                              }),
                              `Report rejected: ${r.mcq}`
                            );
                            showToast('Marked as Rejected');
                          }}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="b d text-xs"
                          onClick={() => {
                            updateStateAndSave(
                              (prev) => ({
                                ...prev,
                                reports: prev.reports.filter((x) => x.id !== r.id),
                              }),
                              'Deleted a report'
                            );
                            showToast('Report deleted');
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAnnouncements = () => {
    return (
      <div className="flex flex-col gap-4">
        {renderStrip()}
        <div className="card">
          <div className="row">
            <input
              type="text"
              placeholder="Announcement Title"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
            />
            <select
              value={annKind}
              onChange={(e) => setAnnKind(e.target.value as any)}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
            </select>
          </div>
          <textarea
            placeholder="Broadcast message to all students..."
            value={annMsg}
            onChange={(e) => setAnnMsg(e.target.value)}
            className="w-full min-h-[70px]"
          />
          <button
            type="button"
            className="b p mt-2.5"
            onClick={() => {
              if (!annTitle.trim() || !annMsg.trim()) {
                return showToast('Add title and message');
              }
              const newAnn = {
                id: uid('a'),
                t: annTitle.trim(),
                m: annMsg.trim(),
                k: annKind,
                d: Date.now(),
              };
              updateStateAndSave(
                (prev) => ({ ...prev, ann: [newAnn, ...prev.ann] }),
                `Published announcement: ${newAnn.t}`
              );
              setAnnTitle('');
              setAnnMsg('');
              showToast('Announcement published!');
            }}
          >
            Publish Notice
          </button>
        </div>

        <div className="card">
          <h3>Active Announcements</h3>
          <div className="flex flex-col gap-2">
            {state.ann.length === 0 ? (
              <p className="sub">Nothing currently published.</p>
            ) : (
              state.ann.map((x) => (
                <div key={x.id} className="tg">
                  <div>
                    <b>{x.t}</b> <span className={`badge ${x.k}`}>{x.k}</span>
                    <small>
                      {x.m} · {timeAgo(x.d)}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="b d"
                    onClick={() => {
                      updateStateAndSave(
                        (prev) => ({
                          ...prev,
                          ann: prev.ann.filter((a) => a.id !== x.id),
                        }),
                        `Deleted announcement: ${x.t}`
                      );
                      showToast('Announcement deleted');
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFeatures = () => {
    const flagsList = [
      ['signup', 'Open Registration', 'New students can sign up and login via Google'],
      ['streaks', 'Streaks & Daily Goals', 'Track daily consistency and study streaks'],
      ['leaderboard', 'Leaderboard Ranking', 'Display student accuracy and questions solved rank'],
      ['timed', 'Timed Tests & Mock Exams', 'Enable countdown timer on test sessions'],
      ['notes', 'Personal Notes per MCQ', 'Allow students to jot personal study notes'],
      ['bookmarks', 'Bookmarks & Favorites', 'Allow saving questions for later revision'],
      ['sharing', 'Score Card Sharing', 'Generate shareable scorecard link/image'],
      ['darkmode', 'Dark Mode for Students', 'Allow students to toggle dark theme on their portal'],
    ] as const;

    return (
      <div className="flex flex-col gap-4">
        <div className="card">
          <div className="tg">
            <div>
              <b>Maintenance Mode</b>
              <small>Users see maintenance screen instead of site</small>
            </div>
            <label className="sw">
              <input
                type="checkbox"
                checked={state.maint.on}
                onChange={(e) => {
                  const on = e.target.checked;
                  updateStateAndSave(
                    (prev) => ({ ...prev, maint: { ...prev.maint, on } }),
                    `Maintenance mode set to ${on ? 'ON' : 'OFF'}`
                  );
                  showToast(`Maintenance mode ${on ? 'Activated' : 'Deactivated'}`);
                }}
              />
              <span />
            </label>
          </div>
          <div className="row mt-3">
            <input
              type="text"
              value={state.maint.msg}
              onChange={(e) => {
                const msg = e.target.value;
                setState((prev) => ({ ...prev, maint: { ...prev.maint, msg } }));
              }}
            />
            <button
              type="button"
              className="b p"
              onClick={() => {
                updateStateAndSave(
                  (prev) => prev,
                  'Updated maintenance message'
                );
                showToast('Maintenance message updated');
              }}
            >
              Save Message
            </button>
          </div>
        </div>

        <div className="card">
          <h3>User Feature Flags</h3>
          {flagsList.map(([key, title, desc]) => (
            <div key={key} className="tg">
              <div>
                <b>{title}</b>
                <small>{desc}</small>
              </div>
              <label className="sw">
                <input
                  type="checkbox"
                  checked={state.flags[key]}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    updateStateAndSave(
                      (prev) => ({
                        ...prev,
                        flags: { ...prev.flags, [key]: checked },
                      }),
                      `Feature flag ${key} set to ${checked ? 'ON' : 'OFF'}`
                    );
                  }}
                />
                <span />
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    const q = state.quiz;
    const pr = state.prot;

    return (
      <div className="flex flex-col gap-4">
        {/* Test behavior */}
        <div className="card">
          <h3>Tests and Revision Behavior</h3>
          {[
            ['shuffleQ', 'Shuffle questions in test', 'Random question order for every test attempt'],
            ['shuffleO', 'Shuffle options (A/B/C/D)', 'Randomize choice positions to prevent memorization'],
            ['expl', 'Show explanation after answering', 'Reveal high-yield rationale upon submission'],
            ['neg', 'Negative marking', 'Deduct 0.25 marks for wrong answers (ECAT/MDCAT standard)'],
            ['retake', 'Allow instant retakes', 'Students can retake test immediately'],
            ['rself', 'Ratta card self-check', 'Show "I knew it / I did not" buttons on cards'],
          ].map(([key, title, desc]) => (
            <div key={key} className="tg">
              <div>
                <b>{title}</b>
                <small>{desc}</small>
              </div>
              <label className="sw">
                <input
                  type="checkbox"
                  checked={(q as any)[key]}
                  onChange={(e) => {
                    const val = e.target.checked;
                    updateStateAndSave((prev) => ({
                      ...prev,
                      quiz: { ...prev.quiz, [key]: val },
                    }));
                  }}
                />
                <span />
              </label>
            </div>
          ))}

          <div className="row mt-3">
            <div>
              <small className="sub">Default Questions per Test</small>
              <input
                type="number"
                min="5"
                max="200"
                value={q.qn}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 20;
                  setState((prev) => ({ ...prev, quiz: { ...prev.quiz, qn: val } }));
                }}
              />
            </div>
            <div>
              <small className="sub">Seconds per Question (0 = untimed)</small>
              <input
                type="number"
                min="0"
                max="600"
                value={q.qt}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setState((prev) => ({ ...prev, quiz: { ...prev.quiz, qt: val } }));
                }}
              />
            </div>
            <div>
              <small className="sub">Show-Answer Animation</small>
              <select
                value={q.anim}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setState((prev) => ({ ...prev, quiz: { ...prev.quiz, anim: val } }));
                }}
              >
                <option value="fade">Fade</option>
                <option value="flip">Flip</option>
                <option value="slide">Slide</option>
              </select>
            </div>
            <div>
              <small className="sub">Site Name</small>
              <input
                type="text"
                value={state.site.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setState((prev) => ({ ...prev, site: { name: val } }));
                }}
              />
            </div>
          </div>
          <button
            type="button"
            className="b p mt-2"
            onClick={() => {
              updateStateAndSave((prev) => prev, 'Updated quiz & site settings');
              showToast('Settings saved');
            }}
          >
            Save Settings
          </button>
        </div>

        {/* Content protection */}
        <div className="card">
          <h3>Content Protection &amp; Anti-Scraping</h3>
          {[
            ['api', 'Serve MCQs through API only', 'Questions live securely in database; no public raw dump file'],
            ['late', 'Reveal correct answer only after answer submitted', 'Prevents inspecting answers in devtools network tab'],
            ['rate', 'Rate-limit question requests', 'Prevents automated crawlers from dumping your bank'],
            ['noselect', 'Disable copy & right-click context menu', 'Deterrent against quick copy-pasting of question text'],
            ['wm', 'Watermark pages with user ID & email', 'Helps identify origin if screenshots are leaked'],
          ].map(([key, title, desc]) => (
            <div key={key} className="tg">
              <div>
                <b>{title}</b>
                <small>{desc}</small>
              </div>
              <label className="sw">
                <input
                  type="checkbox"
                  checked={(pr as any)[key]}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    updateStateAndSave((prev) => ({
                      ...prev,
                      prot: { ...prev.prot, [key]: checked },
                    }));
                  }}
                />
                <span />
              </label>
            </div>
          ))}
        </div>

        {/* Backup and restore */}
        <div className="card">
          <h3>Backup and Reset</h3>
          <div className="flex gap-2 flex-wrap mb-3">
            <button
              type="button"
              className="b"
              onClick={() => {
                const dump = JSON.stringify(state, null, 2);
                setModalContent(
                  <div>
                    <h3 className="text-base font-bold mb-1">Full System Backup</h3>
                    <p className="sub mb-2">Save this JSON text in a safe place.</p>
                    <textarea readOnly value={dump} className="w-full h-56 font-mono text-xs p-2 border rounded-lg" />
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        className="b p"
                        onClick={() => {
                          navigator.clipboard.writeText(dump);
                          showToast('Backup copied to clipboard!');
                        }}
                      >
                        Copy
                      </button>
                      <button type="button" className="b" onClick={() => setModalContent(null)}>
                        Close
                      </button>
                    </div>
                  </div>
                );
              }}
            >
              Export Backup
            </button>
            <button
              type="button"
              className="b d"
              onClick={() => {
                if (confirm('Reset everything to default demo data?')) {
                  const fresh = seedInitialData();
                  setState(fresh);
                  saveAppState(fresh);
                  showToast('Reset to demo data');
                }
              }}
            >
              Reset to Demo Data
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSecurity = () => {
    const sec = state.sec;

    return (
      <div className="flex flex-col gap-4">
        <div className="card">
          <h3>What protects your admin panel</h3>
          <ul className="sub list-disc pl-5 space-y-1">
            <li>Enforced by the database: Google sign-in, the admin role, the admin username and password (8-hour session, locked for 15 minutes after 5 wrong tries), bans and suspensions.</li>
            <li>Saved for reference only, because a static site cannot enforce them: session timeout, rate limit and blocked IPs. Multi-account flags are not detected yet.</li>
          </ul>
        </div>
        {/* Anti-Cheat Controls (Requested Feature) */}
        <div className="card">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="mb-0">Anti-Cheat Engine</h3>
              <p className="sub">Active exam integrity monitoring for students taking tests</p>
            </div>
            <span className="badge">Active Protection</span>
          </div>

          <div className="tg">
            <div>
              <b>Enable Tab-Switch &amp; Focus Detection</b>
              <small>Counts when student leaves browser tab or minimizes window</small>
            </div>
            <label className="sw">
              <input
                type="checkbox"
                checked={sec.antiCheat.enabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  updateStateAndSave(
                    (prev) => ({
                      ...prev,
                      sec: {
                        ...prev.sec,
                        antiCheat: { ...prev.sec.antiCheat, enabled: val },
                      },
                    }),
                    `Anti-cheat engine set to ${val ? 'ON' : 'OFF'}`
                  );
                }}
              />
              <span />
            </label>
          </div>

          <div className="tg">
            <div>
              <b>Block Copy / Cut / Paste &amp; DevTools</b>
              <small>Disables clipboard hotkeys and F12/Ctrl+Shift+I inspection</small>
            </div>
            <label className="sw">
              <input
                type="checkbox"
                checked={sec.antiCheat.blockCopy}
                onChange={(e) => {
                  const val = e.target.checked;
                  updateStateAndSave((prev) => ({
                    ...prev,
                    sec: {
                      ...prev.sec,
                      antiCheat: { ...prev.sec.antiCheat, blockCopy: val },
                    },
                  }));
                }}
              />
              <span />
            </label>
          </div>

          <div className="row mt-3">
            <div>
              <small className="sub">Max Allowed Tab Switches Before Auto-Submit</small>
              <input
                type="number"
                min="1"
                max="10"
                value={sec.antiCheat.maxTabSwitches}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 3;
                  updateStateAndSave((prev) => ({
                    ...prev,
                    sec: {
                      ...prev.sec,
                      antiCheat: { ...prev.sec.antiCheat, maxTabSwitches: val },
                    },
                  }));
                }}
              />
            </div>
          </div>
        </div>

        {/* Multi-Account Prevention (Requested Feature) */}
        <div className="card">
          <h3>Multi-Account Detection (Device Fingerprinting)</h3>
          <p className="sub mb-3">
            Prevents multiple accounts from abusing free tier resources on the same machine.
          </p>

          <div className="row">
            <div>
              <small className="sub">Max Accounts Allowed per Hardware Fingerprint</small>
              <input
                type="number"
                min="1"
                max="5"
                value={sec.multiAccount.maxAccountsPerDevice}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  updateStateAndSave((prev) => ({
                    ...prev,
                    sec: {
                      ...prev.sec,
                      multiAccount: { ...prev.sec.multiAccount, maxAccountsPerDevice: val },
                    },
                  }));
                }}
              />
            </div>
            <div>
              <small className="sub">Action When Multiple Accounts Detected</small>
              <select
                value={sec.multiAccount.action}
                onChange={(e) => {
                  const val = e.target.value as any;
                  updateStateAndSave((prev) => ({
                    ...prev,
                    sec: {
                      ...prev.sec,
                      multiAccount: { ...prev.sec.multiAccount, action: val },
                    },
                  }));
                }}
              >
                <option value="flag">Flag Account for Admin Review</option>
                <option value="block">Automatically Suspend Access</option>
              </select>
            </div>
          </div>

          <div className="mt-3">
            <h4 className="font-bold text-xs mb-1">Flagged Multi-Account Users:</h4>
            {state.users.filter((u) => u.multiAccountFlag).length === 0 ? (
              <p className="text-xs text-[var(--mut)]">No multi-account violations detected.</p>
            ) : (
              state.users
                .filter((u) => u.multiAccountFlag)
                .map((u) => (
                  <div key={u.id} className="tg py-1.5">
                    <div>
                      <span className="font-bold text-xs">{u.name}</span>{' '}
                      <small className="text-[var(--red)]">{u.email}</small>
                    </div>
                    <button
                      type="button"
                      className="b d text-xs"
                      onClick={() => {
                        updateStateAndSave(
                          (prev) => ({
                            ...prev,
                            users: prev.users.map((x) =>
                              x.id === u.id ? { ...x, status: 'suspended' } : x
                            ),
                          }),
                          `Suspended multi-account suspect ${u.name}`
                        );
                        showToast(`Suspended ${u.name}`);
                      }}
                    >
                      Suspend Account
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Session & Rate Limit */}
        <div className="card">
          <div className="tg">
            <div>
              <b>Admin username and password</b>
              <small>Always on. The database checks it on top of Google sign-in. Change it from the SQL Editor.</small>
            </div>
            <label className="sw">
              <input
                type="checkbox"
                checked
                disabled
                onChange={(e) => {
                  const val = e.target.checked;
                  updateStateAndSave((prev) => ({
                    ...prev,
                    sec: { ...prev.sec, twofa: val },
                  }));
                }}
              />
              <span />
            </label>
          </div>

          <div className="row mt-3">
            <div>
              <small className="sub">Session Timeout (Minutes)</small>
              <input
                type="number"
                min="5"
                max="1440"
                value={sec.timeout}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 30;
                  setState((prev) => ({ ...prev, sec: { ...prev.sec, timeout: val } }));
                }}
              />
            </div>
            <div>
              <small className="sub">Rate Limit (Requests / Min per IP)</small>
              <input
                type="number"
                min="10"
                max="1000"
                value={sec.rate}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 60;
                  setState((prev) => ({ ...prev, sec: { ...prev.sec, rate: val } }));
                }}
              />
            </div>
            <button
              type="button"
              className="b p"
              onClick={() => {
                updateStateAndSave((prev) => prev, 'Updated security timeouts and rates');
                showToast('Security limits saved');
              }}
            >
              Save Limits
            </button>
          </div>
        </div>

        {/* Blocked IPs */}
        <div className="card">
          <h3>Blocked IP Addresses</h3>
          <div className="row">
            <input
              type="text"
              placeholder="e.g. 203.0.113.5 or IPv6 address..."
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
            />
            <button
              type="button"
              className="b p"
              onClick={() => {
                const ip = newIp.trim();
                if (!ip) return showToast('Enter an IP address');
                if (state.sec.ips.includes(ip)) return showToast('IP already blocked');
                updateStateAndSave(
                  (prev) => ({
                    ...prev,
                    sec: { ...prev.sec, ips: [...prev.sec.ips, ip] },
                  }),
                  `Blocked IP address ${ip}`
                );
                setNewIp('');
                showToast(`Blocked IP ${ip}`);
              }}
            >
              Block IP
            </button>
          </div>

          <div className="flex flex-col gap-2 mt-3">
            {state.sec.ips.length === 0 ? (
              <p className="sub">No IP addresses currently blocked.</p>
            ) : (
              state.sec.ips.map((ip) => (
                <div key={ip} className="tg">
                  <span className="font-mono text-xs">{ip}</span>
                  <button
                    type="button"
                    className="b d"
                    onClick={() => {
                      updateStateAndSave(
                        (prev) => ({
                          ...prev,
                          sec: {
                            ...prev.sec,
                            ips: prev.sec.ips.filter((x) => x !== ip),
                          },
                        }),
                        `Unblocked IP ${ip}`
                      );
                      showToast(`Unblocked ${ip}`);
                    }}
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderLogs = () => {
    const allUserActs = state.users
      .flatMap((u) => u.acts.map((a) => ({ name: u.name, act: a[0], time: a[1] })))
      .sort((a, b) => b.time - a.time)
      .slice(0, 30);

    return (
      <div className="flex flex-col gap-4">
        <div className="card">
          <div className="row">
            <h3 className="flex-1 m-0">Admin Audit Trail</h3>
            <button
              type="button"
              className="b"
              onClick={() =>
                exportCsv(
                  'Audit Trail Export',
                  [
                    ['Action', 'Timestamp'],
                    ...state.audit.map((l) => [l.a, new Date(l.t).toISOString()]),
                  ]
                )
              }
            >
              Export CSV
            </button>
          </div>

          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {state.audit.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="text-center py-6 text-[var(--mut)]">
                      No admin actions logged yet.
                    </td>
                  </tr>
                ) : (
                  state.audit.slice(0, 40).map((l, i) => (
                    <tr key={i}>
                      <td>{l.a}</td>
                      <td className="text-xs text-[var(--mut)] whitespace-nowrap">
                        {timeAgo(l.t)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Anti-Cheat & Security Event Logs */}
        <div className="card">
          <h3>Anti-Cheat &amp; Security Violations Log</h3>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>User / IP</th>
                  <th>Violation Type</th>
                  <th>Test Session</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {state.antiCheatLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <b>{log.userEmail || 'Anonymous'}</b>
                      <small>{log.ip || 'Local Client'}</small>
                    </td>
                    <td>
                      <span className="badge banned">{log.eventType.replace('_', ' ')}</span>
                    </td>
                    <td>{log.testTitle || 'Practice'}</td>
                    <td className="text-xs text-[var(--mut)]">{timeAgo(log.t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Recent Student Activity Stream</h3>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Activity</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {allUserActs.map((act, i) => (
                  <tr key={i}>
                    <td>
                      <b>{act.name}</b>
                    </td>
                    <td>{act.act}</td>
                    <td className="text-xs text-[var(--mut)]">{timeAgo(act.time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex max-[820px]:flex-col min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <AdminNav
        currentView={view}
        onSelectView={(v) => {
          setView(v);
          window.scrollTo(0, 0);
        }}
        siteName={state.site.name}
      />

      <main className="flex-1 min-w-0 p-6 pb-16 max-w-6xl max-[820px]:p-4">
        {/* Top Header */}
        <div className="top flex justify-between items-center gap-2 mb-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight capitalize">
              {view === 'dash'
                ? 'Dashboard'
                : view === 'users'
                ? 'Users Management'
                : view === 'courses'
                ? 'Course Manager'
                : view === 'mcqs'
                ? 'MCQ Bank'
                : view === 'ratta'
                ? 'Ratta Revision Cards'
                : view === 'reports'
                ? 'Student Question Reports'
                : view === 'ads'
                ? 'Ads Monetization'
                : view === 'ann'
                ? 'Announcements & Broadcasts'
                : view === 'flags'
                ? 'Features & Maintenance'
                : view === 'set'
                ? 'Settings & Protection'
                : view === 'sec'
                ? 'Security & Anti-Cheat'
                : view === 'monthly'
                ? 'Monthly Tests'
                : view === 'ana'
                ? 'Analytics'
                : 'Audit Logs'}
            </h1>
            <p className="sub">
              {view === 'dash'
                ? 'Live overview and active analytics of SawalJar'
                : view === 'users'
                ? 'Search, inspect, suspend, ban and control every account'
                : view === 'courses'
                ? 'Organize target courses and examine question allocations'
                : view === 'mcqs'
                ? 'Bulk import from JSON files or sync via remote links'
                : view === 'ratta'
                ? 'Fill-in-the-blank revision cards for rapid recall'
                : view === 'reports'
                ? 'Review user feedback on questions to ensure 100% accuracy'
                : view === 'ads'
                ? 'Control Google AdSense and Adsterra placements'
                : view === 'ann'
                ? 'Broadcast notices to all registered students'
                : view === 'flags'
                ? 'Feature switches and maintenance mode control'
                : view === 'set'
                ? 'Test rules, content protection, and data backups'
                : view === 'sec'
                ? 'Anti-cheat limits, multi-account detection & blocked IPs'
                : view === 'monthly'
                ? 'Random tests built from each subject in a course'
                : view === 'ana'
                ? 'Traffic sources, views and topic-level engagement from Google Analytics'
                : 'Record of admin actions and student activity'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {state.maint.on && (
              <span className="badge pending font-bold">Maintenance Active</span>
            )}
            <Link href="/" className="b text-xs">
              ↗ Student Site
            </Link>
            <button
              type="button"
              className="b text-xs"
              onClick={toggleTheme}
            >
              ◐ Theme
            </button>
          </div>
        </div>

        {/* View Content */}
        {view === 'dash' && renderDashboard()}
        {view === 'users' && renderUsers()}
        {view === 'courses' && renderCourses()}
        {view === 'mcqs' && renderMcqs()}
        {view === 'ratta' && renderRatta()}
        {view === 'reports' && renderReports()}
        {view === 'ads' && renderAds()}
        {view === 'ann' && renderAnnouncements()}
        {view === 'flags' && renderFeatures()}
        {view === 'set' && renderSettings()}
        {view === 'sec' && renderSecurity()}
        {view === 'monthly' && renderMonthly()}
        {view === 'ana' && renderAnalytics()}
        {view === 'logs' && renderLogs()}
      </main>

      {/* Modal Overlay */}
      {modalContent && (
        <div className="modal-overlay" onClick={() => setModalContent(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {modalContent}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}

function AdminLogin({ email, onDone }: { email?: string; onDone: () => void }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb || busy) return;
    setBusy(true);
    setErr('');
    try {
      const r = await sb.rpc('admin_login', { p_user: u, p_pass: p });
      if (r.error) throw r.error;
      if (r.data === true) onDone();
      else setErr('Wrong username or password.');
    } catch (x) {
      setErr((x as { message?: string }).message || 'Could not sign in');
    }
    setP('');
    setBusy(false);
  };
  return (
    <div className="min-h-screen grid place-items-center bg-[var(--bg)] text-[var(--ink)] p-4">
      <form onSubmit={(e) => void submit(e)} className="card w-full max-w-sm">
        <h1 className="text-xl font-extrabold mb-1">Admin login</h1>
        <p className="sub mb-4">Signed in as {email}. Enter your admin username and password.</p>
        <input type="text" autoComplete="username" placeholder="Username" value={u} onChange={(e) => setU(e.target.value)} className="mb-2" aria-label="Username" />
        <input type="password" autoComplete="current-password" placeholder="Password" value={p} onChange={(e) => setP(e.target.value)} className="mb-3" aria-label="Password" />
        {err && <p role="alert" className="text-sm mb-3" style={{ color: 'var(--red, #c0392b)' }}>{err}</p>}
        <button type="submit" className="b p w-full" disabled={busy || !u || !p}>{busy ? 'Checking...' : 'Unlock admin'}</button>
      </form>
    </div>
  );
}

// Gate: Google sign-in + admin role (database) + admin username and password (database, 8-hour session).
// Locally, without Supabase keys, the panel opens for testing. A live site without keys stays locked.
export default function AdminPage() {
  const user = useUser();
  const { dark, toggle } = useTheme();
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const allow = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const isAdminUser = user?.role === 'admin' && (allow.length === 0 || (!!user.email && allow.includes(user.email.toLowerCase())));

  const check = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    const r = await sb.rpc('admin_is_unlocked');
    setUnlocked(r.data === true);
  }, []);
  useEffect(() => {
    if (isSupabaseConfigured && isAdminUser) void check();
  }, [isAdminUser, check]);
  useEffect(() => {
    if (!isSupabaseConfigured || !unlocked) return;
    const id = setInterval(() => void check(), 300000); // sends you back to the login when the 8 hours run out
    return () => clearInterval(id);
  }, [unlocked, check]);

  const spinner = <div className="min-h-screen grid place-items-center bg-[var(--bg)]"><div className="w-8 h-8 border-4 border-[var(--pri)] border-t-transparent rounded-full animate-spin" /></div>;
  const locked = (msg: string, link: string, label: string) => (
    <div className="min-h-screen grid place-items-center bg-[var(--bg)] text-[var(--ink)] p-6">
      <div className="card max-w-sm text-center">
        <h1 className="text-xl font-extrabold mb-2">Admins only</h1>
        <p className="sub mb-4">{msg}</p>
        <Link href={link} className="b p">{label}</Link>
      </div>
    </div>
  );

  const themeBtn = <button type="button" onClick={toggle} className="b fixed bottom-4 right-4 z-30 shadow" aria-label="Toggle dark mode">{dark ? '☀ Light' : '☾ Dark'}</button>;

  if (!isSupabaseConfigured) {
    if (process.env.NODE_ENV === 'production') return locked('Admin sign-in is not configured on this site.', '/', 'Back to home');
    return <><AdminApp />{themeBtn}</>;
  }
  if (user === undefined) return spinner;
  if (!user) return locked('Sign in with your admin Google account to continue.', '/login', 'Sign in');
  if (!isAdminUser) return locked('This account does not have admin access.', '/', 'Back to home');
  if (unlocked === null) return spinner;
  if (!unlocked) return <AdminLogin email={user.email} onDone={() => setUnlocked(true)} />;
  return (
    <>
      <AdminApp />
      <button
        type="button"
        onClick={() => {
          void getSupabase()?.rpc('admin_logout').then(() => setUnlocked(false));
        }}
        className="b fixed bottom-4 left-4 z-30 shadow"
      >
        Lock admin
      </button>
      {themeBtn}
    </>
  );
}
