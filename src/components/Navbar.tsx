'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCurrentUser, signOut } from '@/lib/supabase';
import { THEME_KEY, getActiveCourse } from '@/lib/store';

export function Navbar({ siteName = 'SawalJar' }: { siteName?: string }) {
  const [user, setUser] = useState<{ name?: string; email?: string; role?: string } | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [enrolledCourse, setEnrolledCourse] = useState('MDCAT');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    getCurrentUser().then(setUser);
    setEnrolledCourse(getActiveCourse());

    const savedTheme = localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
    }

    const handleCourseChange = () => setEnrolledCourse(getActiveCourse());
    window.addEventListener('storage', handleCourseChange);
    window.addEventListener('sj_course_changed', handleCourseChange);
    return () => {
      window.removeEventListener('storage', handleCourseChange);
      window.removeEventListener('sj_course_changed', handleCourseChange);
    };
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
  };

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', primary: true },
    { href: '/courses', label: 'Courses' },
    { href: '/practice', label: 'Practice' },
    { href: '/ratta', label: 'Flashcards' },
    { href: '/leaderboard', label: 'Leaderboard' },
  ];

  return (
    <>
      <header className="border-b border-[var(--line)] bg-[var(--card)]/80 backdrop-blur-lg px-5 py-3 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="font-extrabold text-xl tracking-tight flex items-center gap-0.5 hover:opacity-80 transition-opacity">
              <span>{siteName.replace('Jar', '')}</span>
              <span className="text-[var(--pri)]">Jar</span>
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--pri2)] text-[var(--pri)] font-bold text-[11px] hover:opacity-85 transition-opacity"
              title="Active course"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--pri)]" />
              <span>{enrolledCourse}</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="flex items-center gap-1 max-[768px]:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                  link.primary
                    ? 'text-[var(--ink)] hover:bg-[var(--pri2)] hover:text-[var(--pri)]'
                    : 'text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--bg)]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--bg)] hover:border-[var(--pri)] transition-colors text-sm cursor-pointer"
              title="Toggle theme"
            >
              {theme === 'dark' ? '☀' : '◐'}
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[var(--pri)] text-white flex items-center justify-center text-xs font-bold">
                  {(user.name?.charAt(0) || user.email?.charAt(0) || 'U').toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-[var(--ink)] max-[640px]:hidden">
                  {user.name?.split(' ')[0] || user.email?.split('@')[0]}
                </span>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="text-xs text-[var(--mut)] hover:text-[var(--red)] transition-colors font-medium cursor-pointer"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <Link href="/login" className="b p text-xs font-semibold px-3.5 py-1.5">
                Sign In
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="hidden max-[768px]:flex w-8 h-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--bg)] cursor-pointer text-sm"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="hidden max-[768px]:block fixed inset-0 top-[53px] z-20 bg-[var(--bg)] p-4">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 rounded-xl text-sm font-semibold text-[var(--ink)] hover:bg-[var(--card)] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}

export default Navbar;
