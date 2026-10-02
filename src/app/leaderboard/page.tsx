'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { loadAppState, seedInitialData } from '@/lib/store';
import { User, AppState } from '@/lib/types';

export default function LeaderboardPage() {
  const [state, setState] = useState<AppState>(seedInitialData());
  const [selectedCourse, setSelectedCourse] = useState('');

  useEffect(() => {
    setState(loadAppState());
  }, []);

  const rankedUsers = [...state.users]
    .filter((u) => !selectedCourse || u.course === selectedCourse)
    .sort((a, b) => b.solved * (b.acc / 100) - a.solved * (a.acc / 100));

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)]">
      <Navbar siteName={state.site.name} />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 pb-20">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Student Leaderboard</h1>
            <p className="sub">Top performers ranked by questions solved and accuracy</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--mut)]">Course:</span>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="text-xs font-semibold py-1.5 px-3 rounded-lg border bg-[var(--card)]"
            >
              <option value="">All Courses</option>
              {state.courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="card">
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th className="w-16">Rank</th>
                  <th>Student</th>
                  <th>Target Course</th>
                  <th>MCQs Solved</th>
                  <th>Accuracy</th>
                  <th>Study Streak</th>
                </tr>
              </thead>
              <tbody>
                {rankedUsers.map((u, idx) => (
                  <tr key={u.id} className={idx < 3 ? 'bg-[var(--pri2)]/30 font-semibold' : ''}>
                    <td>
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0
                            ? 'bg-amber-400 text-amber-950 shadow-xs'
                            : idx === 1
                            ? 'bg-gray-300 text-gray-900 shadow-xs'
                            : idx === 2
                            ? 'bg-amber-700 text-white shadow-xs'
                            : 'text-[var(--mut)]'
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td>
                      <b>{u.name}</b>
                    </td>
                    <td>{u.course}</td>
                    <td>{u.solved}</td>
                    <td>
                      <span className="font-bold text-[var(--pri)]">{u.acc}%</span>
                    </td>
                    <td>
                      <span className="badge">🔥 {u.streak}d</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
