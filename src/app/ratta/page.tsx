'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import StudentShell from '@/components/StudentShell';
import { AdBanner } from '@/components/AdBanner';
import { ReportModal } from '@/components/ReportModal';
import { loadAppState, saveAppState, uid } from '@/lib/store';
import { submitReportToSupabase } from '@/lib/supabase';
import { AppState, RattaCard } from '@/lib/types';
import { extrasOf, rattaOpts, shuffle, isHidden } from '@/lib/study';
import { loadCards, isLinkSet, qkey } from '@/lib/bank';
import { AnswerBatcher, recoverPending } from '@/lib/batch';
import { useUser, displayName } from '@/lib/useUser';
import { Ic, icons, heading, focus } from '@/lib/ui';

type Extra = { exp?: string; yt?: string[]; pdf?: string[] };

function RattaInner() {
  const sp = useSearchParams();
  const course = sp.get('course') || '';
  const topic = sp.get('topic') || '';
  const setId = sp.get('set') || '';
  const user = useUser();

  const [st, setSt] = useState<AppState | null>(null);
  const [phase, setPhase] = useState<'intro' | 'run' | 'done'>('intro');
  const [deck, setDeck] = useState<RattaCard[]>([]);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [known, setKnown] = useState<Record<string, boolean>>({});
  const [reportCard, setReportCard] = useState<RattaCard | null>(null);
  const [remote, setRemote] = useState<RattaCard[] | null>(null);
  const [loadErr, setLoadErr] = useState('');
  // Nothing is sent to Supabase while the student revises. Results go in ONE request when the session ends.
  const batch = useRef<AnswerBatcher | null>(null);
  const getBatch = () => (batch.current ??= new AnswerBatcher('ratta', course));

  useEffect(() => {
    const load = () => setSt(loadAppState());
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  const opts = st ? rattaOpts(st) : null;
  const set = st ? (extrasOf(st).rattaSets || []).find((s) => s.id === setId) : undefined;
  const link = isLinkSet(set);
  // The file is opened from its link only now, because the student pressed Revise
  useEffect(() => {
    if (!set || !link) return;
    let on = true;
    setRemote(null);
    setLoadErr('');
    loadCards(set).then((x) => on && setRemote(x)).catch((e: Error) => on && setLoadErr(e.message || 'Could not load the cards'));
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, link, set?.url]);

  const pool = (): RattaCard[] => {
    if (!st) return [];
    if (setId) {
      if (link) return (remote || []).filter((c) => !isHidden(c));
      const ids = new Set(set?.ids || []);
      return st.ratta.filter((c) => ids.has(c.id) && !isHidden(c));
    }
    return []; // cards only start from a topic file
  };
  const title = set?.name || topic || course || 'Ratta Cards';
  const total = pool().length;
  const count = Math.min(total, opts?.perSession || total);

  const begin = (cards: RattaCard[]) => {
    if (!cards.length) return;
    setDeck(cards);
    setI(0);
    setShown(false);
    setKnown({});
    setPhase('run');
    if (setId) getBatch().view(setId);
  };
  const start = () => begin((opts?.shuffle ? shuffle(pool()) : pool()).slice(0, opts?.perSession || undefined));

  const card = deck[i];
  const extra = (card as unknown as Extra | undefined) || {};
  const doneCount = Object.keys(known).length;
  const mastered = Object.values(known).filter(Boolean).length;
  const missed = deck.filter((c) => known[c.id] === false);

  const record = (c: RattaCard, ok: boolean) => {
    const sid = c.id.includes(':') ? c.id.split(':')[0] : setId;
    if (sid) getBatch().add({ s: sid, j: set?.subject || 'General', k: qkey(c.q), ok }); // kept here until the session ends
  };
  // Leaving the page mid-session: whatever is left is sent once, after leaving (never while revising)
  useEffect(
    () => () => {
      const b = batch.current;
      if (b) {
        b.release();
        void recoverPending();
      }
    },
    []
  );

  const advance = () => {
    setShown(false);
    if (i < deck.length - 1) setI(i + 1);
    else {
      void getBatch().flush();
      setPhase('done');
    }
  };
  const reveal = () => {
    setShown(true);
    if (card && !opts?.selfCheck) record(card, true);
  };
  const mark = (knew: boolean) => {
    if (!card) return;
    setKnown((k) => ({ ...k, [card.id]: knew }));
    record(card, knew);
    advance();
  };

  useEffect(() => {
    if (phase !== 'run' || reportCard) return;
    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      if (!shown && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        reveal();
      } else if (shown && opts?.selfCheck && (e.key === '1' || e.key === 'ArrowRight')) mark(true);
      else if (shown && opts?.selfCheck && (e.key === '2' || e.key === 'ArrowLeft')) mark(false);
      else if (shown && !opts?.selfCheck && (e.key === 'Enter' || e.key === 'ArrowRight')) advance();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const submitReport = (reason: string) => {
    if (!reportCard) return;
    const r = { id: uid('r'), mcq: reportCard.q, kind: 'Ratta' as const, user: displayName(user), reason, status: 'pending' as const, t: Date.now() };
    const c = loadAppState();
    saveAppState({ ...c, reports: [r, ...c.reports] });
    void submitReportToSupabase(r);
  };

  const box = 'bg-[var(--card)] border border-[var(--line)] rounded-[var(--r)]';
  const btnP = `inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-[var(--pri)] text-[var(--bg)] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 ${focus}`;
  const btnS = `inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[var(--card)] border border-[var(--line)] font-semibold hover:border-[var(--pri)] transition-colors disabled:opacity-40 ${focus}`;
  const parts = card ? card.q.split(/_{3,}/) : [];
  const links: [string, string][] = [...(extra.yt || []).map((u): [string, string] => ['yt', u]), ...(extra.pdf || []).map((u): [string, string] => ['pdf', u])];

  return (
    <StudentShell backHref="/dashboard" backLabel="Dashboard" requireAuth>
      <style>{`.rc-fade{animation:rcf .28s ease both}.rc-slide{animation:rcs .28s ease both}.rc-flip{animation:rcp .34s ease both}@keyframes rcf{from{opacity:0}}@keyframes rcs{from{opacity:0;transform:translateX(24px)}}@keyframes rcp{from{opacity:0;transform:rotateX(70deg)}}@media (prefers-reduced-motion:reduce){.rc-fade,.rc-slide,.rc-flip{animation:none}}`}</style>
      <main className="max-w-2xl mx-auto px-3 sm:px-6 py-6">
        <AdBanner placement="revision" />
        {!st ? null : phase === 'intro' ? (
          <div className={`${box} p-6 sm:p-8 text-center`}>
            <span className="mx-auto mb-4 grid place-items-center w-14 h-14 rounded-2xl bg-[var(--pri2)] text-[var(--pri)]"><Ic className="w-7 h-7">{icons.cards}</Ic></span>
            <h1 className="text-2xl font-bold" style={heading}>{title}</h1>
            {set && <p className="text-sm text-[var(--mut)] mt-1">{set.subject ? `${set.subject} › ` : ''}{set.topic}</p>}
            <p className="mt-3 text-[var(--mut)] max-w-sm mx-auto">Read the card, say the missing word in your head, then tap Show answer.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2"><span className="badge">{count} cards</span>{opts?.shuffle && <span className="badge">Shuffled</span>}</div>
            {!setId ? <p className="mt-6 text-[var(--mut)]">Open a card file from a topic on your dashboard to start.</p> : link && !remote ? <p className="mt-6 text-[var(--mut)]">{loadErr || 'Loading cards...'}</p> : count === 0 ? <p className="mt-6 text-[var(--mut)]">There are no cards here yet. Please check back soon.</p> : <button type="button" onClick={start} className={`${btnP} mt-6`}>Start revising<Ic className="w-4 h-4">{icons.arrow}</Ic></button>}
            <div className="mt-4"><Link href="/dashboard" className="text-sm font-semibold text-[var(--mut)] hover:text-[var(--ink)]">Back to dashboard</Link></div>
          </div>
        ) : phase === 'run' && card ? (
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between text-sm font-semibold"><span className="truncate pr-3">{title}</span><span className="text-[var(--mut)] shrink-0">{i + 1} / {deck.length}</span></div>
              <div className="mt-2 h-2 rounded-full bg-[var(--line)] overflow-hidden"><div className="h-full rounded-full bg-[var(--pri)] transition-all" style={{ width: `${(i / deck.length) * 100}%` }} /></div>
            </div>
            <div key={card.id} className={`${box} p-5 sm:p-7 min-h-[280px] flex flex-col justify-between rc-${opts?.anim || 'fade'}`}>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2"><span className="badge">{card.topic}</span><span className="badge pending">{card.src ? `Past paper: ${card.src}` : 'Chances'}</span></div>
                  <button type="button" onClick={() => setReportCard(card)} className={`inline-flex items-center gap-1 font-semibold text-[var(--mut)] hover:text-[var(--bad)] ${focus}`}><Ic className="w-4 h-4">{icons.flag}</Ic>Report</button>
                </div>
                <p className="mt-6 text-xl sm:text-2xl leading-relaxed font-semibold" style={heading}>
                  {parts.map((p, k) => (
                    <React.Fragment key={k}>
                      {p}
                      {k < parts.length - 1 && (
                        <span className={`inline-block align-baseline min-w-[110px] mx-1 px-2 text-center rounded-lg transition-all duration-300 ${shown ? 'bg-[var(--pri2)] text-[var(--pri)]' : 'border-b-2 border-dashed border-[var(--mut)] text-transparent select-none'}`}>{card.a}</span>
                      )}
                    </React.Fragment>
                  ))}
                </p>
                {shown && parts.length < 2 && <p className="mt-4 text-lg font-bold text-[var(--pri)]">{card.a}</p>}
                {shown && extra.exp && <p className="mt-4 text-sm text-[var(--mut)] leading-relaxed">{extra.exp}</p>}
                {shown && links.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {links.map(([k, u]) => (
                      <a key={u} href={u} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-[var(--line)] hover:opacity-80 ${focus}`} style={k === 'yt' ? { background: 'var(--ybg)', color: 'var(--yfg)' } : { background: 'var(--pbg)', color: 'var(--pfg)' }}>
                        <Ic className="w-4 h-4">{k === 'yt' ? icons.play : icons.pdf}</Ic>{k === 'yt' ? 'Watch a video' : 'Read the notes'}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-6 pt-4 border-t border-[var(--line)]">
                {!shown ? (
                  <button type="button" onClick={reveal} className={`${btnP} w-full`}>Show answer</button>
                ) : opts?.selfCheck ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => mark(true)} className={`py-3 rounded-xl border border-[var(--ok)] bg-[var(--okbg)] text-[var(--ok)] font-bold inline-flex items-center justify-center gap-2 hover:opacity-90 ${focus}`}><Ic className="w-5 h-5">{icons.check}</Ic>I knew it</button>
                    <button type="button" onClick={() => mark(false)} className={`py-3 rounded-xl border border-[var(--bad)] bg-[var(--badbg)] text-[var(--bad)] font-bold hover:opacity-90 ${focus}`}>I did not know</button>
                  </div>
                ) : (
                  <button type="button" onClick={advance} className={`${btnP} w-full`}>{i === deck.length - 1 ? 'Finish' : 'Next card'}<Ic className="w-4 h-4">{icons.right}</Ic></button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--mut)] px-1">
              <span>Knew: <b className="text-[var(--ok)]">{mastered}</b> · Review: <b className="text-[var(--bad)]">{doneCount - mastered}</b></span>
              <button type="button" onClick={() => {
                void getBatch().flush();
                setPhase('done');
              }} className="font-semibold hover:text-[var(--ink)]">End session</button>
            </div>
            {i > 0 && <button type="button" onClick={() => { setI(i - 1); setShown(false); }} className={`${btnS} self-start`}><Ic className="w-4 h-4">{icons.left}</Ic>Previous card</button>}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className={`${box} p-6 sm:p-8 text-center`}>
              <h1 className="text-2xl font-bold" style={heading}>Session complete</h1>
              <p className="text-sm text-[var(--mut)] mt-1">{title}</p>
              <div className="mt-5 grid grid-cols-3 gap-3 max-w-sm mx-auto">
                {([['Cards seen', doneCount], ['Knew it', mastered], ['To review', doneCount - mastered]] as [string, number][]).map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-[var(--bg)] border border-[var(--line)] py-3"><div className="text-xl font-bold" style={heading}>{v}</div><div className="text-xs text-[var(--mut)]">{l}</div></div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {missed.length > 0 && <button type="button" onClick={() => begin(shuffle(missed))} className={btnP}>Revise {missed.length} missed</button>}
                <button type="button" onClick={start} className={btnS}>Start again</button>
                <Link href="/dashboard" className={btnS}>Dashboard</Link>
              </div>
            </div>
            <AdBanner placement="result" />
          </div>
        )}
      </main>
      {reportCard && <ReportModal isOpen questionText={reportCard.q} kind="Ratta" onClose={() => setReportCard(null)} onSubmit={submitReport} />}
    </StudentShell>
  );
}

export default function RattaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm font-semibold text-[var(--mut)]">Loading...</div>}>
      <RattaInner />
    </Suspense>
  );
}
