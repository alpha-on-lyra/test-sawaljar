'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { AdBanner } from '@/components/AdBanner';
import { ReportModal } from '@/components/ReportModal';
import { loadAppState, seedInitialData } from '@/lib/store';
import { RattaCard, AppState } from '@/lib/types';

function RattaContent() {
  const searchParams = useSearchParams();
  const initialCourse = searchParams.get('course') || '';

  const [state, setState] = useState<AppState>(seedInitialData());
  const [selectedCourse, setSelectedCourse] = useState(initialCourse);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [needsReviewCount, setNeedsReviewCount] = useState(0);
  const [reportCard, setReportCard] = useState<RattaCard | null>(null);

  useEffect(() => {
    setState(loadAppState());
  }, []);

  const cards = useMemo(() => {
    let list = state.ratta.filter((c) => !selectedCourse || c.course === selectedCourse);
    if (list.length === 0) list = state.ratta;
    return list;
  }, [state.ratta, selectedCourse]);

  const currentCard = cards[currentIndex];

  const handleNext = () => {
    setShowAnswer(false);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handlePrev = () => {
    setShowAnswer(false);
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleReportSubmit = (reason: string) => {
    if (!reportCard) return;
    const newReport = {
      id: 'r_' + Math.random().toString(36).slice(2, 8),
      mcq: reportCard.q,
      kind: 'Ratta' as const,
      user: 'Ratta Student',
      reason,
      status: 'pending' as const,
      t: Date.now(),
    };
    setState((prev) => ({
      ...prev,
      reports: [newReport, ...prev.reports],
    }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)]">
      <Navbar siteName={state.site.name} />

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-6 pb-20">
        <AdBanner placement="revision" adsConfig={state.ads} />

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Ratta Revision Flashcards</h1>
            <p className="sub">Active-recall fill-in-the-blank cards for rapid memorization</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--mut)]">Course:</span>
            <select
              value={selectedCourse}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                setCurrentIndex(0);
                setShowAnswer(false);
              }}
              className="text-xs font-semibold py-1.5 px-3 rounded-lg border bg-[var(--card)]"
            >
              <option value="">All Courses ({state.ratta.length})</option>
              {state.courses.map((c) => (
                <option key={c} value={c}>
                  {c} ({state.ratta.filter((r) => r.course === c).length})
                </option>
              ))}
            </select>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="card text-center py-12">
            <h3 className="text-lg font-bold mb-2">No Ratta Cards Available</h3>
            <p className="sub mb-4">No cards have been added for this category yet.</p>
            <Link href="/admin" className="b p text-xs">
              Go to Admin to Add Cards →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Card Container */}
            <div className="card p-8 min-h-[260px] flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-2">
                    <span className="badge">{currentCard.course}</span>
                    <span className="text-xs text-[var(--mut)] font-semibold">
                      {currentCard.topic}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setReportCard(currentCard)}
                      className="text-xs text-[var(--mut)] hover:text-[var(--red)] transition-colors cursor-pointer"
                    >
                      ⚑ Report
                    </button>
                    <span className="text-xs font-bold text-[var(--mut)]">
                      {currentIndex + 1} / {cards.length}
                    </span>
                  </div>
                </div>

                <div className="text-lg md:text-xl font-medium leading-relaxed mb-6">
                  {currentCard.q.split('______').map((part, idx, arr) => (
                    <React.Fragment key={idx}>
                      <span>{part}</span>
                      {idx < arr.length - 1 && (
                        <span
                          className={`inline-block px-2.5 py-0.5 mx-1 rounded-md font-bold transition-all border ${
                            showAnswer
                              ? 'bg-[var(--pri)] text-white border-[var(--pri)]'
                              : 'bg-[var(--line)] text-transparent border-dashed border-[var(--mut)]'
                          }`}
                        >
                          {showAnswer ? currentCard.a : '___________'}
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Action controls */}
              <div className="pt-4 border-t border-[var(--line)]">
                {!showAnswer ? (
                  <button
                    type="button"
                    onClick={() => setShowAnswer(true)}
                    className="b p w-full py-3 text-sm font-bold shadow-xs hover:scale-[1.01] transition-transform"
                  >
                    Reveal Answer (Show Blank)
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    {state.quiz.rself && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMasteredCount((c) => c + 1);
                            handleNext();
                          }}
                          className="flex-1 py-2.5 rounded-xl border border-green-600 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300 font-bold text-xs hover:opacity-90 cursor-pointer"
                        >
                          ✓ I Knew It
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNeedsReviewCount((c) => c + 1);
                            handleNext();
                          }}
                          className="flex-1 py-2.5 rounded-xl border border-red-500 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 font-bold text-xs hover:opacity-90 cursor-pointer"
                        >
                          ✕ I Did Not Know
                        </button>
                      </div>
                    )}

                    <div className="flex justify-between items-center mt-1">
                      <button
                        type="button"
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="b text-xs"
                      >
                        ← Previous
                      </button>
                      <button
                        type="button"
                        onClick={handleNext}
                        className="b p text-xs px-5"
                      >
                        Next Card →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Score Tracker */}
            <div className="flex items-center justify-between text-xs text-[var(--mut)] px-2">
              <div>
                Mastered: <b className="text-green-600">{masteredCount}</b> · Needs Review:{' '}
                <b className="text-[var(--red)]">{needsReviewCount}</b>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMasteredCount(0);
                  setNeedsReviewCount(0);
                  setCurrentIndex(0);
                  setShowAnswer(false);
                }}
                className="hover:underline text-[var(--ink)] cursor-pointer"
              >
                Reset session stats
              </button>
            </div>
          </div>
        )}
      </main>

      {reportCard && (
        <ReportModal
          isOpen={Boolean(reportCard)}
          questionText={reportCard.q}
          kind="Ratta"
          onClose={() => setReportCard(null)}
          onSubmit={handleReportSubmit}
        />
      )}
    </div>
  );
}

export default function RattaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 text-sm font-semibold text-[var(--mut)]">
          Loading Ratta cards...
        </div>
      }
    >
      <RattaContent />
    </Suspense>
  );
}
