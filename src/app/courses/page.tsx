'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { loadAppState, seedInitialData } from '@/lib/store';
import { AppState } from '@/lib/types';

export default function CoursesPage() {
  const [state, setState] = useState<AppState>(seedInitialData());

  useEffect(() => {
    setState(loadAppState());
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)]">
      <Navbar siteName={state.site.name} />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 pb-20">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight">Examination Courses</h1>
          <p className="sub">Select your target curriculum for focused drills and past papers</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {state.courses.map((course) => {
            const courseMcqs = state.mcqs.filter((m) => m.course === course);
            const courseRatta = state.ratta.filter((r) => r.course === course);
            const topics = Array.from(new Set(courseMcqs.map((m) => m.topic)));

            return (
              <div key={course} className="card p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-extrabold">{course}</h2>
                    <span className="badge">{courseMcqs.length} MCQs</span>
                  </div>

                  <p className="text-xs text-[var(--mut)] mb-4">
                    Complete preparation module covering all high-yield syllabus topics and past entrance papers.
                  </p>

                  <div className="mb-4">
                    <span className="text-xs font-semibold text-[var(--mut)] block mb-1.5">
                      Included Topics:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {topics.length > 0 ? (
                        topics.map((t) => (
                          <span
                            key={t}
                            className="px-2.5 py-1 rounded-md bg-[var(--bg)] border border-[var(--line)] text-xs font-medium"
                          >
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[var(--mut)]">General Practice</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-[var(--line)]">
                  <Link
                    href={`/practice?course=${encodeURIComponent(course)}`}
                    className="b p flex-1 text-center text-xs"
                  >
                    Start MCQ Test →
                  </Link>
                  <Link
                    href={`/ratta?course=${encodeURIComponent(course)}`}
                    className="b flex-1 text-center text-xs"
                  >
                    Ratta Cards ({courseRatta.length})
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
