import React from 'react';
import Link from 'next/link';
import JarArt from '@/components/JarArt';
import StudentShell from '@/components/StudentShell';

const btn = 'inline-flex items-center justify-center px-6 py-3 rounded-full font-semibold transition-opacity hover:opacity-90';

export default function NotFound() {
  return (
    <StudentShell>
      <main className="max-w-xl mx-auto px-6 py-14 text-center flex flex-col items-center">
        <JarArt variant="lost" className="w-56 sm:w-64 h-auto" />
        <p className="mt-6 text-6xl font-extrabold text-[var(--pri)]" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>404</p>
        <h1 className="mt-2 text-2xl font-bold" style={{ fontFamily: 'var(--font-display), system-ui, sans-serif' }}>This page spilled out of the jar</h1>
        <p className="mt-2 text-[var(--mut)]">The page you are looking for does not exist or has moved. Let&apos;s get you back to your questions.</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link href="/dashboard" className={`${btn} bg-[var(--pri)] text-[var(--bg)]`}>Go to Dashboard</Link>
          <Link href="/" className={`${btn} bg-[var(--card)] border border-[var(--line)] text-[var(--ink)]`}>Back to home</Link>
        </div>
      </main>
    </StudentShell>
  );
}
