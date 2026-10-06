'use client';

import React, { useEffect, useRef, useState } from 'react';
import { loadAppState } from '@/lib/store';

type Slot = { on: boolean; provider: 'adsense' | 'adsterra'; code: string; height: number };

// Renders an ad for a placement only when the master switch and that slot are on and ad code is saved.
// AdSense code runs inside the page. Adsterra code runs inside a sandboxed frame, which is the reliable way to run its banner scripts.
export function AdBanner({ placement }: { placement: string } & Record<string, unknown>) {
  const [slot, setSlot] = useState<Slot | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const read = () => {
      const st = loadAppState();
      const ex = (st as unknown as { extras?: { adSlots?: Record<string, Slot> } } | null)?.extras;
      const s = ex?.adSlots?.[placement];
      setSlot(st?.ads?.on && s?.on && s.code?.trim() ? s : null);
    };
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, [placement]);

  useEffect(() => {
    const el = box.current;
    if (!el || !slot || slot.provider !== 'adsense') return;
    el.innerHTML = '';
    const tpl = document.createElement('template');
    tpl.innerHTML = slot.code;
    tpl.content.childNodes.forEach((n) => {
      if (n.nodeName !== 'SCRIPT') return void el.appendChild(n.cloneNode(true));
      const o = n as HTMLScriptElement;
      if (o.src && document.querySelector(`script[src="${o.src}"]`)) return; // load the AdSense library once
      const s = document.createElement('script');
      Array.from(o.attributes).forEach((a) => s.setAttribute(a.name, a.value));
      s.text = o.text;
      el.appendChild(s);
    });
  }, [slot]);

  if (!slot) return null;
  return (
    <div className="my-3 flex flex-col items-center overflow-hidden" aria-label="Advertisement">
      {slot.provider === 'adsterra' ? (
        <iframe
          title="Advertisement"
          loading="lazy"
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin"
          srcDoc={`<!doctype html><html><body style="margin:0;display:flex;justify-content:center">${slot.code}</body></html>`}
          style={{ width: '100%', height: slot.height || 90, border: 0 }}
        />
      ) : (
        <div ref={box} className="w-full" style={{ minHeight: slot.height || 90 }} />
      )}
    </div>
  );
}

export default AdBanner;
