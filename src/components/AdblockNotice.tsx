'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { loadAppState } from '@/lib/store';
import { checkAdblock } from '@/lib/adblock';
import { heading, focus } from '@/lib/ui';

type Cfg = { on: boolean; strict: boolean };
const DISMISS = 'sj_ab_dismiss';

// Shows a message asking visitors to turn off their ad blocker. Switched on in Admin > Ads.
// Put your picture at public/adblock.svg. It appears at the top centre of the message.
export default function AdblockNotice() {
  const path = usePathname();
  const [cfg, setCfg] = useState<Cfg>({ on: false, strict: false });
  const [blocked, setBlocked] = useState(false);
  const [still, setStill] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hide, setHide] = useState(false);
  const [noImg, setNoImg] = useState(false);
  const skip = !!path && (path.startsWith('/privacy') || path.startsWith('/admin')); // the policy and admin are never blocked

  useEffect(() => {
    const read = () => {
      const c = (loadAppState().site as unknown as { adblock?: Cfg } | undefined)?.adblock;
      setCfg(c?.on ? { on: true, strict: !!c.strict } : { on: false, strict: false });
    };
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);
  useEffect(() => {
    try {
      setHide(sessionStorage.getItem(DISMISS) === '1');
    } catch {
      // storage unavailable
    }
  }, []);

  const run = useCallback(async (force = false) => {
    const b = await checkAdblock(force);
    setBlocked(b);
    return b;
  }, []);
  useEffect(() => {
    if (!cfg.on || skip) {
      setBlocked(false);
      return;
    }
    const t = setTimeout(() => void run(), 1500); // let the page appear first
    const f = () => void run();
    window.addEventListener('focus', f);
    return () => {
      clearTimeout(t);
      window.removeEventListener('focus', f);
    };
  }, [cfg.on, skip, run]);

  const open = cfg.on && !skip && blocked && !(hide && !cfg.strict);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cfg.strict) dismiss();
    };
    window.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cfg.strict]);

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS, '1');
    } catch {
      // storage unavailable
    }
    setHide(true);
  };
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4 bg-black/60">
      <div role="dialog" aria-modal="true" aria-labelledby="ab-title" className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-[24px] bg-[var(--card)] text-[var(--ink)] border border-[var(--line)] p-6 sm:p-8 text-center">
        {!noImg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/adblock.webp" alt="" width={112} height={112} onError={() => setNoImg(true)} className="mx-auto mb-4 h-28 w-28 object-contain" />
        )}
        <h2 id="ab-title" className="text-2xl font-bold" style={heading}>Please turn off your ad blocker</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--mut)]">
          SawalJar is free for every student, and a few light ads help us pay for it. Please disable your ad blocker for this site, then press the button below.
        </p>
        {still && (
          <p role="alert" className="mt-3 text-sm font-semibold" style={{ color: 'var(--bad, #b3261e)' }}>
            We still detect an ad blocker. Turn it off for this site and try again. You may need to reload the page.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setStill(await run(true));
              setBusy(false);
            }}
            className={`px-6 py-3 rounded-full bg-[var(--pri)] text-[var(--bg)] font-semibold hover:opacity-90 disabled:opacity-50 ${focus}`}
          >
            {busy ? 'Checking...' : 'I have turned it off'}
          </button>
          <button type="button" onClick={() => window.location.reload()} className={`px-6 py-3 rounded-full bg-[var(--card)] border border-[var(--line)] font-semibold hover:border-[var(--pri)] ${focus}`}>
            Reload the page
          </button>
          {!cfg.strict && (
            <button type="button" onClick={dismiss} className="mt-1 text-sm font-semibold text-[var(--mut)] hover:text-[var(--ink)] underline underline-offset-2">
              Continue anyway
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
