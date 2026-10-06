'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadAppState } from '@/lib/store';

export type Strip = { on: boolean; text: string; kind: 'info' | 'warning' | 'success'; linkText: string; linkUrl: string; dismissible: boolean; scroll: boolean; v: number };
export const DEFAULT_STRIP: Strip = { on: false, text: '', kind: 'info', linkText: '', linkUrl: '', dismissible: true, scroll: false, v: 0 };

const KEY = 'sj_strip_dismissed';
const tone = {
  info: { bg: 'var(--pri)', fg: 'var(--bg)' },
  warning: { bg: 'var(--acc)', fg: '#1a1a2e' },
  success: { bg: 'var(--ok, #1f7a53)', fg: 'var(--bg)' },
};

// The bar itself (also used as the live preview in the admin)
export function StripBar({ strip, onClose }: { strip: Strip; onClose?: () => void }) {
  const t = tone[strip.kind] || tone.info;
  const external = /^https?:\/\//.test(strip.linkUrl);
  const linkCls = 'ml-2 underline underline-offset-2 font-bold whitespace-nowrap hover:opacity-80';
  const msg = (
    <>
      <span>{strip.text}</span>
      {strip.linkText && strip.linkUrl && (external ? <a href={strip.linkUrl} target="_blank" rel="noopener noreferrer" className={linkCls}>{strip.linkText}</a> : <Link href={strip.linkUrl} className={linkCls}>{strip.linkText}</Link>)}
    </>
  );
  return (
    <div role="region" aria-label="Site notice" className="relative w-full text-sm font-semibold" style={{ background: t.bg, color: t.fg }}>
      <style>{`.sj-mq{display:flex;width:max-content;animation:sjmq 22s linear infinite}.sj-mq>span{min-width:100vw;padding-right:3rem;text-align:center}@keyframes sjmq{to{transform:translateX(-50%)}}@media (prefers-reduced-motion:reduce){.sj-mq{animation:none;width:auto}.sj-mq>span:nth-child(2){display:none}}`}</style>
      <div className="max-w-7xl mx-auto px-10 py-2 text-center overflow-hidden">
        {strip.scroll ? <div className="sj-mq"><span>{msg}</span><span aria-hidden="true">{msg}</span></div> : msg}
      </div>
      {onClose && <button type="button" onClick={onClose} aria-label="Close notice" className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-full text-lg leading-none hover:bg-black/15">&times;</button>}
    </div>
  );
}

// Shows the strip you publish in Admin > Announcements. A student who closes it will see it again when you publish a new one.
export default function TopStrip() {
  const [strip, setStrip] = useState<Strip | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const read = () => {
      const s = (loadAppState() as unknown as { extras?: { strip?: Strip } }).extras?.strip;
      setStrip(s && s.on && s.text?.trim() ? s : null);
      try {
        setClosed(!!s && localStorage.getItem(KEY) === String(s.v));
      } catch {
        // storage unavailable
      }
    };
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);

  if (!strip || closed) return null;
  return (
    <StripBar
      strip={strip}
      onClose={strip.dismissible ? () => {
        try {
          localStorage.setItem(KEY, String(strip.v));
        } catch {
          // storage unavailable
        }
        setClosed(true);
      } : undefined}
    />
  );
}
