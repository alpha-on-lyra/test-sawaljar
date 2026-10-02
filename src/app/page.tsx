'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { GoogleAuthButton } from '@/components/GoogleAuthButton';
import { AdBanner } from '@/components/AdBanner';
import { loadAppState, seedInitialData } from '@/lib/store';
import { getCurrentUser } from '@/lib/supabase';
import { AppState } from '@/lib/types';

export default function HomePage() {
  const [state, setState] = useState<AppState>(seedInitialData());
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);

  useEffect(() => {
    setState(loadAppState());
    getCurrentUser().then(setUser);
  }, []);

  // If maintenance mode is active and user is not admin
  if (state.maint.on) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[var(--bg)] text-[var(--ink)]">
        <div className="card max-w-md w-full p-8 shadow-md">
          <div className="w-12 h-12 rounded-full bg-[var(--pri2)] text-[var(--pri)] flex items-center justify-center text-2xl mx-auto mb-4 font-bold">
            ⚙
          </div>
          <h1 className="text-2xl font-extrabold mb-2">Under Maintenance</h1>
          <p className="text-[var(--mut)] mb-6 text-sm">{state.maint.msg}</p>
          <div className="p-3 bg-[var(--bg)] rounded-xl border border-[var(--line)] text-xs text-[var(--mut)] mb-4">
            Our team is updating high-yield question banks. We will be back shortly!
          </div>
          <Link href="/admin" className="b text-xs">
            Admin Portal Access →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)]">
      <Navbar siteName={state.site.name} />

      {/* Active Announcements Banner */}
      {state.ann.length > 0 && (
        <div className="bg-[var(--pri)] text-white px-4 py-2.5 text-xs text-center font-medium shadow-xs">
          <div className="max-w-5xl mx-auto flex items-center justify-center gap-2">
            <span className="font-bold uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded text-[10px]">
              {state.ann[0].k}
            </span>
            <span>
              <b>{state.ann[0].t}:</b> {state.ann[0].m}
            </span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto p-5 pb-16">
        {/* Top Ad Banner if enabled */}
        <AdBanner placement="dash_top" adsConfig={state.ads} />

        {/* Hero Section */}
        <div className="card p-8 md:p-12 mb-6 border-[var(--line)] bg-[var(--card)] text-center relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--pri2)] text-[var(--pri)] font-bold text-xs mb-4">
            <span className="w-2 h-2 rounded-full bg-[var(--pri)] animate-pulse" />
            High-Yield Exam Preparation Platform
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 text-[var(--ink)]">
            Master Every Question with{' '}
            <span className="text-[var(--pri)]">{state.site.name}</span>
          </h1>

          <p className="text-sm md:text-base text-[var(--mut)] max-w-2xl mx-auto mb-8">
            Practice thousands of curated past-paper MCQs for MDCAT, ECAT, Matric &amp; FSc.
            Train with real exam timers, anti-cheat test environments, and active-recall Ratta cards.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/practice"
              className="b p text-sm px-6 py-3 rounded-xl shadow-sm hover:scale-[1.02] transition-transform"
            >
              Start Free Practice →
            </Link>
            <Link
              href="/ratta"
              className="b text-sm px-6 py-3 rounded-xl"
            >
              Ratta Recall Cards
            </Link>
          </div>

          {!user && (
            <div className="mt-8 pt-6 border-t border-[var(--line)] max-w-sm mx-auto">
              <p className="text-xs text-[var(--mut)] mb-3">
                Save your progress, streaks, and join the leaderboard:
              </p>
              <GoogleAuthButton label="Continue with Google" />
            </div>
          )}
        </div>

        {/* Courses Grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Target Courses</h2>
              <p className="sub">Select your examination category to start targeted preparation</p>
            </div>
            <Link href="/courses" className="text-xs font-bold text-[var(--pri)] hover:underline">
              View all courses →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {state.courses.map((course) => {
              const qCount = state.mcqs.filter((m) => m.course === course).length;
              const rCount = state.ratta.filter((r) => r.course === course).length;

              return (
                <div key={course} className="card hover:border-[var(--pri)] transition-colors flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-lg">{course}</span>
                      <span className="badge">{qCount} MCQs</span>
                    </div>
                    <p className="text-xs text-[var(--mut)] mb-4">
                      Comprehensive test series, high-yield chapter drills, and past papers.
                    </p>
                    <div className="text-[11px] text-[var(--mut)] flex gap-3 mb-4 font-medium">
                      <span>✓ {qCount} Questions</span>
                      <span>✓ {rCount} Ratta Cards</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/practice?course=${encodeURIComponent(course)}`}
                      className="b p flex-1 text-center text-xs"
                    >
                      Practice
                    </Link>
                    <Link
                      href={`/ratta?course=${encodeURIComponent(course)}`}
                      className="b flex-1 text-center text-xs"
                    >
                      Cards
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card">
            <div className="text-2xl mb-2 text-[var(--pri)]">⏱️</div>
            <h3 className="text-base font-bold">Exam Timer &amp; Anti-Cheat</h3>
            <p className="text-xs text-[var(--mut)]">
              Simulate actual MDCAT/ECAT conditions with countdown timers and automated tab-switch protection.
            </p>
          </div>

          <div className="card">
            <div className="text-2xl mb-2 text-[var(--pri)]">❏</div>
            <h3 className="text-base font-bold">Ratta Revision Cards</h3>
            <p className="text-xs text-[var(--mut)]">
              Active recall flashcards designed specifically for memorizing formulas, anatomical terms, and units.
            </p>
          </div>

          <div className="card">
            <div className="text-2xl mb-2 text-[var(--pri)]">📊</div>
            <h3 className="text-base font-bold">Instant Explanations</h3>
            <p className="text-xs text-[var(--mut)]">
              Understand the core reasoning behind every question with step-by-step verified explanations.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--line)] bg-[var(--card)] py-6 text-center text-xs text-[var(--mut)]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div>
            © {new Date().getFullYear()} {state.site.name}. All rights reserved. Free &amp; Open Learning.
          </div>
          <div className="flex items-center gap-4">
            <Link href="/practice" className="hover:underline">
              Practice Tests
            </Link>
            <Link href="/ratta" className="hover:underline">
              Ratta Cards
            </Link>
            <Link href="/leaderboard" className="hover:underline">
              Leaderboard
            </Link>
            <Link href="/admin" className="text-[var(--pri)] font-bold hover:underline">
              Admin Area
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
