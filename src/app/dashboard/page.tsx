'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AdBanner from '@/components/AdBanner';
import JarArt from '@/components/JarArt';
import StudentShell from '@/components/StudentShell';
import { loadAppState, seedInitialData, getActiveCourse, setActiveCourse } from '@/lib/store';
import { AppState } from '@/lib/types';
import { availableFor, MonthlyTest } from '@/lib/monthly';
import { trackTopicView } from '@/lib/analytics';
import { Ic, icons, heading, tints, focus } from '@/lib/ui';

type Res = { title: string; url: string };
type BankSet = { id: string; name: string; course: string; subject?: string; topic: string; ids: string[]; count?: number; yt: Res[]; pdf: Res[] };
type Extras = { mcqSets?: BankSet[]; rattaSets?: BankSet[]; monthly?: MonthlyTest[]; offline?: Record<string, boolean> };
type Ann = { id: string; t: string; m: string; k: string; d?: number };
type NavItem = { href: string; label: string; icon: React.ReactNode; badge?: number };

const PER = 8;
const MONTHLY = '__monthly';
const ytId = (url: string) => url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([\w-]{11})/)?.[1] || null;

export default function Dashboard() {
  const [st, setSt] = useState<AppState | null>(null);
  const [activeName, setActiveName] = useState('');
  const [tab, setTab] = useState('');
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [courseModal, setCourseModal] = useState(false);
  const [video, setVideo] = useState<Res | null>(null);
  const [seen, setSeen] = useState(0);
  const [side, setSide] = useState(false);

  useEffect(() => {
    const load = () => {
      let s = loadAppState();
      if (!s || s.courses.length === 0) {
        seedInitialData();
        s = loadAppState();
      }
      setSt(s);
    };
    load();
    setActiveName(getActiveCourse() || '');
    try {
      setSide(window.innerWidth >= 1024 && localStorage.getItem('sj_sidebar') !== 'closed');
    } catch {
      // storage unavailable
    }
    const tog = () =>
      setSide((v) => {
        try {
          if (window.innerWidth >= 1024) localStorage.setItem('sj_sidebar', v ? 'closed' : 'open');
        } catch {
          // storage unavailable
        }
        return !v;
      });
    window.addEventListener('sj_toggle_sidebar', tog);
    try {
      setSeen(Number(localStorage.getItem('sj_ann_seen')) || 0);
    } catch {
      // storage unavailable
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setVideo(null);
        setCourseModal(false);
      }
    };
    window.addEventListener('storage', load);
    window.addEventListener('focus', load);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('storage', load);
      window.removeEventListener('focus', load);
      window.removeEventListener('keydown', key);
      window.removeEventListener('sj_toggle_sidebar', tog);
    };
  }, []);

  const courses = st?.courses || [];
  const course = courses.find((c) => c.name === activeName) || courses[0];
  const cname = course?.name || '';
  const ex = ((st as unknown as { extras?: Extras } | null)?.extras || {}) as Extras;
  const offline = !!(course && ex.offline?.[course.id]);

  const shell = (inner: React.ReactNode) => <StudentShell requireAuth sidebarToggle>{inner}</StudentShell>;
  if (!st) return shell(null);
  const flag = (k: string) => (st.flags as unknown as Record<string, boolean> | undefined)?.[k] !== false;
  const anns = (st.ann || []) as Ann[];
  const unread = anns.filter((a) => (a.d || 0) > seen).length;

  if (st.maint.on) {
    return shell(
      <main className="max-w-md mx-auto px-6 py-20 text-center">
        <span className="mx-auto mb-4 grid place-items-center w-14 h-14 rounded-2xl bg-[var(--pri2)] text-[var(--pri)]"><Ic className="w-7 h-7">{icons.wrench}</Ic></span>
        <h1 className="text-2xl font-bold" style={heading}>We&apos;ll be right back</h1>
        <p className="mt-2 text-[var(--mut)]">{st.maint.msg}</p>
      </main>
    );
  }
  if (!course) return shell(<main className="max-w-md mx-auto px-6 py-24 text-center text-[var(--mut)]">No courses are available yet. Please check back soon.</main>);

  // Course > Subject > Topic > JSON files
  const mSets = (ex.mcqSets || []).filter((s) => s.course === cname);
  const rSets = (ex.rattaSets || []).filter((s) => s.course === cname);
  const mcqs = st.mcqs.filter((m) => m.course === cname);
  const map = new Map<string, Set<string>>();
  const add = (sub: string, t: string) => {
    if (!t) return;
    const cur = map.get(sub) || new Set<string>();
    cur.add(t);
    map.set(sub, cur);
  };
  [...mSets, ...rSets].forEach((s) => {
    if (s.subject) add(s.subject, s.topic);
  });
  const subjects = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  const active = tab === MONTHLY ? MONTHLY : subjects.includes(tab) ? tab : subjects[0] || MONTHLY;
  const monthly = (ex.monthly || []).filter((m) => m.course === cname && m.live !== false);
  const topicList = Array.from(map.get(active) || []).filter((t) => t.toLowerCase().includes(q.toLowerCase().trim()));
  const pages = Math.max(1, Math.ceil(topicList.length / PER));
  const cur = Math.min(page, pages - 1);
  const visible = topicList.slice(cur * PER, cur * PER + PER);
  const topicCount = Array.from(map.values()).reduce((n, s) => n + s.size, 0);

  const pick = (name: string) => {
    setActiveCourse(name);
    setActiveName(name);
    setTab('');
    setPage(0);
    setQ('');
    setCourseModal(false);
    window.dispatchEvent(new CustomEvent('sj_course_changed'));
  };
  const switchTab = (t: string) => {
    setTab(t);
    setPage(0);
    setQ('');
  };
  const cq = encodeURIComponent(cname);

  const chip = (r: Res, kind: 'yt' | 'pdf', key: string) => {
    const base = `inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-[var(--line)] hover:opacity-80 transition-opacity ${focus}`;
    const style = kind === 'yt' ? { background: 'var(--ybg)', color: 'var(--yfg)' } : { background: 'var(--pbg)', color: 'var(--pfg)' };
    const label = <><Ic className="w-4 h-4">{kind === 'yt' ? icons.play : icons.pdf}</Ic><span className="truncate max-w-[12rem]">{r.title}</span></>;
    if (kind === 'yt' && ytId(r.url)) return <button key={key} type="button" onClick={() => setVideo(r)} className={base} style={style}>{label}</button>;
    return <a key={key} href={r.url} target="_blank" rel="noopener noreferrer" className={base} style={style}>{label}</a>;
  };

  const fileCard = (s: BankSet, topic: string, kind: 'practice' | 'ratta') => {
    const href = `/${kind}?course=${cq}&topic=${encodeURIComponent(topic)}&set=${encodeURIComponent(s.id)}`;
    const links = [...s.yt.map((r, i) => chip(r, 'yt', `y${i}`)), ...s.pdf.map((r, i) => chip(r, 'pdf', `p${i}`))];
    return (
      <div key={s.id} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-bold truncate" style={heading}>{s.name}</div>
            <div className="text-xs text-[var(--mut)]">{s.count ?? s.ids.length} {kind === 'practice' ? 'MCQs' : 'Ratta Cards'}</div>
          </div>
          <Link href={href} className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--pri)] text-[var(--bg)] text-sm font-semibold hover:opacity-90 ${focus}`}>
            {kind === 'practice' ? 'Solve' : 'Revise'}<Ic className="w-4 h-4">{icons.arrow}</Ic>
          </Link>
        </div>
        {links.length > 0 && (links.length > 3 ? (
          <details>
            <summary className="text-xs font-bold cursor-pointer text-[var(--mut)]">Videos and PDFs ({links.length})</summary>
            <div className="mt-2 flex flex-wrap gap-2">{links}</div>
          </details>
        ) : <div className="flex flex-wrap gap-2">{links}</div>)}
      </div>
    );
  };

  const navAll: (NavItem | null)[] = [
    { href: '/announcements', label: 'Announcements', icon: icons.bell, badge: unread },
    { href: '/stats', label: 'Statistics', icon: icons.chart },
    flag('leaderboard') ? { href: '/leaderboard', label: 'Leaderboard', icon: icons.trophy } : null,
  ];
  const navItems = navAll.filter((x): x is NavItem => !!x);

  const tabBtn = (id: string, label: string, isMonthly = false) => (
    <button key={id} type="button" onClick={() => switchTab(id)} aria-pressed={active === id} className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${active === id ? (isMonthly ? 'bg-[var(--acc)] text-[#1a1a2e] border-[var(--acc)]' : 'bg-[var(--pri)] text-[var(--bg)] border-[var(--pri)]') : 'bg-[var(--card)] border-[var(--line)] hover:border-[var(--pri)]'} ${focus}`}>{label}</button>
  );

  return shell(
    <>
      <main className={`max-w-7xl mx-auto px-3 sm:px-6 py-5 grid gap-6 items-start ${side ? 'lg:grid-cols-[272px_1fr]' : 'lg:grid-cols-1'}`}>
        {side && <button type="button" aria-label="Close menu" onClick={() => setSide(false)} className="fixed inset-0 z-40 bg-black/40 lg:hidden" />}
        {/* Sidebar */}
        <aside className={`flex flex-col gap-4 fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] overflow-y-auto p-4 bg-[var(--bg)] border-r border-[var(--line)] transition-transform duration-200 lg:sticky lg:top-24 lg:z-auto lg:w-auto lg:max-w-none lg:overflow-visible lg:p-0 lg:bg-transparent lg:border-0 ${side ? 'translate-x-0' : '-translate-x-full lg:hidden'}`}>
          <div className="bg-[var(--card)] border border-[var(--line)] rounded-[var(--r)] p-5">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-12 h-12 rounded-2xl text-[var(--pri)]" style={{ background: tints[0] }}><Ic className="w-6 h-6">{icons.book}</Ic></span>
              <div className="min-w-0">
                <div className="text-xs text-[var(--mut)]">Current course</div>
                <div className="font-bold text-xl leading-tight truncate" style={heading}>{course.name}</div>
              </div>
            </div>
            {offline && <span className="badge mt-3">Offline</span>}
            <button type="button" onClick={() => setCourseModal(true)} className={`mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-full border border-[var(--line)] bg-[var(--bg)] text-sm font-semibold hover:border-[var(--pri)] transition-colors ${focus}`}>
              <Ic className="w-4 h-4">{icons.swap}</Ic>Change course
            </button>
          </div>
          <nav aria-label="Student menu" className="bg-[var(--card)] border border-[var(--line)] rounded-[var(--r)] p-2 flex flex-col gap-1">
            {navItems.map((n, i) => (
              <Link key={n.label} href={n.href} onClick={() => window.innerWidth < 1024 && setSide(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap hover:bg-[var(--pri2)] transition-colors ${focus}`}>
                <span className="grid place-items-center w-8 h-8 rounded-lg text-[var(--pri)]" style={{ background: tints[i % 4] }}><Ic className="w-4 h-4">{n.icon}</Ic></span>
                {n.label}
                {!!n.badge && <span className="ml-auto px-2 rounded-full bg-[var(--acc)] text-[#1a1a2e] text-xs font-extrabold">{n.badge}</span>}
              </Link>
            ))}
          </nav>
          <AdBanner placement="dash_side" />
        </aside>

        {/* Centered content */}
        <section className="min-w-0 max-w-3xl w-full mx-auto flex flex-col gap-5">
          <AdBanner placement="dash_top" />
          {offline ? (
            <div className="bg-[var(--card)] border border-[var(--line)] rounded-[24px] p-10 text-center flex flex-col items-center">
              <JarArt variant="offline" className="w-44 h-auto" />
              <h1 className="mt-4 text-2xl font-bold" style={heading}>This course is offline for now</h1>
              <p className="mt-2 text-[var(--mut)] max-w-sm">We are updating {course.name}. Please check back soon, or study another course in the meantime.</p>
              <button type="button" onClick={() => setCourseModal(true)} className={`mt-6 px-6 py-2.5 rounded-full bg-[var(--pri)] text-[var(--bg)] font-semibold hover:opacity-90 ${focus}`}>Choose another course</button>
            </div>
          ) : (
            <>
              {anns[0] && (
                <Link href="/announcements" className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--card)] border border-[var(--line)] hover:border-[var(--pri)] transition-colors ${focus}`}>
                  <span className="text-[var(--pri)] shrink-0"><Ic>{icons.bell}</Ic></span>
                  <span className="min-w-0 truncate text-sm"><b>{anns[0].t}</b> <span className="text-[var(--mut)]">{anns[0].m}</span></span>
                </Link>
              )}
              <div className="grid grid-cols-3 gap-3">
                {([['Subjects', subjects.length], ['Topics', topicCount], ['MCQs', mSets.reduce((n, s) => n + (s.count ?? s.ids.length), 0)]] as [string, number][]).map(([l, v]) => (
                  <div key={l} className="bg-[var(--card)] border border-[var(--line)] rounded-[var(--r)] p-4 text-center">
                    <div className="text-2xl font-bold" style={heading}>{v}</div>
                    <div className="text-xs text-[var(--mut)]">{l}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Switch between Monthly tests and subjects">
                {tabBtn(MONTHLY, 'Monthly', true)}
                {subjects.map((s) => tabBtn(s, s))}
              </div>

              {active === MONTHLY ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {monthly.map((m) => {
                    const total = m.parts.reduce((n, p) => n + Math.min(p.count, availableFor(st, cname, p.subject)), 0);
                    return (
                      <div key={m.id} className="bg-[var(--card)] border border-[var(--line)] rounded-[var(--r)] p-5 flex flex-col gap-3">
                        <div>
                          <div className="font-bold text-lg" style={heading}>{m.name}</div>
                          <div className="text-xs text-[var(--mut)]">{total} questions{m.minutes ? ` · ${m.minutes} min` : ' · untimed'}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">{m.parts.map((p) => <span key={p.subject} className="badge">{p.subject} {p.count}</span>)}</div>
                        <Link href={`/practice?course=${cq}&monthly=${encodeURIComponent(m.id)}`} aria-disabled={!total} className={`mt-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[var(--pri)] text-[var(--bg)] text-sm font-semibold hover:opacity-90 ${total ? '' : 'pointer-events-none opacity-40'} ${focus}`}>Start test<Ic className="w-4 h-4">{icons.arrow}</Ic></Link>
                      </div>
                    );
                  })}
                  {monthly.length === 0 && <p className="sm:col-span-2 text-center py-12 text-[var(--mut)]">No monthly tests for {course.name} yet.</p>}
                </div>
              ) : (
                <div className="bg-[var(--card)] border border-[var(--line)] rounded-[var(--r)]">
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--line)]">
                    <h2 className="text-lg font-bold" style={heading}>{active} <span className="text-[var(--mut)] font-medium text-sm">· {topicList.length} topics</span></h2>
                    <label className="relative sm:w-56">
                      <span className="sr-only">Search topics</span>
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mut)]"><Ic className="w-4 h-4">{icons.search}</Ic></span>
                      <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search topics" className="!pl-9 !rounded-full" />
                    </label>
                  </div>
                  <div className="p-3 flex flex-col gap-3">
                    {visible.map((t, idx) => {
                      const key = `${active}|${t}`;
                      const ms = mSets.filter((s) => s.subject === active && s.topic === t);
                      const rs = rSets.filter((s) => s.subject === active && s.topic === t);
                      const isOpen = open[key] ?? (cur === 0 && idx === 0);
                      return (
                        <div key={key} className="rounded-2xl border border-[var(--line)] overflow-hidden">
                          <button type="button" aria-expanded={isOpen} onClick={() => { if (!isOpen) trackTopicView(cname, t); setOpen((o) => ({ ...o, [key]: !isOpen })); }} className={`w-full flex items-center gap-3 p-4 text-left hover:bg-[var(--bg)] transition-colors ${focus}`}>
                            <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-[var(--acc)] text-[#1a1a2e] font-extrabold text-sm" style={heading}>{cur * PER + idx + 1}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-bold truncate" style={heading}>{t}</span>
                              <span className="block text-xs text-[var(--mut)]">{active} › {ms.length + rs.length} {ms.length + rs.length === 1 ? 'file' : 'files'}</span>
                            </span>
                            <span className={`shrink-0 text-[var(--mut)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}><Ic>{icons.chevron}</Ic></span>
                          </button>
                          {isOpen && (
                            <div className="p-4 pt-0 grid sm:grid-cols-2 gap-3">
                              {ms.map((s) => fileCard(s, t, 'practice'))}
                              {rs.map((s) => fileCard(s, t, 'ratta'))}
                              {!ms.length && !rs.length && <p className="sm:col-span-2 text-sm text-[var(--mut)]">Nothing has been added to this topic yet.</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {visible.length === 0 && <p className="text-center py-10 text-[var(--mut)]">{map.size ? 'No topics match your search.' : 'No subjects in this course yet.'}</p>}
                  </div>
                  {pages > 1 && (
                    <div className="px-4 py-3 border-t border-[var(--line)] flex items-center justify-between gap-3 text-sm">
                      <span className="text-[var(--mut)]">Showing {cur * PER + 1}-{Math.min(topicList.length, cur * PER + PER)} of {topicList.length}</span>
                      <div className="flex gap-2">
                        {cur > 0 && <button type="button" onClick={() => setPage(cur - 1)} className={`inline-flex items-center gap-1 px-4 py-2 rounded-full border border-[var(--line)] font-semibold hover:border-[var(--pri)] ${focus}`}><Ic className="w-4 h-4">{icons.left}</Ic>Previous</button>}
                        {cur < pages - 1 && <button type="button" onClick={() => setPage(cur + 1)} className={`inline-flex items-center gap-1 px-4 py-2 rounded-full bg-[var(--pri)] text-[var(--bg)] font-semibold hover:opacity-90 ${focus}`}>Next page<Ic className="w-4 h-4">{icons.right}</Ic></button>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {courseModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setCourseModal(false)}>
          <div role="dialog" aria-modal="true" aria-label="Select course" className="bg-[var(--bg)] rounded-[24px] w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 flex items-center justify-between border-b border-[var(--line)]">
              <h2 className="text-xl font-bold" style={heading}>Select course</h2>
              <button type="button" onClick={() => setCourseModal(false)} aria-label="Close" className={`w-9 h-9 grid place-items-center rounded-full hover:bg-[var(--pri2)] text-xl ${focus}`}>&times;</button>
            </div>
            <div className="p-5 overflow-y-auto grid sm:grid-cols-2 gap-3">
              {courses.map((c, i) => (
                <button key={c.id} type="button" onClick={() => pick(c.name)} className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-colors ${cname === c.name ? 'border-[var(--pri)] bg-[var(--pri2)]' : 'border-[var(--line)] bg-[var(--card)] hover:border-[var(--pri)]'} ${focus}`}>
                  <span className="grid place-items-center w-11 h-11 shrink-0 rounded-xl text-[var(--pri)]" style={{ background: tints[i % 4] }}><Ic className="w-6 h-6">{icons.book}</Ic></span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-bold" style={heading}>{c.name}{ex.offline?.[c.id] ? <span className="badge pending">Offline</span> : c.badge && <span className="badge">{c.badge}</span>}</span>
                    <span className="block text-xs text-[var(--mut)] line-clamp-2">{c.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {video && ytId(video.url) && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setVideo(null)}>
          <div role="dialog" aria-modal="true" aria-label={video.title} className="w-full max-w-4xl rounded-2xl overflow-hidden bg-black relative" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setVideo(null)} aria-label="Close video" className="absolute top-3 right-3 z-10 w-10 h-10 grid place-items-center rounded-full bg-black/60 hover:bg-black text-white">&times;</button>
            <div className="aspect-video w-full">
              <iframe src={`https://www.youtube-nocookie.com/embed/${ytId(video.url)}`} title={video.title} loading="lazy" className="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
