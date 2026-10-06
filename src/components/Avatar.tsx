import React from 'react';

const BG = ['#e3e3f6', '#fbeccb', '#dff0fa', '#fadde5', '#e0efe3'];
const SKIN = ['#f5d0b0', '#e6b48a', '#c98f63', '#8d5a3b'];
const HAIR = ['#2a1f1a', '#5a3a22', '#1a1a2e', '#b0702f', '#7a2e2e'];
const hash = (s: string) => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

// A friendly avatar chosen from the user id, so every user gets a different one that never changes
export default function Avatar({ seed, size = 40 }: { seed: string; size?: number }) {
  const h = hash(seed || 'sawaljar');
  const bg = BG[h % 5], skin = SKIN[(h >> 3) % 4], hair = HAIR[(h >> 6) % 5], style = (h >> 9) % 3, glasses = (h >> 12) % 3 === 0;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Avatar" className="rounded-full shrink-0">
      <rect width="64" height="64" fill={bg} />
      <path d="M8 64c2-14 12-18 24-18s22 4 24 18z" fill={['#2b2d8e', '#f2b01e', '#ee8fa8'][(h >> 14) % 3]} />
      <rect x="27" y="38" width="10" height="9" rx="4" fill={skin} />
      {style === 1 && <path d="M16 30c0-14 8-20 16-20s16 6 16 20v14H44V30H20v14h-4z" fill={hair} />}
      <circle cx="32" cy="29" r="13" fill={skin} />
      {style === 0 && <path d="M19 28c0-10 6-16 13-16s13 6 13 16c-4-5-8-7-13-7s-9 2-13 7z" fill={hair} />}
      {style === 1 && <path d="M19 27c3-6 7-8 13-8s10 2 13 8c-5-2-8-3-13-3s-8 1-13 3z" fill={hair} />}
      {style === 2 && <><circle cx="32" cy="13" r="6" fill={hair} /><path d="M19 28c0-9 6-14 13-14s13 5 13 14c-4-4-8-6-13-6s-9 2-13 6z" fill={hair} /></>}
      <circle cx="27" cy="30" r="1.6" fill="#1a1a2e" />
      <circle cx="37" cy="30" r="1.6" fill="#1a1a2e" />
      {glasses && <g fill="none" stroke="#1a1a2e" strokeWidth="1.3"><circle cx="27" cy="30" r="4" /><circle cx="37" cy="30" r="4" /><path d="M31 30h2" /></g>}
      <path d="M27 36c2 2.4 8 2.4 10 0" fill="none" stroke="#1a1a2e" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
