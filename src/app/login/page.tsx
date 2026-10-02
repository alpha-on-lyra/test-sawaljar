'use client';

import React from 'react';
import Link from 'next/link';
import { GoogleAuthButton } from '@/components/GoogleAuthButton';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--bg)] text-[var(--ink)]">
      <div className="card max-w-md w-full p-8 shadow-sm text-center">
        <Link href="/" className="inline-block font-extrabold text-2xl tracking-tight mb-2">
          Sawal<b className="text-[var(--pri)]">Jar</b>
        </Link>
        <h1 className="text-xl font-bold mb-1">Welcome Back</h1>
        <p className="sub mb-8">Sign in to save test progress, streaks, and access the leaderboard</p>

        <div className="flex flex-col gap-4">
          <GoogleAuthButton
            label="Continue with Google"
            redirectTo="/admin"
            className="w-full py-3.5"
          />

          <div className="p-3 bg-[var(--bg)] rounded-xl border border-[var(--line)] text-left text-xs text-[var(--mut)]">
            <div className="font-bold text-[var(--ink)] mb-1 flex items-center gap-1.5">
              <span>🛡️</span> Security &amp; Anti-Abuse Notice
            </div>
            <p className="leading-relaxed">
              We exclusively support secure <b>Google Authentication</b> to prevent multiple account spamming and protect test integrity. One active device per student session is enforced.
            </p>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-[var(--line)] text-xs text-[var(--mut)]">
          <Link href="/" className="hover:underline">
            ← Return to Home Page
          </Link>
        </div>
      </div>
    </div>
  );
}
