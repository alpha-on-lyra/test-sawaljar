import React from 'react';

// Illustrations of the SawalJar mascot. hook = upright jar, lost = tipped over (404), offline = sleeping jar with the lid on
export default function JarArt({ variant = 'hook', className = 'w-56 h-auto' }: { variant?: 'hook' | 'lost' | 'offline'; className?: string }) {
  const lost = variant === 'lost';
  const off = variant === 'offline';
  const slip = (x: number, y: number, r: number, c: string, t = '?', tc = '#1a1a2e') => (
    <g transform={`rotate(${r} ${x + 34} ${y + 26})`} key={`${x}${y}`}>
      <rect x={x} y={y} width="68" height="52" rx="8" fill={c} />
      <text x={x + 34} y={y + 38} fontSize="30" fontWeight="800" textAnchor="middle" fill={tc}>{t}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 320 360" className={className} role="img" aria-label={lost ? 'A tipped over jar' : off ? 'A sleeping jar' : 'The SawalJar jar'}>
      <style>{`.jf{animation:jf 3.2s ease-in-out infinite}@keyframes jf{50%{transform:translateY(-8px)}}@media (prefers-reduced-motion:reduce){.jf{animation:none}}`}</style>
      <ellipse cx="160" cy="348" rx="96" ry="9" fill="#1a1a2e" opacity=".12" />
      {lost && <g>{slip(214, 296, 24, '#f2b01e')}{slip(250, 258, -18, '#ee8fa8')}{slip(190, 330, -8, '#9bd3f2', '?')}</g>}
      <g transform={lost ? 'rotate(-22 160 340)' : undefined}>
        {!off && !lost && <g className="jf"><g transform="rotate(-8 160 60)"><rect x="118" y="14" width="86" height="70" rx="9" fill="#f2b01e" /><text x="161" y="68" fontSize="44" fontWeight="800" textAnchor="middle" fill="#1a1a2e">?</text></g></g>}
        <path d="M96 64h128c8 0 14 6 14 14v206c0 38-28 62-62 62h-32c-34 0-62-24-62-62V78c0-8 6-14 14-14z" fill="#fbfaf3" fillOpacity=".75" stroke="#1a1a2e" strokeWidth="4" />
        <g opacity={off ? 0.55 : 1}>{slip(100, 244, -12, '#9bd3f2')}{slip(160, 218, 10, '#ee8fa8')}{slip(106, 160, 6, '#2b2d8e', '?', '#f0efe1')}{slip(150, 288, -9, '#f2b01e')}</g>
        <path d="M104 96v170" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".6" />
        {off ? <rect x="90" y="44" width="140" height="30" rx="10" fill="#2b2d8e" /> : <g transform="rotate(16 262 36)"><rect x="200" y="22" width="124" height="26" rx="10" fill="#2b2d8e" /></g>}
        {off && <g fill="none" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round"><path d="M126 130q8 6 16 0M178 130q8 6 16 0" /></g>}
      </g>
      {off && <g fill="#2b2d8e" fontWeight="800" fontFamily="inherit"><text x="246" y="70" fontSize="30">z</text><text x="270" y="44" fontSize="22">z</text></g>}
    </svg>
  );
}
