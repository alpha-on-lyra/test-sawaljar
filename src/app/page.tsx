'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { loadAppState, seedInitialData, setActiveCourse } from '@/lib/store';
import { getCurrentUser } from '@/lib/supabase';
import { AppState } from '@/lib/types';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import { useTheme } from '@/lib/useTheme';
import { useCloudSync } from '@/lib/useCloud';
import TopStrip from '@/components/TopStrip';
import { display, body, heading, tints, icons as uiIcons } from '@/lib/ui';


// Change these two links in one place
const FEEDBACK_URL = 'https://reply-sawaljar.pages.dev';
const TRUSTPILOT_URL = 'https://www.trustpilot.com/'; // replace with your Trustpilot review link


function Ic({ children, className = 'w-6 h-6' }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

const icons = {
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  cards: <><rect x="3" y="8" width="14" height="12" rx="2" /><path d="M7 8V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /></>,
  flame: <path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" /></>,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5M9 7h6" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  play: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9 5 3-5 3z" /></>,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />,
  wrench: <path d="M14 6a4 4 0 0 0 5 5l-9 9a2.5 2.5 0 0 1-4-4l9-9a4 4 0 0 0-1-1z" />,
};

const features = [
  { icon: icons.check, title: 'MCQ practice', desc: 'Topic-wise questions with instant feedback. Each MCQ shows the past paper it came from, or marks it as a likely question.' },
  { icon: icons.cards, title: 'Ratta Cards', desc: 'Fill-in-the-blank revision cards. Think of the answer, tap Show, then mark whether you knew it.' },
  { icon: icons.flame, title: 'Streaks and goals', desc: 'Set a daily target and keep your streak alive so studying becomes a habit.' },
  { icon: icons.clock, title: 'Timed tests', desc: 'Practise under exam pressure and see which topics cost you marks.' },
  { icon: icons.play, title: 'Video suggestions', desc: 'Each topic links to a recommended YouTube lecture, so you know what to watch next.' },
  { icon: icons.flag, title: 'Share and report', desc: 'Send your score with a private link, or report a wrong answer in one tap.' },
];

const steps = [
  { t: 'Pick your course', d: 'MDCAT, ECAT, FSc or Matric. Change it any time.' },
  { t: 'Solve and revise', d: 'Mix MCQs with Ratta Cards so facts actually stick.' },
  { t: 'Track your progress', d: 'Your dashboard shows streaks, accuracy and weak topics.' },
];

const slips = [
  { q: '______ is the powerhouse of the cell.', a: 'Mitochondria' },
  { q: 'The SI unit of force is ______.', a: 'Newton' },
  { q: 'Pure water has a pH of ______ at 25°C.', a: '7' },
  { q: 'The derivative of sin x is ______.', a: 'cos x' },
  { q: 'The chemical symbol for sodium is ______.', a: 'Na' },
];

export default function Home() {
  const router = useRouter();
  const { dark, toggle, style: themeStyle } = useTheme();
  useCloudSync();
  useEffect(() => {
    const f = () => {
      const x = loadAppState();
      if (x) setState(x);
    };
    window.addEventListener('storage', f);
    return () => window.removeEventListener('storage', f);
  }, []);
  const [state, setState] = useState<AppState | null>(null);
  const [user, setUser] = useState<Awaited<ReturnType<typeof getCurrentUser>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [pick, setPick] = useState<number | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    async function init() {
      const u = await getCurrentUser();
      setUser(u);
      let st = loadAppState();
      if (!st || st.courses.length === 0) {
        seedInitialData();
        st = loadAppState();
      }
      setState(st);
      setLoading(false);
    }
    init();
  }, []);

  const handleQuickEnroll = (courseName: string) => {
    setActiveCourse(courseName);
    window.dispatchEvent(new CustomEvent('sj_course_changed'));
    router.push('/dashboard');
  };

  const pull = () => {
    const n = pick === null ? Math.floor(Math.random() * slips.length) : (pick + 1 + Math.floor(Math.random() * (slips.length - 1))) % slips.length;
    setPick(n);
    setShown(false);
  };

  const wrap = `${display.variable} ${body.variable} min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--ink)] selection:bg-[var(--pri2)]`;

  // Render the page even before the saved data loads, so search engines see the real content
  const s = state ?? ({ courses: [], ann: [], maint: { on: false, msg: '' }, site: { name: 'SawalJar' } } as unknown as AppState);

  if (s.maint.on) {
    return (
      <div className={`${wrap} flex flex-col items-center justify-center p-4`} style={themeStyle}>
        <div className="bg-[var(--card)] p-8 rounded-[var(--r)] max-w-md w-full text-center border border-[var(--line)]">
          <span className="mx-auto mb-4 grid place-items-center w-14 h-14 rounded-2xl bg-[var(--pri2)] text-[var(--pri)]">
            <Ic className="w-7 h-7">{icons.wrench}</Ic>
          </span>
          <h1 className="text-2xl font-bold mb-2" style={heading}>We&apos;ll be right back</h1>
          <p className="text-[var(--mut)]">{s.maint.msg}</p>
          {s.maint.eta && <p className="text-sm text-[var(--mut)] mt-4">Expected back: {s.maint.eta}</p>}
        </div>
      </div>
    );
  }

  const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pri)]';
  const btnP = `inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[var(--pri)] text-[var(--bg)] font-semibold hover:opacity-90 transition-opacity ${focus}`;
  const btnS = `inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[var(--card)] text-[var(--ink)] border border-[var(--line)] font-semibold hover:border-[var(--pri)] transition-colors ${focus}`;
  const siteName = s.site?.name || 'SawalJar';
  const cur = pick !== null ? slips[pick] : null;
  const parts = cur ? cur.q.split('______') : [];

  return (
    <div className={`${wrap} flex flex-col`} style={themeStyle}>
      <style>{`.sj-float{animation:sj-float 3.2s ease-in-out infinite}@keyframes sj-float{50%{transform:translateY(-8px)}}@media (prefers-reduced-motion:reduce){.sj-float{animation:none}}`}</style>

      <TopStrip />

      {/* Header */}
      <header className="sticky top-0 z-40 glass" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <button type="button" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} className={`justify-self-start grid place-items-center w-10 h-10 rounded-full bg-[var(--card)] border border-[var(--line)] hover:border-[var(--pri)] transition-colors ${focus}`}><Ic className="w-5 h-5">{dark ? uiIcons.sun : uiIcons.moon}</Ic></button>
          <Link href="/" className="justify-self-center" aria-label={`${siteName} home`}>
            <Image src="/Sawal.png" alt={siteName} width={220} height={66} priority className="h-10 sm:h-14 w-auto object-contain" />
          </Link>
          <Link href="/dashboard" className={`justify-self-end px-5 py-2 rounded-full bg-[var(--pri)] text-[var(--bg)] font-semibold text-sm hover:opacity-90 transition-opacity ${focus}`}>
            Dashboard
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-8 pb-14 md:pt-14 md:pb-20 grid md:grid-cols-[1.15fr_1fr] gap-12 items-center">
          <div className="text-center md:text-left">
            {s.ann && s.ann.length > 0 && (
              <div className="mb-5 inline-flex items-center gap-2 max-w-full min-w-0 px-3 py-1 rounded-full text-xs border border-[var(--line)] bg-[var(--card)]">
                <span className="text-[var(--pri)] shrink-0"><Ic className="w-3.5 h-3.5">{icons.spark}</Ic></span>
                <span className="font-bold shrink-0">{s.ann[0].t}</span>
                <span className="text-[var(--mut)] truncate min-w-0">{s.ann[0].m}</span>
              </div>
            )}
            <h1 className="text-[1.75rem] sm:text-4xl lg:text-[2.5rem] font-bold leading-[1.15] tracking-tight" style={heading}>
              Your exam is a jar of questions.
              <span className="block text-[var(--pri)]">Empty it before the day.</span>
            </h1>
            <p className="mt-3 text-[15px] text-[var(--mut)] max-w-md mx-auto md:mx-0 leading-relaxed">
              Free MCQs and Ratta Cards for MDCAT, ECAT, FSc and Matric, with every question tagged to its past paper.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center justify-center md:justify-start">
              {!user ? (
                <div className="w-full sm:w-auto"><GoogleAuthButton /></div>
              ) : (
                <Link href="/dashboard" className={btnP}>Open dashboard <Ic className="w-5 h-5">{icons.arrow}</Ic></Link>
              )}
              <a href="#courses" className={btnS}>See courses</a>
            </div>
            <ul className="mt-5 flex flex-wrap gap-2 justify-center md:justify-start">
              {[[icons.check, 'Free to use'], [icons.book, 'Topic-wise practice'], [icons.play, 'Video suggestions']].map(([ic, t], i) => (
                <li key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--card)] border border-[var(--line)]">
                  <span className="text-[var(--pri)]"><Ic className="w-4 h-4">{ic as React.ReactNode}</Ic></span>{t as string}
                </li>
              ))}
            </ul>
          </div>

          {/* Jar hook */}
          <div className="flex flex-col items-center">
            <button type="button" onClick={pull} aria-label="Pull a question from the jar" className={`rounded-3xl ${focus}`}>
              <svg viewBox="0 0 320 360" className="w-56 sm:w-72 h-auto" aria-hidden="true">
                <ellipse cx="160" cy="348" rx="96" ry="9" fill="#1a1a2e" opacity=".12" />
                <g className="sj-float">
                  <g transform="rotate(-8 160 60)"><rect x="118" y="14" width="86" height="70" rx="9" fill="#f2b01e" /><text x="161" y="68" fontSize="44" fontWeight="800" textAnchor="middle" fill="#1a1a2e">?</text></g>
                </g>
                <path d="M96 64h128c8 0 14 6 14 14v206c0 38-28 62-62 62h-32c-34 0-62-24-62-62V78c0-8 6-14 14-14z" fill="#fbfaf3" fillOpacity=".7" stroke="#1a1a2e" strokeWidth="4" />
                <g transform="rotate(-12 130 270)"><rect x="100" y="244" width="68" height="52" rx="8" fill="#9bd3f2" /><text x="134" y="282" fontSize="30" fontWeight="800" textAnchor="middle" fill="#1a1a2e">?</text></g>
                <g transform="rotate(10 190 250)"><rect x="160" y="218" width="68" height="52" rx="8" fill="#ee8fa8" /><text x="194" y="256" fontSize="30" fontWeight="800" textAnchor="middle" fill="#1a1a2e">?</text></g>
                <g transform="rotate(6 140 190)"><rect x="106" y="160" width="68" height="52" rx="8" fill="#2b2d8e" /><text x="140" y="198" fontSize="30" fontWeight="800" textAnchor="middle" fill="#f0efe1">?</text></g>
                <g transform="rotate(-9 196 310)"><rect x="150" y="288" width="72" height="46" rx="8" fill="#f2b01e" /><text x="186" y="322" fontSize="28" fontWeight="800" textAnchor="middle" fill="#1a1a2e">?</text></g>
                <path d="M104 96v170" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".6" />
                <g transform="rotate(16 262 36)"><rect x="200" y="22" width="124" height="26" rx="10" fill="#2b2d8e" /></g>
              </svg>
            </button>
            <p className="mt-2 text-sm text-[var(--mut)]">{cur ? 'Pull another one' : 'Tap the jar to pull a question'}</p>
            {cur && (
              <div className="mt-5 w-full max-w-sm bg-[var(--card)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-[0_18px_40px_-24px_rgba(26,26,46,.5)]">
                <div className="h-2 bg-[var(--acc)]" />
                <div className="p-5">
                  <p className="font-bold text-lg leading-snug" style={heading}>
                    {parts[0]}
                    <span className={`inline-block min-w-[96px] mx-1 px-2 text-center rounded-md transition-all duration-300 ${shown ? 'bg-[var(--pri2)] text-[var(--pri)]' : 'border-b-2 border-dashed border-[var(--mut)] text-transparent select-none'}`}>{cur.a}</span>
                    {parts[1]}
                  </p>
                  <button type="button" onClick={() => setShown((s) => !s)} className={`mt-4 px-4 py-1.5 rounded-full text-sm font-semibold bg-[var(--pri)] text-[var(--bg)] ${focus}`}>
                    {shown ? 'Hide answer' : 'Show answer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Quick facts */}
        <section className="border-y border-[var(--line)] bg-[var(--card)]">
          <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              loading ? ['4 exams', 'MDCAT, ECAT, FSc, Matric'] : [String(s.courses.length), s.courses.length === 1 ? 'course available' : 'courses available'],
              ['Free', 'no subscription'],
              ['MCQs + cards', 'two ways to study'],
              ['Any device', 'phone, tablet or laptop'],
            ].map(([v, l]) => (
              <div key={l}>
                <div className="text-2xl font-extrabold" style={heading}>{v}</div>
                <div className="text-sm text-[var(--mut)]">{l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight max-w-2xl" style={heading}>Built around how students actually revise</h2>
          <p className="mt-3 text-[var(--mut)] max-w-xl">Short sessions, instant feedback and honest tracking, without the clutter.</p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
            {features.map((f, i) => (
              <div key={f.title} className="flex gap-4">
                <span className="grid place-items-center w-12 h-12 shrink-0 rounded-2xl text-[var(--pri)]" style={{ background: tints[i % 4] }}><Ic>{f.icon}</Ic></span>
                <div>
                  <h3 className="font-bold text-lg" style={heading}>{f.title}</h3>
                  <p className="mt-1 text-[var(--mut)] text-[15px] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="bg-[var(--card)] border-y border-[var(--line)]">
          <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={s.t} className="flex gap-4 items-start">
                <span className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-[var(--acc)] text-[var(--ink)] font-extrabold" style={heading}>{i + 1}</span>
                <div>
                  <h3 className="font-bold text-lg" style={heading}>{s.t}</h3>
                  <p className="mt-1 text-[var(--mut)] text-[15px]">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Courses */}
        <section id="courses" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-20">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={heading}>Choose your course</h2>
          <p className="mt-3 text-[var(--mut)]">Pick one to jump straight into your dashboard.</p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {loading ? [0, 1, 2].map((k) => <div key={k} className="h-44 rounded-[var(--r)] bg-[var(--card)] border border-[var(--line)] animate-pulse" />) : s.courses.map((course, i) => (
              <div key={course.id} className="bg-[var(--card)] border border-[var(--line)] rounded-[var(--r)] p-6 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <span className="grid place-items-center w-12 h-12 rounded-2xl text-[var(--pri)]" style={{ background: tints[i % 4] }}><Ic>{icons.book}</Ic></span>
                  {course.badge && <span className="badge">{course.badge}</span>}
                </div>
                <h3 className="text-xl font-bold" style={heading}>{course.name}</h3>
                <p className="mt-2 text-[15px] text-[var(--mut)] flex-1">{course.description}</p>
                <button onClick={() => handleQuickEnroll(course.name)} className={`mt-6 w-full py-2.5 rounded-full border border-[var(--pri)] text-[var(--pri)] font-semibold hover:bg-[var(--pri)] hover:text-[var(--bg)] transition-colors ${focus}`}>
                  Start this course
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Feedback */}
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <div className="bg-[var(--ink)] text-[var(--bg)] rounded-[28px] p-8 md:p-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight" style={heading}>Help us make SawalJar better</h2>
              <p className="mt-2 opacity-80">Found a wrong answer, a bug, or an idea? Tell us. If SawalJar helped you, a review helps other students find it.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className={btnS}><Ic className="w-5 h-5">{icons.chat}</Ic>Send feedback</a>
              <a href={TRUSTPILOT_URL} target="_blank" rel="noopener noreferrer" className={btnS}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#00b67a" aria-hidden="true">{icons.star}</svg>Review on Trustpilot
              </a>
            </div>
          </div>
        </section>

        {!user && (
          <section className="bg-[var(--pri)] text-[var(--bg)]">
            <div className="max-w-3xl mx-auto px-6 py-16 text-center flex flex-col items-center">
              <h2 className="text-3xl md:text-4xl font-extrabold" style={heading}>Start practising today</h2>
              <p className="mt-3 mb-8 text-lg opacity-90 max-w-xl">Sign in with Google to save your progress, streaks and results.</p>
              <div className="bg-white rounded-full p-1 inline-block"><GoogleAuthButton /></div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--line)] bg-[var(--card)] px-6 py-12">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Image src="/Sawal.png" alt={siteName} width={140} height={42} className="h-9 w-auto object-contain" />
            <p className="mt-3 text-sm text-[var(--mut)] max-w-xs">Free MCQs and revision cards for Pakistani board and entrance exams.</p>
          </div>
          <div>
            <h4 className="font-bold mb-3" style={heading}>Courses</h4>
            <ul className="space-y-2 text-sm text-[var(--mut)]">
              {s.courses.slice(0, 4).map((c) => (
                <li key={c.id}><button onClick={() => handleQuickEnroll(c.name)} className="hover:text-[var(--pri)] transition-colors">{c.name}</button></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-3" style={heading}>Study</h4>
            <ul className="space-y-2 text-sm text-[var(--mut)]">
              <li><Link href="/practice" className="hover:text-[var(--pri)] transition-colors">Practice MCQs</Link></li>
              <li><Link href="/ratta" className="hover:text-[var(--pri)] transition-colors">Ratta Cards</Link></li>
              <li><Link href="/leaderboard" className="hover:text-[var(--pri)] transition-colors">Leaderboard</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-3" style={heading}>Support</h4>
            <ul className="space-y-2 text-sm text-[var(--mut)]">
              <li><a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--pri)] transition-colors">Send feedback</a></li>
              <li><a href={TRUSTPILOT_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--pri)] transition-colors">Review on Trustpilot</a></li>
            </ul>
          </div>
        </div>
        <p className="max-w-6xl mx-auto mt-10 pt-6 border-t border-[var(--line)] text-sm text-[var(--mut)]">
          &copy; {new Date().getFullYear()} {siteName}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
