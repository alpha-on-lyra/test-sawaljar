'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import StudentShell from '@/components/StudentShell';
import Avatar from '@/components/Avatar';
import { useUser, displayName } from '@/lib/useUser';
import { getStats, resetStats, streak, emptyStats, Stats } from '@/lib/userStats';
import { isSupabaseConfigured } from '@/lib/supabase';
import { cloudMyStats } from '@/lib/cloud';
import { Ic, icons, heading, tints, focus } from '@/lib/ui';

export default function StatsPage() {
  const user = useUser();
  const uid = user?.id || user?.email || 'guest';
  const [s, setS] = useState<Stats>(emptyStats());
  useEffect(() => {
    if (!user) return;
    setS(getStats(uid));
    if (isSupabaseConfigured) void cloudMyStats().then((x) => x && setS(x)).catch(() => undefined); // the database copy is the real one
  }, [user, uid]);

  const wrong = s.attempted - s.correct;
  const pct = s.attempted ? Math.round((s.correct / s.attempted) * 100) : 0;
  const C = 2 * Math.PI * 54;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { k: d.toLocaleDateString('en-CA'), l: d.toLocaleDateString('en-GB', { weekday: 'short' }) };
  });
  const max = Math.max(1, ...days.map((d) => s.byDay[d.k]?.a || 0));
  const subjects = Object.entries(s.bySubject).sort((a, b) => b[1].a - a[1].a);
  const cards: [string, string | number, React.ReactNode][] = [
    ['Attempted', s.attempted, icons.list],
    ['Correct', s.correct, icons.check],
    ['Wrong', wrong, icons.warn],
    ['Day streak', streak(s), icons.calendar],
  ];

  return (
    <StudentShell backHref="/dashboard" backLabel="Dashboard" requireAuth>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-4">
          <Avatar seed={uid} size={64} />
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={heading}>{displayName(user)}</h1>
            <p className="text-sm text-[var(--mut)] truncate">{user?.email} · Your MCQ statistics</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map(([l, v, ic], i) => (
            <div key={l} className="bg-[var(--card)] border border-[var(--line)] rounded-[var(--r)] p-4 flex items-center gap-3">
              <span className="grid place-items-center w-11 h-11 rounded-xl text-[var(--pri)]" style={{ background: tints[i] }}><Ic className="w-6 h-6">{ic}</Ic></span>
              <div><div className="text-2xl font-bold leading-none" style={heading}>{v}</div><div className="text-xs text-[var(--mut)] mt-1">{l}</div></div>
            </div>
          ))}
        </div>

        {s.attempted === 0 ? (
          <div className="mt-6 bg-[var(--card)] border border-[var(--line)] rounded-[var(--r)] p-10 text-center">
            <p className="font-bold text-lg" style={heading}>No attempts yet</p>
            <p className="text-[var(--mut)] mt-1">Solve a few MCQs and your results will appear here.</p>
            <Link href="/dashboard" className={`mt-5 inline-flex px-6 py-2.5 rounded-full bg-[var(--pri)] text-[var(--bg)] font-semibold hover:opacity-90 ${focus}`}>Start practising</Link>
          </div>
        ) : (
          <div className="mt-6 grid md:grid-cols-[280px_1fr] gap-5">
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-[var(--r)] p-5 flex flex-col items-center">
              <h2 className="font-bold self-start" style={heading}>Accuracy</h2>
              <svg viewBox="0 0 140 140" className="w-44 h-44 mt-2" role="img" aria-label={`${pct}% correct`}>
                <circle cx="70" cy="70" r="54" fill="none" stroke="var(--line)" strokeWidth="14" />
                <circle cx="70" cy="70" r="54" fill="none" stroke="var(--pri)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(C * pct) / 100} ${C}`} transform="rotate(-90 70 70)" />
                <text x="70" y="76" textAnchor="middle" fontSize="28" fontWeight="800" fill="var(--ink)">{pct}%</text>
              </svg>
              <p className="text-sm text-[var(--mut)]">{s.correct} correct, {wrong} wrong</p>
            </div>
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-[var(--r)] p-5">
              <h2 className="font-bold" style={heading}>Last 7 days</h2>
              <svg viewBox="0 0 280 130" className="w-full mt-3" role="img" aria-label="Attempts in the last 7 days">
                {days.map((d, i) => {
                  const a = s.byDay[d.k]?.a || 0;
                  const h = (a / max) * 90;
                  return (
                    <g key={d.k}>
                      <rect x={i * 40 + 8} y={100 - h} width="24" height={h} rx="6" fill="var(--pri)" opacity={a ? 1 : 0.15} />
                      {a > 0 && <text x={i * 40 + 20} y={94 - h} textAnchor="middle" fontSize="10" fill="var(--ink)">{a}</text>}
                      <text x={i * 40 + 20} y="120" textAnchor="middle" fontSize="10" fill="var(--mut)">{d.l}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
            {subjects.length > 0 && (
              <div className="md:col-span-2 bg-[var(--card)] border border-[var(--line)] rounded-[var(--r)] p-5">
                <h2 className="font-bold mb-3" style={heading}>By subject</h2>
                <div className="flex flex-col gap-3">
                  {subjects.map(([name, b]) => (
                    <div key={name}>
                      <div className="flex justify-between text-sm"><span className="font-semibold">{name}</span><span className="text-[var(--mut)]">{b.c}/{b.a} correct</span></div>
                      <div className="h-2 rounded-full bg-[var(--line)] mt-1 overflow-hidden"><div className="h-full rounded-full bg-[var(--pri)]" style={{ width: `${Math.round((b.c / b.a) * 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {s.attempted > 0 && (
          <button type="button" onClick={() => { if (confirm('Reset all your statistics?')) { resetStats(uid); setS(emptyStats()); } }} className="mt-6 text-sm font-semibold text-[var(--mut)] hover:text-[var(--ink)] underline">Reset my statistics</button>
        )}
      </main>
    </StudentShell>
  );
}
