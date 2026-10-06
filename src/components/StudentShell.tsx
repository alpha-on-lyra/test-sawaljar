'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import * as sb from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import JarArt from '@/components/JarArt';
import { useUser, displayName } from '@/lib/useUser';
import { useTheme } from '@/lib/useTheme';
import { useCloudSync } from '@/lib/useCloud';
import TopStrip from '@/components/TopStrip';
import { syncAccount, getAccountStatus, Status } from '@/lib/accounts';
import { display, body, heading, Ic, icons, focus } from '@/lib/ui';

const SUPPORT_URL = 'https://reply-sawaljar.pages.dev';

export default function StudentShell({ children, backHref = '/', backLabel = 'Home', requireAuth = false, sidebarToggle = false }: { children: React.ReactNode; backHref?: string; backLabel?: string; requireAuth?: boolean; sidebarToggle?: boolean }) {
  const router = useRouter();
  const user = useUser();
  const { dark, toggle, style } = useTheme();
  useCloudSync();
  const [menu, setMenu] = useState(false);
  const [status, setStatus] = useState<Status>('active');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (requireAuth && user === null) router.replace('/login');
  }, [requireAuth, user, router]);

  useEffect(() => {
    if (!user?.email) return;
    const remote = user.status === 'banned' || user.status === 'suspended' ? user.status : null; // from the Supabase profile
    const local = syncAccount({ id: user.id, email: user.email, name: displayName(user) });
    setStatus(remote || local);
    const check = () => setStatus(remote || getAccountStatus(user.email));
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, [user]);

  useEffect(() => {
    const down = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, []);

  const logout = async () => {
    const m = sb as unknown as { signOut?: () => Promise<unknown>; supabase?: { auth: { signOut: () => Promise<unknown> } } };
    try {
      if (m.signOut) await m.signOut();
      else await m.supabase?.auth.signOut();
    } catch {
      // continue to login page
    }
    router.replace('/login');
  };

  const blocked = status !== 'active';
  const gated = requireAuth && !user;
  const id = user?.id || user?.email || 'guest';
  const item = `flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-left hover:bg-[var(--pri2)] transition-colors ${focus}`;
  const round = `grid place-items-center w-10 h-10 rounded-full bg-[var(--card)] border border-[var(--line)] hover:border-[var(--pri)] transition-colors ${focus}`;

  return (
    <div className={`${display.variable} ${body.variable} min-h-screen overflow-x-clip bg-[var(--bg)] text-[var(--ink)] selection:bg-[var(--pri2)]`} style={style}>
      <TopStrip />
      <header className="sticky top-0 z-30 glass" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-20 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="justify-self-start flex items-center gap-2">
            {sidebarToggle && !blocked && (
              <button type="button" onClick={() => window.dispatchEvent(new Event('sj_toggle_sidebar'))} aria-label="Show or hide the side menu" className={round}><Ic>{icons.menu}</Ic></button>
            )}
            <Link href={backHref} className={`inline-flex items-center gap-2 text-sm font-semibold text-[var(--mut)] hover:text-[var(--ink)] rounded-full ${focus}`} aria-label={backLabel}>
              <Ic>{icons.home}</Ic>
              <span className="hidden sm:inline">{backLabel}</span>
            </Link>
          </div>
          <Link href="/" className="justify-self-center" aria-label="SawalJar home">
            <Image src="/Sawal.png" alt="SawalJar" width={220} height={66} priority className="h-10 sm:h-14 w-auto object-contain" />
          </Link>
          <div className="justify-self-end flex items-center gap-2" ref={ref}>
            {user ? (
              <div className="relative">
                <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu" aria-label="Account menu" className={`rounded-full ring-2 ring-transparent hover:ring-[var(--pri)] transition ${focus}`}>
                  <Avatar seed={id} size={40} />
                </button>
                {menu && (
                  <div role="menu" className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] p-2 rounded-2xl bg-[var(--card)] border border-[var(--line)] shadow-lg">
                    <div className="flex items-center gap-3 p-3 border-b border-[var(--line)] mb-1">
                      <Avatar seed={id} size={40} />
                      <div className="min-w-0">
                        <div className="font-bold truncate">{displayName(user)}</div>
                        <div className="text-xs text-[var(--mut)] truncate">{user.email}</div>
                      </div>
                    </div>
                    {!blocked && <Link role="menuitem" href="/stats" className={item}><Ic>{icons.chart}</Ic>Statistics</Link>}
                    {!blocked && <Link role="menuitem" href="/announcements" className={item}><Ic>{icons.bell}</Ic>Announcements</Link>}
                    {!blocked && user.role === 'admin' && <Link role="menuitem" href="/admin" className={item}><Ic>{icons.wrench}</Ic>Admin panel</Link>}
                    <button role="menuitem" type="button" onClick={toggle} className={item}><Ic>{dark ? icons.sun : icons.moon}</Ic>{dark ? 'Light mode' : 'Dark mode'}</button>
                    <button role="menuitem" type="button" onClick={() => void logout()} className={`${item} text-[var(--red,#c0392b)]`}><Ic>{icons.logout}</Ic>Log out</button>
                  </div>
                )}
              </div>
            ) : user === null && !requireAuth ? (
              <>
                <button type="button" onClick={toggle} aria-label={dark ? 'Light mode' : 'Dark mode'} className={round}><Ic>{dark ? icons.sun : icons.moon}</Ic></button>
                <Link href="/login" className={`px-4 py-2 rounded-full bg-[var(--pri)] text-[var(--bg)] text-sm font-semibold hover:opacity-90 ${focus}`}>Sign in</Link>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {blocked ? (
        <main className="max-w-lg mx-auto px-6 py-14 text-center flex flex-col items-center">
          <JarArt variant="offline" className="w-44 h-auto" />
          <h1 className="mt-5 text-2xl font-bold" style={heading}>{status === 'banned' ? 'Your account has been banned' : 'Your account is suspended'}</h1>
          <p className="mt-2 text-[var(--mut)] max-w-sm">
            {status === 'banned' ? 'You can no longer use SawalJar with this account.' : 'Your access is paused for now.'} If you think this is a mistake, contact us and we will look into it.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className={`px-6 py-3 rounded-full bg-[var(--pri)] text-[var(--bg)] font-semibold hover:opacity-90 ${focus}`}>Contact support</a>
            <button type="button" onClick={() => void logout()} className={`px-6 py-3 rounded-full bg-[var(--card)] border border-[var(--line)] font-semibold ${focus}`}>Log out</button>
          </div>
        </main>
      ) : gated ? (
        <div className="grid place-items-center py-32"><div className="w-8 h-8 border-4 border-[var(--pri)] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        children
      )}
    </div>
  );
}
