'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import JarArt from '@/components/JarArt';
import StudentShell from '@/components/StudentShell';
import { useUser } from '@/lib/useUser';
import { Ic, icons, heading } from '@/lib/ui';

export default function LoginPage() {
  const router = useRouter();
  const user = useUser();
  useEffect(() => {
    if (user) router.replace('/dashboard');
  }, [user, router]);

  return (
    <StudentShell>
      <main className="max-w-5xl mx-auto px-6 py-12 md:py-20 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight" style={heading}>Welcome to SawalJar</h1>
          <p className="mt-3 text-[var(--mut)] max-w-md">Sign in with Google to save your progress, keep your streak and see your statistics. No passwords to remember.</p>
          <div className="mt-8 max-w-sm"><GoogleAuthButton /></div>
          <ul className="mt-8 space-y-2 text-sm text-[var(--mut)]">
            {['Free MCQs and Ratta Cards', 'Your results stay saved', 'One tap to sign in'].map((t) => (
              <li key={t} className="flex items-center gap-2"><span className="text-[var(--pri)]"><Ic className="w-4 h-4">{icons.check}</Ic></span>{t}</li>
            ))}
          </ul>
        </div>
        <div className="flex justify-center"><JarArt variant="hook" className="w-60 sm:w-72 h-auto" /></div>
      </main>
    </StudentShell>
  );
}
