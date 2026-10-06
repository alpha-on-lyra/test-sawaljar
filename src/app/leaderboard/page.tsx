'use client';

import React, { useEffect, useState } from 'react';
import StudentShell from '@/components/StudentShell';
import Avatar from '@/components/Avatar';
import { loadAppState } from '@/lib/store';
import { AppState } from '@/lib/types';
import { useUser } from '@/lib/useUser';
import { isSupabaseConfigured } from '@/lib/supabase';
import { cloudLeaderboard } from '@/lib/cloud';
import { Ic, icons, heading } from '@/lib/ui';

type Row = { id: string; name: string; email?: string; course?: string; solved: number; acc: number; streak: number; status?: string };
const short = (n: string) => {
  const p = n.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || 'Student';
};
const medal = ['var(--acc)', 'var(--line)', 'var(--t3)'];

export default function LeaderboardPage() {
  const user = useUser();
  const [st, setSt] = useState<AppState | null>(null);
  const [course, setCourse] = useState('');
  const [remote, setRemote] = useState<Row[] | null>(null);

  useEffect(() => {
    const load = () => setSt(loadAppState());
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured) void cloudLeaderboard(course).then((r) => setRemote(r as Row[] | null)).catch(() => setRemote(null));
  }, [course]);

  const off = st && (st.flags as unknown as Record<string, boolean>).leaderboard === false;
  const rows = (remote ?? ((st?.users || []) as unknown as Row[]))
    .filter((u) => u.status !== 'banned' && u.solved > 0 && (!course || u.course === course))
    .sort((a, b) => b.solved * (b.acc / 100) - a.solved * (a.acc / 100))
    .slice(0, 50);

  return (
    <StudentShell backHref="/dashboard" backLabel="Dashboard" requireAuth>
      <main className="max-w-3xl mx-auto px-3 sm:px-6 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={heading}>Leaderboard</h1>
            <p className="text-sm text-[var(--mut)]">Ranked by correct answers. Solve MCQs to climb.</p>
          </div>
          <select value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Filter by course" className="!w-auto !rounded-full !py-2 text-sm font-semibold">
            <option value="">All courses</option>
            {st?.courses.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
          </select>
        </div>
        {off ? (
          <p className="text-center py-16 text-[var(--mut)]">The leaderboard is turned off right now.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {rows.map((u, i) => {
              const me = !!user?.email && u.email?.toLowerCase() === user.email.toLowerCase();
              return (
                <li key={u.id} className={`flex items-center gap-3 p-3 sm:p-4 rounded-2xl border ${me ? 'border-[var(--pri)] bg-[var(--pri2)]' : 'border-[var(--line)] bg-[var(--card)]'}`}>
                  <span className="grid place-items-center w-8 h-8 shrink-0 rounded-full text-sm font-extrabold text-[#1a1a2e]" style={i < 3 ? { background: medal[i] } : { color: 'var(--mut)' }}>{i + 1}</span>
                  <Avatar seed={u.id || u.email || u.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate">{short(u.name)}{me && <span className="badge ml-2">You</span>}</div>
                    <div className="text-xs text-[var(--mut)] truncate">{u.course || 'No course yet'}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold" style={heading}>{u.solved} <span className="text-xs font-medium text-[var(--mut)]">solved</span></div>
                    <div className="text-xs text-[var(--mut)] inline-flex items-center gap-2"><span className="text-[var(--pri)] font-bold">{u.acc}%</span><span className="inline-flex items-center gap-0.5"><Ic className="w-3.5 h-3.5">{icons.calendar}</Ic>{u.streak}d</span></div>
                  </div>
                </li>
              );
            })}
            {rows.length === 0 && <li className="text-center py-16 text-[var(--mut)]">No one is on the board yet. Solve a few MCQs to be the first.</li>}
          </ol>
        )}
      </main>
    </StudentShell>
  );
}
