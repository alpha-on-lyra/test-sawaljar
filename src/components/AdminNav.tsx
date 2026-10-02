'use client';

import React from 'react';

export const ADMIN_VIEWS = [
  ['dash', '▦', 'Dashboard'],
  ['users', '☺', 'Users'],
  ['courses', '❖', 'Courses'],
  ['mcqs', '✎', 'MCQ Bank'],
  ['ratta', '❏', 'Ratta Cards'],
  ['reports', '⚑', 'Reports'],
  ['ads', '◈', 'Ads'],
  ['ann', '✉', 'Announcements'],
  ['flags', '⚙', 'Features'],
  ['set', '⚒', 'Settings'],
  ['sec', '🔒', 'Security'],
  ['logs', '☰', 'Logs'],
] as const;

export type AdminViewKey = typeof ADMIN_VIEWS[number][0];

interface AdminNavProps {
  currentView: AdminViewKey;
  onSelectView: (view: AdminViewKey) => void;
  siteName?: string;
}

export function AdminNav({ currentView, onSelectView, siteName = 'SawalJar' }: AdminNavProps) {
  return (
    <nav className="w-[220px] p-5 border-r border-[var(--line)] sticky top-0 h-screen overflow-y-auto flex-shrink-0 max-[820px]:w-full max-[820px]:h-auto max-[820px]:flex max-[820px]:overflow-x-auto max-[820px]:p-2.5 max-[820px]:border-r-0 max-[820px]:border-b max-[820px]:bg-[var(--bg)] max-[820px]:z-20">
      <div className="font-extrabold text-[19px] px-2.5 pb-4 tracking-tight max-[820px]:hidden">
        {siteName.replace('Jar', '')}
        <b className="text-[var(--pri)]">Jar</b>
        <small className="block text-[11px] text-[var(--mut)] font-semibold tracking-normal mt-0.5">
          Admin Control Center
        </small>
      </div>

      <div className="flex flex-col gap-1 max-[820px]:flex-row max-[820px]:gap-1 max-[820px]:w-full">
        {ADMIN_VIEWS.map(([key, icon, label]) => {
          const isActive = currentView === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectView(key)}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-[10px] text-left text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[var(--pri)] text-white shadow-sm'
                  : 'text-[var(--mut)] hover:bg-[var(--pri2)] hover:text-[var(--ink)]'
              }`}
            >
              <span className="text-base leading-none w-5 text-center">{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
