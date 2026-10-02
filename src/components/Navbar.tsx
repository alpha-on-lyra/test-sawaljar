'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCurrentUser, signOut } from '@/lib/supabase';
import { THEME_KEY } from '@/lib/store';

export function Navbar({ siteName = 'SawalJar' }: { siteName?: string }) {
  const [user, setUser] = useState<{ name?: string; email?: string; role?: string } | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    getCurrentUser().then(setUser);
    const saved = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.dataset.theme = saved;
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
  };

  return (
    <header className="border-b border-[var(--line)] bg-[var(--card)] px-5 py-3 sticky top-0 z-30 shadow-xs">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <Link href="/" className="font-extrabold text-xl tracking-tight flex items-center gap-1">
          <span>{siteName.replace('Jar', '')}</span>
          <span className="text-[var(--pri)]">Jar</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm font-semibold max-[640px]:hidden">
          <Link href="/courses" className="text-[var(--mut)] hover:text-[var(--ink)]">
            Courses
          </Link>
          <Link href="/practice" className="text-[var(--mut)] hover:text-[var(--ink)]">
            Practice MCQs
          </Link>
          <Link href="/ratta" className="text-[var(--mut)] hover:text-[var(--ink)]">
            Ratta Cards
          </Link>
          <Link href="/leaderboard" className="text-[var(--mut)] hover:text-[var(--ink)]">
            Leaderboard
          </Link>
          <Link href="/admin" className="text-[var(--pri)] hover:underline">
            Admin Panel
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="b text-xs px-2.5 py-1.5"
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? '☀ Light' : '◐ Theme'}
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--mut)] max-[500px]:hidden">
                {user.name || user.email}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="b text-xs px-2.5 py-1"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link href="/login" className="b p text-xs">
              Continue with Google
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
