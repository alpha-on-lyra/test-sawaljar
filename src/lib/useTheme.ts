'use client';

import { useCallback, useEffect, useState } from 'react';
import { theme, themeDark } from '@/lib/themes';

// Writes the colours onto <html> so the whole page, overscroll area and pop-ups always match (fixes the half-black background)
const apply = (dark: boolean) => {
  const el = document.documentElement;
  const t = (dark ? themeDark : theme) as unknown as Record<string, string>;
  Object.keys(t).forEach((k) => {
    if (k.startsWith('--')) el.style.setProperty(k, t[k]);
  });
  el.style.colorScheme = dark ? 'dark' : 'light';
};

// One saved choice (localStorage "sj_theme") used by the landing page, student pages and admin
export function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let d = false;
    try {
      const s = localStorage.getItem('sj_theme');
      d = s ? s === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      // keep light
    }
    setDark(d);
    apply(d);
  }, []);
  const toggle = useCallback(() => {
    setDark((v) => {
      const n = !v;
      apply(n);
      try {
        localStorage.setItem('sj_theme', n ? 'dark' : 'light');
      } catch {
        // storage unavailable
      }
      return n;
    });
  }, []);
  return { dark, toggle, style: dark ? themeDark : theme };
}
