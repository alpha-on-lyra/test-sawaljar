'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import StudentShell from '@/components/StudentShell';
import { AdBanner } from '@/components/AdBanner';
import { ReportModal } from '@/components/ReportModal';
import { loadAppState, saveAppState, uid } from '@/lib/store';
import { submitReportToSupabase, logAntiCheatToSupabase } from '@/lib/supabase';
import { AppState, MCQ } from '@/lib/types';
import { availableFor, buildMonthly } from '@/lib/monthly';
import { extrasOf, mcqOpts, shuffle, isHidden } from '@/lib/study';
import { recordAttempt, getStats, streak } from '@/lib/userStats';
import { recordSolve } from '@/lib/accounts';
import { bumpItemStat } from '@/lib/setStats';
import { useUser, displayName } from '@/lib/useUser';
import { Ic, icons, heading, focus } from '@/lib/ui';

type Q = { m: MCQ; order: number[] };
type Extra = { yt?: string[]; pdf?: string[] };
const fmt = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

function PracticeInner() {
  const sp = useSearchParams();
  const course = sp.get('course') || '';
  const topic = sp.get('topic') || '';
  const setId = sp.get('set') || '';
  const monthlyId = sp.get('monthly') || '';
  const user = useUser();
  const uidStr = user?.id || user?.email || 'guest';

  const [st, setSt] = useState<AppState | null>(null);
  const [phase, setPhase] = useState<'intro' | 'run' | 'done'>('intro');
  const [qs, setQs] = useState<Q[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [left, setLeft] = useState(0);
  const [reportQ, setReportQ] = useState<MCQ | null>(null);
  const [warn, setWarn] = useState('');
  const [ended, setEnded] = useState('');
  const switches = useRef(0);

  useEffect(() => {
    const load = () => setSt(loadAppState());
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  const ex = st ? extrasOf(st) : {};
  const opts = st ? mcqOpts(st) : null;
  const test = (ex.monthly || []).find((t) => t.id === monthlyId && t.live !== false);
  const set = (ex.mcqSets || []).find((s) => s.id === setId);
  const subjMap = useMemo(() => {
    const m: Record<string, string> = {};
    (extrasOf(st || ({} as AppState)).mcqSets || []).forEach((s) => s.ids.forEach((id) => s.subject && (m[id] = s.subject)));
    return m;
  }, [st]);

  const pool = useCallback((): MCQ[] => {
    if (!st) return [];
    const ok = (m: MCQ) => !isHidden(m);
    if (monthlyId) return test ? buildMonthly(st, test).filter(ok) : [];
    if (setId) {
      const ids = new Set(set?.ids || []);
      return st.mcqs.filter((m) => ids.has(m.id) && ok(m));
    }
    return []; // tests only start from a topic file or a monthly test
  }, [st, monthlyId, test, setId, set, course, topic]);

  const total = !st ? 0 : monthlyId ? (test ? test.parts.reduce((n, p) => n + Math.min(p.count, availableFor(st, test.course, p.subject)), 0) : 0) : pool().length;
  const title = monthlyId ? test?.name || 'Monthly test' : set?.name || topic || course || 'Practice';
  const count = monthlyId ? total : Math.min(total, opts?.perSession || total);
  const exam = !!test || (opts?.secPerQ || 0) > 0;
  const timedTotal = !!test && test.minutes > 0;
  const timedEach = !test && (opts?.secPerQ || 0) > 0;
  const ac = (st?.sec as unknown as { antiCheat?: { enabled: boolean; maxTabSwitches: number; blockCopy: boolean; enforceFullscreen: boolean } } | undefined)?.antiCheat;

  const finish = useCallback((why = '') => {
    setEnded(why);
    setPhase('done');
    if (document.fullscreenElement) void document.exitFullscreen?.();
  }, []);

  const start = () => {
    if (!st || !opts) return;
    let items = pool();
    if (opts.shuffleQ && !test) items = shuffle(items);
    items = test ? items : items.slice(0, opts.perSession || items.length);
    if (!items.length) return;
    setQs(items.map((m) => ({ m, order: opts.shuffleO ? shuffle(m.o.map((_, k) => k)) : m.o.map((_, k) => k) })));
    setI(0);
    setPicked({});
    setWarn('');
    setEnded('');
    switches.current = 0;
    setLeft(timedTotal ? (test?.minutes || 0) * 60 : opts.secPerQ);
    setPhase('run');
    if (exam && ac?.enabled && ac.enforceFullscreen) void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  const cur = qs[i];
  const pick = cur ? picked[cur.m.id] : undefined;
  const answered = pick !== undefined;

  const answer = useCallback((di: number) => {
    const q = qs[i];
    if (!q || picked[q.m.id] !== undefined) return;
    const ok = di >= 0 && q.order[di] === q.m.a;
    setPicked((p) => ({ ...p, [q.m.id]: di }));
    recordAttempt(uidStr, ok, subjMap[q.m.id] || 'General');
    bumpItemStat(q.m.id, 'attempts');
    recordSolve(user?.email, ok, streak(getStats(uidStr)));
  }, [qs, i, picked, uidStr, user, subjMap]);

  const next = () => (i < qs.length - 1 ? setI(i + 1) : finish());

  // timers
  useEffect(() => {
    if (phase !== 'run' || !(timedTotal || timedEach)) return;
    const id = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(id);
  }, [phase, timedTotal, timedEach]);
  useEffect(() => {
    if (phase === 'run' && timedEach && opts) setLeft(opts.secPerQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, phase]);
  useEffect(() => {
    if (phase !== 'run' || left > 0) return;
    if (timedTotal) finish('Time is up');
    else if (timedEach && !answered) answer(-1);
  }, [left, phase, timedTotal, timedEach, answered, answer, finish]);
  useEffect(() => {
    if (phase === 'run' && cur) bumpItemStat(cur.m.id, 'views');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, phase]);

  // light anti-cheat for exams (monthly tests and timed sessions), driven by the admin Security settings
  useEffect(() => {
    if (phase !== 'run' || !exam || !ac?.enabled) return;
    const log = (eventType: string) => {
      const c = loadAppState();
      const entry = { id: uid('ac'), userEmail: user?.email, eventType, testTitle: title, t: Date.now() };
      saveAppState({ ...c, antiCheatLogs: [entry, ...c.antiCheatLogs].slice(0, 300) } as AppState);
      void logAntiCheatToSupabase({ eventType, testTitle: title, userEmail: user?.email });
    };
    const vis = () => {
      if (!document.hidden) return;
      switches.current += 1;
      log('tab_switch');
      const remaining = (ac.maxTabSwitches ?? 3) - switches.current;
      if (remaining < 0) finish('Session ended: too many tab switches');
      else setWarn(`Please stay on this tab. ${remaining} warning${remaining === 1 ? '' : 's'} left.`);
    };
    const fs = () => {
      if (ac.enforceFullscreen && !document.fullscreenElement) {
        log('fullscreen_exit');
        setWarn('Please stay in fullscreen during the test.');
      }
    };
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('visibilitychange', vis);
    document.addEventListener('fullscreenchange', fs);
    const evs = ac.blockCopy ? ['copy', 'cut', 'contextmenu', 'selectstart'] : [];
    evs.forEach((e) => document.addEventListener(e, block));
    return () => {
      document.removeEventListener('visibilitychange', vis);
      document.removeEventListener('fullscreenchange', fs);
      evs.forEach((e) => document.removeEventListener(e, block));
    };
  }, [phase, exam, ac, title, user, finish]);

  // keyboard: 1-4 or A-D to answer, Enter or right arrow for next
  useEffect(() => {
    if (phase !== 'run' || reportQ) return;
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA' || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      const di = '1234'.includes(k) && k ? Number(k) - 1 : 'abcd'.indexOf(k);
      if (k.length === 1 && di >= 0 && cur && di < cur.order.length) answer(di);
      else if ((k === 'enter' || k === 'arrowright') && answered) next();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const submitReport = (reason: string) => {
    if (!reportQ) return;
    const r = { id: uid('r'), mcq: reportQ.q, kind: 'MCQ' as const, user: displayName(user), reason, status: 'pending' as const, t: Date.now() };
    const c = loadAppState();
    saveAppState({ ...c, reports: [r, ...c.reports] });
    void submitReportToSupabase(r);
  };

  const correct = qs.filter((q) => picked[q.m.id] !== undefined && picked[q.m.id] >= 0 && q.order[picked[q.m.id]] === q.m.a).length;
  const wrong = qs.filter((q) => picked[q.m.id] !== undefined && !(picked[q.m.id] >= 0 && q.order[picked[q.m.id]] === q.m.a)).length;
  const score = correct - (opts?.negMark ? wrong * 0.25 : 0);
  const pct = qs.length ? Math.round((correct / qs.length) * 100) : 0;
  const C = 2 * Math.PI * 54;

  const card = 'bg-[var(--card)] border border-[var(--line)] rounded-[var(--r)]';
  const btnP = `inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-[var(--pri)] text-[var(--bg)] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 ${focus}`;
  const btnS = `inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[var(--card)] border border-[var(--line)] font-semibold hover:border-[var(--pri)] transition-colors disabled:opacity-40 ${focus}`;

  return (
    <StudentShell backHref="/dashboard" backLabel="Dashboard" requireAuth>
      <main className="max-w-3xl mx-auto px-3 sm:px-6 py-6">
        <AdBanner placement="mcq" />
        {!st ? null : phase === 'intro' ? (
          <div className={`${card} p-6 sm:p-8 text-center`}>
            <span className="mx-auto mb-4 grid place-items-center w-14 h-14 rounded-2xl bg-[var(--pri2)] text-[var(--pri)]"><Ic className="w-7 h-7">{icons.list}</Ic></span>
            <h1 className="text-2xl font-bold" style={heading}>{title}</h1>
            {set && <p className="text-sm text-[var(--mut)] mt-1">{set.subject ? `${set.subject} › ` : ''}{set.topic}</p>}
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-semibold">
              <span className="badge">{count} questions</span>
              {timedTotal && <span className="badge">{test?.minutes} min</span>}
              {timedEach && <span className="badge">{opts?.secPerQ}s per question</span>}
              {opts?.negMark && <span className="badge pending">Negative marking</span>}
              {exam && ac?.enabled && <span className="badge pending">Exam mode: stay on this tab</span>}
            </div>
            {!setId && !monthlyId ? (
              <p className="mt-6 text-[var(--mut)]">Open a test from a topic on your dashboard to start.</p>
            ) : monthlyId && !test ? (
              <p className="mt-6 text-[var(--mut)]">This monthly test is not available right now.</p>
            ) : count === 0 ? (
              <p className="mt-6 text-[var(--mut)]">There are no questions here yet. Please check back soon.</p>
            ) : (
              <button type="button" onClick={start} className={`${btnP} mt-6`}>Start<Ic className="w-4 h-4">{icons.arrow}</Ic></button>
            )}
            <div className="mt-4"><Link href="/dashboard" className="text-sm font-semibold text-[var(--mut)] hover:text-[var(--ink)]">Back to dashboard</Link></div>
          </div>
        ) : phase === 'run' && cur ? (
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="truncate pr-3">{title}</span>
                <span className="flex items-center gap-3 shrink-0">
                  {(timedTotal || timedEach) && !answered && <span className={`inline-flex items-center gap-1 ${left <= 10 ? 'text-[var(--bad)]' : 'text-[var(--mut)]'}`}><Ic className="w-4 h-4">{icons.clock}</Ic>{fmt(left)}</span>}
                  <span className="text-[var(--mut)]">{i + 1} / {qs.length}</span>
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[var(--line)] overflow-hidden"><div className="h-full rounded-full bg-[var(--pri)] transition-all" style={{ width: `${((i + (answered ? 1 : 0)) / qs.length) * 100}%` }} /></div>
            </div>
            {warn && <div role="alert" className="px-4 py-3 rounded-xl text-sm font-semibold border border-[var(--bad)] bg-[var(--badbg)] text-[var(--bad)]">{warn}</div>}

            <div className={`${card} p-5 sm:p-6`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge">{subjMap[cur.m.id] ? `${subjMap[cur.m.id]} › ` : ''}{cur.m.topic}</span>
                  <span className="badge pending">{cur.m.src ? `Past paper: ${cur.m.src}` : 'Chances'}</span>
                </div>
                <button type="button" onClick={() => setReportQ(cur.m)} className={`inline-flex items-center gap-1 font-semibold text-[var(--mut)] hover:text-[var(--bad)] ${focus}`}><Ic className="w-4 h-4">{icons.flag}</Ic>Report</button>
              </div>
              <h2 className="mt-4 text-lg sm:text-xl font-bold leading-snug select-text" style={heading}>{cur.m.q}</h2>
              <div className="mt-5 flex flex-col gap-2.5" role="group" aria-label="Answer options">
                {cur.order.map((oi, di) => {
                  const good = oi === cur.m.a;
                  const cls = answered ? (good ? 'border-[var(--ok)] bg-[var(--okbg)]' : di === pick ? 'border-[var(--bad)] bg-[var(--badbg)]' : 'border-[var(--line)] bg-[var(--bg)] opacity-70') : 'border-[var(--line)] bg-[var(--bg)] hover:border-[var(--pri)]';
                  return (
                    <button key={di} type="button" disabled={answered} onClick={() => answer(di)} className={`w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl border transition-colors ${cls} ${focus}`}>
                      <span className={`grid place-items-center w-7 h-7 shrink-0 rounded-full text-xs font-bold ${answered && good ? 'bg-[var(--ok)] text-[var(--bg)]' : answered && di === pick ? 'bg-[var(--bad)] text-[var(--bg)]' : 'bg-[var(--card)] text-[var(--mut)] border border-[var(--line)]'}`}>{'ABCD'[di] || di + 1}</span>
                      <span className="min-w-0 break-words">{cur.m.o[oi]}</span>
                      {answered && good && <span className="ml-auto text-[var(--ok)]"><Ic>{icons.check}</Ic></span>}
                    </button>
                  );
                })}
              </div>

              {answered && (
                <div className="mt-5 pt-4 border-t border-[var(--line)] flex flex-col gap-3">
                  <p className={`font-bold ${pick === -1 ? 'text-[var(--mut)]' : cur.order[pick] === cur.m.a ? 'text-[var(--ok)]' : 'text-[var(--bad)]'}`}>
                    {pick === -1 ? 'Time is up for this question.' : cur.order[pick] === cur.m.a ? 'Correct' : 'Not quite'}
                  </p>
                  {opts?.showExp && cur.m.exp && <p className="text-sm text-[var(--mut)] leading-relaxed">{cur.m.exp}</p>}
                  {([...(((cur.m as unknown as Extra).yt) || []).map((u) => ['yt', u]), ...(((cur.m as unknown as Extra).pdf) || []).map((u) => ['pdf', u])] as [string, string][]).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {([...(((cur.m as unknown as Extra).yt) || []).map((u) => ['yt', u]), ...(((cur.m as unknown as Extra).pdf) || []).map((u) => ['pdf', u])] as [string, string][]).map(([k, u]) => (
                        <a key={u} href={u} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-[var(--line)] hover:opacity-80 ${focus}`} style={k === 'yt' ? { background: 'var(--ybg)', color: 'var(--yfg)' } : { background: 'var(--pbg)', color: 'var(--pfg)' }}>
                          <Ic className="w-4 h-4">{k === 'yt' ? icons.play : icons.pdf}</Ic>{k === 'yt' ? 'Watch a video' : 'Read the notes'}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {answered && (i + 1) % 5 === 0 && <AdBanner placement="between" />}
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => setI(i - 1)} disabled={i === 0} className={btnS}><Ic className="w-4 h-4">{icons.left}</Ic>Previous</button>
              <button type="button" onClick={() => finish()} className="text-sm font-semibold text-[var(--mut)] hover:text-[var(--ink)]">End test</button>
              <button type="button" onClick={next} disabled={!answered} className={btnP}>{i === qs.length - 1 ? 'Finish' : 'Next'}<Ic className="w-4 h-4">{icons.right}</Ic></button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className={`${card} p-6 sm:p-8 text-center`}>
              <h1 className="text-2xl font-bold" style={heading}>{ended || 'Test complete'}</h1>
              <p className="text-sm text-[var(--mut)] mt-1">{title}</p>
              <svg viewBox="0 0 140 140" className="w-40 h-40 mx-auto mt-4" role="img" aria-label={`${pct}% correct`}>
                <circle cx="70" cy="70" r="54" fill="none" stroke="var(--line)" strokeWidth="14" />
                <circle cx="70" cy="70" r="54" fill="none" stroke="var(--pri)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(C * pct) / 100} ${C}`} transform="rotate(-90 70 70)" />
                <text x="70" y="77" textAnchor="middle" fontSize="28" fontWeight="800" fill="var(--ink)">{pct}%</text>
              </svg>
              <div className="mt-4 grid grid-cols-3 gap-3 max-w-sm mx-auto text-center">
                {([['Correct', correct], ['Wrong', wrong], ['Skipped', qs.length - correct - wrong]] as [string, number][]).map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-[var(--bg)] border border-[var(--line)] py-3"><div className="text-xl font-bold" style={heading}>{v}</div><div className="text-xs text-[var(--mut)]">{l}</div></div>
                ))}
              </div>
              {opts?.negMark && <p className="mt-3 text-sm text-[var(--mut)]">Score with negative marking: <b>{score.toFixed(2)}</b></p>}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {opts?.retake !== false && <button type="button" onClick={start} className={btnP}>Try again</button>}
                <Link href="/dashboard" className={btnS}>Dashboard</Link>
              </div>
            </div>
            <AdBanner placement="result" />
            {wrong > 0 && (
              <div className={`${card} p-5`}>
                <h2 className="font-bold mb-3" style={heading}>Review your mistakes</h2>
                <div className="flex flex-col gap-3">
                  {qs.filter((q) => picked[q.m.id] !== undefined && !(picked[q.m.id] >= 0 && q.order[picked[q.m.id]] === q.m.a)).map((q) => (
                    <div key={q.m.id} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 text-sm">
                      <p className="font-semibold">{q.m.q}</p>
                      <p className="mt-1 text-[var(--ok)]">Correct answer: {q.m.o[q.m.a]}</p>
                      {picked[q.m.id] >= 0 && <p className="text-[var(--bad)]">Your answer: {q.m.o[q.order[picked[q.m.id]]]}</p>}
                      {q.m.exp && <p className="mt-1 text-[var(--mut)]">{q.m.exp}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      {reportQ && <ReportModal isOpen questionText={reportQ.q} kind="MCQ" onClose={() => setReportQ(null)} onSubmit={submitReport} />}
    </StudentShell>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm font-semibold text-[var(--mut)]">Loading...</div>}>
      <PracticeInner />
    </Suspense>
  );
}
