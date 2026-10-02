'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { AdBanner } from '@/components/AdBanner';
import { ReportModal } from '@/components/ReportModal';
import { loadAppState, seedInitialData } from '@/lib/store';
import { setupAntiCheat } from '@/lib/antiCheat';
import { MCQ, AppState } from '@/lib/types';

function PracticeContent() {
  const searchParams = useSearchParams();
  const initialCourse = searchParams.get('course') || '';

  const [state, setState] = useState<AppState>(seedInitialData());
  const [selectedCourse, setSelectedCourse] = useState(initialCourse);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Anti-Cheat State
  const [cheatWarnings, setCheatWarnings] = useState<string[]>([]);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  // Report Modal State
  const [reportQuestion, setReportQuestion] = useState<MCQ | null>(null);

  useEffect(() => {
    const loaded = loadAppState();
    setState(loaded);
    if (!selectedCourse && loaded.courses.length > 0) {
      setSelectedCourse(loaded.courses[0]);
    }
  }, []);

  // Filter and shuffle questions
  const questions: MCQ[] = useMemo(() => {
    let list = state.mcqs.filter((m) => !selectedCourse || m.course === selectedCourse);
    if (list.length === 0) list = state.mcqs;

    if (state.quiz.shuffleQ) {
      return [...list].sort(() => Math.random() - 0.5);
    }
    return list;
  }, [state.mcqs, selectedCourse, state.quiz.shuffleQ]);

  // Set up timer
  useEffect(() => {
    if (state.quiz.qt > 0 && !isSubmitted) {
      setTimeLeft(state.quiz.qt);
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Auto advance or submit
            if (currentIndex < questions.length - 1) {
              setCurrentIndex((i) => i + 1);
              return state.quiz.qt;
            } else {
              setIsSubmitted(true);
              return 0;
            }
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [currentIndex, state.quiz.qt, isSubmitted, questions.length]);

  // Set up Anti-Cheat Active Engine
  useEffect(() => {
    if (!state.sec.antiCheat.enabled || isSubmitted) return;

    const cleanup = setupAntiCheat({
      maxTabSwitches: state.sec.antiCheat.maxTabSwitches,
      preventCopy: state.sec.antiCheat.blockCopy || state.prot.noselect,
      onWarning: (msg, count) => {
        setTabSwitchCount(count);
        setCheatWarnings((prev) => [msg, ...prev.slice(0, 4)]);
      },
      onExceededLimit: (count) => {
        alert(
          `Anti-Cheat Alert: You have exceeded the maximum allowed tab switches (${count}). Your test has been auto-submitted.`
        );
        setIsSubmitted(true);
      },
    });

    return cleanup;
  }, [state.sec.antiCheat, state.prot.noselect, isSubmitted]);

  const currentQ = questions[currentIndex];

  const handleSelectOption = (optionIndex: number) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentIndex]: optionIndex,
    }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      if (state.quiz.qt > 0) setTimeLeft(state.quiz.qt);
    } else {
      setIsSubmitted(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  // Score Calculations
  const stats = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let skipped = 0;

    questions.forEach((q, idx) => {
      const chosen = selectedAnswers[idx];
      if (chosen === undefined) {
        skipped++;
      } else if (chosen === q.a) {
        correct++;
      } else {
        wrong++;
      }
    });

    const accuracy = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    const finalScore = state.quiz.neg
      ? Math.max(0, correct - wrong * 0.25).toFixed(2)
      : correct;

    return { correct, wrong, skipped, accuracy, finalScore };
  }, [questions, selectedAnswers, state.quiz.neg]);

  const handleReportSubmit = (reason: string) => {
    if (!reportQuestion) return;
    const newReport = {
      id: 'r_' + Math.random().toString(36).slice(2, 8),
      mcq: reportQuestion.q,
      kind: 'MCQ' as const,
      user: 'Practice Student',
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
    <div className={`min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] ${state.prot.noselect ? 'noselect' : ''}`}>
      <Navbar siteName={state.site.name} />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 pb-20">
        {/* Anti-Cheat Alert Banner */}
        {cheatWarnings.length > 0 && !isSubmitted && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">⚠️ Anti-Cheat Warning:</span>
              <span>{cheatWarnings[0]}</span>
            </div>
            <span className="font-mono font-bold">
              Violations: {tabSwitchCount}/{state.sec.antiCheat.maxTabSwitches}
            </span>
          </div>
        )}

        {/* Ad placement if enabled */}
        <AdBanner placement="mcq" adsConfig={state.ads} />

        {/* Course Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--mut)]">Course:</span>
            <select
              value={selectedCourse}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                setCurrentIndex(0);
                setSelectedAnswers({});
                setIsSubmitted(false);
              }}
              className="text-xs font-semibold py-1.5 px-3 rounded-lg border bg-[var(--card)]"
            >
              <option value="">All Courses ({state.mcqs.length})</option>
              {state.courses.map((c) => (
                <option key={c} value={c}>
                  {c} ({state.mcqs.filter((m) => m.course === c).length})
                </option>
              ))}
            </select>
          </div>

          {state.quiz.qt > 0 && !isSubmitted && (
            <div className="flex items-center gap-2 font-mono font-bold text-sm bg-[var(--card)] px-3 py-1 rounded-lg border border-[var(--line)]">
              <span>⏱️</span>
              <span className={timeLeft <= 10 ? 'text-[var(--red)] animate-pulse' : 'text-[var(--pri)]'}>
                {timeLeft}s
              </span>
            </div>
          )}

          <div className="text-xs text-[var(--mut)] font-semibold">
            Question {questions.length > 0 ? currentIndex + 1 : 0} of {questions.length}
          </div>
        </div>

        {/* Questions Display or Result Card */}
        {questions.length === 0 ? (
          <div className="card text-center py-12">
            <h3 className="text-lg font-bold mb-2">No Questions Available</h3>
            <p className="sub mb-4">No MCQs have been added for this category yet.</p>
            <Link href="/admin" className="b p text-xs">
              Go to Admin to Import MCQs →
            </Link>
          </div>
        ) : !isSubmitted ? (
          /* Active Question Card */
          <div className="card p-6 md:p-8">
            <div className="flex justify-between items-start gap-4 mb-4">
              <div>
                <span className="badge mr-2">{currentQ.course}</span>
                <span className="text-xs text-[var(--mut)] font-semibold">{currentQ.topic}</span>
              </div>
              <button
                type="button"
                onClick={() => setReportQuestion(currentQ)}
                className="text-xs text-[var(--mut)] hover:text-[var(--red)] transition-colors cursor-pointer"
                title="Report issue with question"
              >
                ⚑ Report
              </button>
            </div>

            <h2 className="text-lg md:text-xl font-bold mb-6 leading-snug">
              {currentQ.q}
            </h2>

            {/* Options List */}
            <div className="flex flex-col gap-3 mb-6">
              {currentQ.o.map((opt, optIdx) => {
                const isSelected = selectedAnswers[currentIndex] === optIdx;
                const showExplanation = state.quiz.expl && selectedAnswers[currentIndex] !== undefined;
                const isCorrect = optIdx === currentQ.a;

                let optClass = 'border-[var(--line)] bg-[var(--card)] hover:border-[var(--pri)]';
                if (showExplanation) {
                  if (isCorrect) {
                    optClass = 'border-green-600 bg-green-50 text-green-900 dark:bg-green-950/40 dark:border-green-700';
                  } else if (isSelected) {
                    optClass = 'border-red-500 bg-red-50 text-red-900 dark:bg-red-950/40 dark:border-red-700';
                  }
                } else if (isSelected) {
                  optClass = 'border-[var(--pri)] bg-[var(--pri2)] font-semibold';
                }

                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => handleSelectOption(optIdx)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${optClass}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg border border-[var(--line)] flex items-center justify-center font-bold text-xs bg-[var(--bg)] flex-shrink-0">
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span className="text-sm font-medium">{opt}</span>
                    </div>

                    {showExplanation && (
                      <span>
                        {isCorrect ? '✓' : isSelected ? '✕' : ''}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation box if enabled and answered */}
            {state.quiz.expl && selectedAnswers[currentIndex] !== undefined && currentQ.exp && (
              <div className="p-4 bg-[var(--pri2)] text-[var(--ink)] rounded-xl border border-[var(--line)] text-xs mb-6">
                <b className="text-[var(--pri)] block mb-1">Explanation:</b>
                <p className="leading-relaxed">{currentQ.exp}</p>
              </div>
            )}

            {/* Source Tag */}
            {currentQ.src && (
              <div className="text-[11px] text-[var(--mut)] mb-4">
                Past Paper Source: <span className="font-semibold">{currentQ.src}</span>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="b disabled:opacity-30 disabled:cursor-not-allowed text-xs"
              >
                ← Previous
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubmitted(true)}
                  className="b text-xs text-[var(--red)]"
                >
                  End Test
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="b p text-xs px-5"
                >
                  {currentIndex === questions.length - 1 ? 'Submit & Review' : 'Next Question →'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Results Summary Card */
          <div className="card p-6 md:p-8">
            <h2 className="text-2xl font-extrabold mb-1 text-center">Test Complete!</h2>
            <p className="sub text-center mb-6">Here is your detailed performance breakdown</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="stat text-center">
                <span>Score</span>
                <b className="text-[var(--pri)]">{stats.finalScore}</b>
              </div>
              <div className="stat text-center">
                <span>Accuracy</span>
                <b>{stats.accuracy}%</b>
              </div>
              <div className="stat text-center">
                <span>Correct</span>
                <b className="text-green-600">{stats.correct}</b>
              </div>
              <div className="stat text-center">
                <span>Wrong</span>
                <b className="text-[var(--red)]">{stats.wrong}</b>
              </div>
            </div>

            {state.quiz.neg && (
              <p className="text-xs text-center text-[var(--mut)] mb-6">
                * Negative marking applied: -0.25 marks per incorrect response.
              </p>
            )}

            {/* Review of all questions */}
            <h3 className="font-bold text-base mb-3">Question Review</h3>
            <div className="flex flex-col gap-3 mb-6 max-h-96 overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const userAns = selectedAnswers[idx];
                const isCorrect = userAns === q.a;
                const isSkipped = userAns === undefined;

                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-xl border ${
                      isCorrect
                        ? 'border-green-300 bg-green-50/50 dark:bg-green-950/20'
                        : isSkipped
                        ? 'border-[var(--line)] bg-[var(--card)]'
                        : 'border-red-300 bg-red-50/50 dark:bg-red-950/20'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <span className="font-semibold text-xs">
                        {idx + 1}. {q.q}
                      </span>
                      <span
                        className={`badge text-[10px] ${
                          isCorrect ? '' : isSkipped ? 'pending' : 'rejected'
                        }`}
                      >
                        {isCorrect ? 'Correct' : isSkipped ? 'Skipped' : 'Incorrect'}
                      </span>
                    </div>

                    <div className="text-xs text-[var(--mut)] mt-1">
                      <div>Correct Answer: <b>{q.o[q.a]}</b></div>
                      {userAns !== undefined && !isCorrect && (
                        <div className="text-[var(--red)]">
                          Your Answer: {q.o[userAns]}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-center gap-3">
              {state.quiz.retake && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAnswers({});
                    setCurrentIndex(0);
                    setIsSubmitted(false);
                    setCheatWarnings([]);
                    setTabSwitchCount(0);
                  }}
                  className="b p text-xs px-6 py-2.5"
                >
                  ↻ Retake Test
                </button>
              )}
              <Link href="/courses" className="b text-xs px-6 py-2.5">
                Practice Another Course
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Report Modal */}
      {reportQuestion && (
        <ReportModal
          isOpen={Boolean(reportQuestion)}
          questionText={reportQuestion.q}
          kind="MCQ"
          onClose={() => setReportQuestion(null)}
          onSubmit={handleReportSubmit}
        />
      )}
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 text-sm font-semibold text-[var(--mut)]">
          Loading practice questions...
        </div>
      }
    >
      <PracticeContent />
    </Suspense>
  );
}
