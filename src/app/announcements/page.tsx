'use client';

import React, { useEffect, useState } from 'react';
import { loadAppState, seedInitialData } from '@/lib/store';
import { AppState } from '@/lib/types';
import StudentShell from '@/components/StudentShell';
import { Ic, icons, heading, tints } from '@/lib/ui';

type Ann = { id: string; t: string; m: string; k: string; d?: number };
const KINDS: Record<string, { label: string; icon: React.ReactNode; tint: string }> = {
  info: { label: 'Notice', icon: icons.info, tint: tints[0] },
  warning: { label: 'Important', icon: icons.warn, tint: tints[1] },
  success: { label: 'Good news', icon: icons.check, tint: tints[2] },
};

export default function AnnouncementsPage() {
  const [st, setSt] = useState<AppState | null>(null);
  const [seen, setSeen] = useState(0);
  const [kind, setKind] = useState('');

  useEffect(() => {
    const load = () => {
      let s = loadAppState();
      if (!s || s.courses.length === 0) {
        seedInitialData();
        s = loadAppState();
      }
      setSt(s);
      const newest = Math.max(0, ...(((s?.ann || []) as Ann[]).map((a) => a.d || 0)));
      try {
        setSeen(Number(localStorage.getItem('sj_ann_seen')) || 0);
        localStorage.setItem('sj_ann_seen', String(newest));
      } catch {
        // storage unavailable
      }
    };
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  if (!st) return null;
  const all = (st.ann || []) as Ann[];
  const list = all.filter((a) => !kind || a.k === kind);

  return (
    <StudentShell backHref="/dashboard" backLabel="Dashboard" requireAuth>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={heading}>Announcements</h1>
        <p className="mt-2 text-[var(--mut)]">News and updates from the SawalJar team.</p>
        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter announcements">
          {[['', 'All'], ['info', 'Notices'], ['warning', 'Important'], ['success', 'Good news']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setKind(v)} aria-pressed={kind === v} className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${kind === v ? 'bg-[var(--pri)] text-[var(--bg)] border-[var(--pri)]' : 'bg-[var(--card)] border-[var(--line)] hover:border-[var(--pri)]'}`}>{l}</button>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-4">
          {list.map((a) => {
            const k = KINDS[a.k] || KINDS.info;
            const fresh = (a.d || 0) > seen;
            return (
              <article key={a.id} className="bg-[var(--card)] border border-[var(--line)] rounded-[var(--r)] p-5 flex gap-4">
                <span className="grid place-items-center w-11 h-11 shrink-0 rounded-2xl text-[var(--pri)]" style={{ background: k.tint }}><Ic className="w-6 h-6">{k.icon}</Ic></span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--mut)]">
                    <span className="font-bold">{k.label}</span>
                    {a.d && <time dateTime={new Date(a.d).toISOString()}>{new Date(a.d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time>}
                    {fresh && <span className="px-2 py-0.5 rounded-full bg-[var(--acc)] text-[var(--ink)] font-extrabold">New</span>}
                  </div>
                  <h2 className="mt-1 text-lg font-bold" style={heading}>{a.t}</h2>
                  <p className="mt-1 text-[15px] text-[var(--mut)] whitespace-pre-line break-words">{a.m}</p>
                </div>
              </article>
            );
          })}
          {list.length === 0 && (
            <div className="text-center py-16 text-[var(--mut)]">
              <span className="mx-auto mb-3 grid place-items-center w-14 h-14 rounded-2xl bg-[var(--pri2)] text-[var(--pri)]"><Ic className="w-7 h-7">{icons.bell}</Ic></span>
              {all.length ? 'No announcements in this category.' : 'No announcements yet. Check back soon.'}
            </div>
          )}
        </div>
      </main>
    </StudentShell>
  );
}
