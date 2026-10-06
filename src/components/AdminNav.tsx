'use client';

import React from 'react';

export type AdminViewKey =
  | 'dash' | 'ana' | 'users' | 'monthly' | 'courses' | 'mcqs' | 'ratta'
  | 'reports' | 'ads' | 'ann' | 'flags' | 'set' | 'sec' | 'logs';

const ITEMS: [AdminViewKey, string, string][] = [
  ['dash', '▦', 'Dashboard'],
  ['ana', '↗', 'Analytics'],
  ['users', '☺', 'Users'],
  ['courses', '❖', 'Courses'],
  ['mcqs', '✎', 'MCQ Bank'],
  ['monthly', '▣', 'Monthly Tests'],
  ['ratta', '❏', 'Ratta Cards'],
  ['reports', '⚑', 'Reports'],
  ['ads', '◈', 'Ads'],
  ['ann', '✉', 'Announcements'],
  ['flags', '⚙', 'Features'],
  ['set', '⚒', 'Settings'],
  ['sec', '◉', 'Security'],
  ['logs', '☰', 'Audit Logs'],
];

export function AdminNav({
  currentView,
  onSelectView,
  siteName,
}: {
  currentView: AdminViewKey;
  onSelectView: (v: AdminViewKey) => void;
  siteName: string;
}) {
  return (
    <nav
      aria-label="Admin"
      className="w-[220px] shrink-0 sticky top-0 h-screen overflow-auto p-3.5 border-r border-[var(--line)] bg-[var(--bg)] max-[820px]:w-full max-[820px]:h-auto max-[820px]:z-30 max-[820px]:flex max-[820px]:gap-1 max-[820px]:overflow-x-auto max-[820px]:border-r-0 max-[820px]:border-b max-[820px]:p-2.5"
    >
      <div className="px-2.5 pb-4 font-extrabold text-lg tracking-tight max-[820px]:hidden">
        {siteName}
        <small className="block text-[11px] font-semibold text-[var(--mut)]">Admin panel</small>
      </div>
      {ITEMS.map(([key, icon, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onSelectView(key)}
          aria-current={currentView === key ? 'page' : undefined}
          className={`flex w-full items-center gap-2.5 px-3 py-2.5 my-0.5 rounded-[10px] text-left font-semibold text-sm whitespace-nowrap max-[820px]:w-auto ${
            currentView === key ? 'bg-[var(--pri)] text-[var(--bg)]' : 'text-[var(--mut)] hover:bg-[var(--pri2)]'
          }`}
        >
          <span aria-hidden="true">{icon}</span>
          {label}
        </button>
      ))}
    </nav>
  );
}
