'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import {
  loadAppState,
  seedInitialData,
  getActiveCourse,
  setActiveCourse,
} from '@/lib/store';
import { AppState, TopicResource } from '@/lib/types';

export default function CoursesPage() {
  const router = useRouter();
  const [state, setState] = useState<AppState>(seedInitialData());
  const [activeCourseName, setActiveCourseName] = useState('MDCAT');
  const [selectedFilter, setSelectedFilter] = useState('');
  const [activeVideoModal, setActiveVideoModal] = useState<TopicResource | null>(null);

  useEffect(() => {
    setState(loadAppState());
    setActiveCourseName(getActiveCourse());
  }, []);

  const handleEnrollCourse = (courseName: string) => {
    setActiveCourse(courseName);
    setActiveCourseName(courseName);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('sj_course_changed'));
    }
    router.push('/dashboard');
  };

  const getEmbedUrl = (url: string) => {
    try {
      if (url.includes('youtube.com/watch?v=')) {
        const id = url.split('v=')[1]?.split('&')[0];
        return `https://www.youtube-nocookie.com/embed/${id}`;
      } else if (url.includes('youtu.be/')) {
        const id = url.split('youtu.be/')[1]?.split('?')[0];
        return `https://www.youtube-nocookie.com/embed/${id}`;
      }
      return url;
    } catch {
      return url;
    }
  };

  const displayedCourses = selectedFilter
    ? state.courses.filter((c) => c.name === selectedFilter)
    : state.courses;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)]">
      <Navbar siteName={state.site.name} />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 pb-20">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Curriculum, Topics &amp; Resources
            </h1>
            <p className="sub text-xs sm:text-sm mt-1">
              Select your course to view syllabus topics, watch video lectures, and practice verified questions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--mut)]">Filter:</span>
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="text-xs font-semibold py-2 px-3 rounded-xl border bg-[var(--card)] shadow-xs"
            >
              <option value="">All Courses ({state.courses.length})</option>
              {state.courses.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Courses List */}
        <div className="flex flex-col gap-8">
          {displayedCourses.map((course) => {
            const courseTopics = state.topics.filter((t) => t.courseName === course.name);
            const courseMcqs = state.mcqs.filter((m) => m.course === course.name);
            const isEnrolled = course.name === activeCourseName;

            return (
              <div
                key={course.id}
                className={`card p-6 md:p-8 transition-all shadow-xs ${
                  isEnrolled ? 'border-[var(--pri)] ring-1 ring-[var(--pri)]' : ''
                }`}
              >
                {/* Course Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--line)]">
                  <div className="flex items-center gap-3.5">
                    <span className="text-3xl p-2.5 rounded-2xl bg-[var(--bg)] border border-[var(--line)]">
                      {course.icon}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-xl font-extrabold">{course.name}</h2>
                        <span className="badge text-[10px]">{course.badge}</span>
                        {isEnrolled && (
                          <span className="px-2 py-0.5 rounded-full bg-[var(--pri)] text-white text-[10px] font-bold">
                            Current Enrolled Course
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--mut)] max-w-xl">
                        {course.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    {!isEnrolled ? (
                      <button
                        type="button"
                        onClick={() => handleEnrollCourse(course.name)}
                        className="b p text-xs font-bold px-4 py-2 rounded-xl"
                      >
                        Enroll in this Course
                      </button>
                    ) : (
                      <Link
                        href="/dashboard"
                        className="b p text-xs font-bold px-4 py-2 rounded-xl"
                      >
                        Go to Dashboard →
                      </Link>
                    )}
                    <Link
                      href={`/practice?course=${encodeURIComponent(course.name)}`}
                      className="b text-xs font-semibold px-3.5 py-2 rounded-xl"
                    >
                      Practice All ({courseMcqs.length})
                    </Link>
                  </div>
                </div>

                {/* Topics in this Course */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--mut)] mb-3">
                    Syllabus Topics &amp; Resources ({courseTopics.length})
                  </h3>

                  {courseTopics.length === 0 ? (
                    <p className="text-xs text-[var(--mut)] py-4">No topics populated for this course yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {courseTopics.map((topic, idx) => {
                        const topicMcqCount = courseMcqs.filter((m) => m.topic === topic.name).length;
                        const ytRes = topic.resources?.find((r) => r.type === 'youtube');
                        const pdfRes = topic.resources?.find((r) => r.type === 'pdf');

                        return (
                          <div
                            key={topic.id}
                            className="p-4 rounded-xl border border-[var(--line)] bg-[var(--bg)] flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="font-bold text-xs text-[var(--ink)]">
                                  {idx + 1}. {topic.name}
                                </span>
                                <span className="badge text-[10px]">{topicMcqCount} MCQs</span>
                              </div>
                              {topic.description && (
                                <p className="text-[11px] text-[var(--mut)] mb-3 line-clamp-2">
                                  {topic.description}
                                </p>
                              )}

                              {/* Resources */}
                              <div className="flex flex-wrap gap-2 mb-3">
                                {ytRes && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveVideoModal(ytRes)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 cursor-pointer"
                                  >
                                    ▶ Lecture
                                  </button>
                                )}
                                {pdfRes && (
                                  <a
                                    href={pdfRes.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                  >
                                    📄 PDF Notes
                                  </a>
                                )}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-[var(--line)] flex justify-end">
                              <Link
                                href={`/practice?course=${encodeURIComponent(course.name)}&topic=${encodeURIComponent(topic.name)}`}
                                className="text-xs font-bold text-[var(--pri)] hover:underline"
                              >
                                Practice Topic →
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Video Modal */}
      {activeVideoModal && (
        <div className="modal-overlay" onClick={() => setActiveVideoModal(null)}>
          <div className="modal-box max-w-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold line-clamp-1">{activeVideoModal.title}</h3>
              <button
                type="button"
                onClick={() => setActiveVideoModal(null)}
                className="text-lg text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer ml-2"
              >
                ✕
              </button>
            </div>

            <div className="relative aspect-video rounded-xl overflow-hidden bg-black mb-3 border border-[var(--line)]">
              <iframe
                src={getEmbedUrl(activeVideoModal.url)}
                title={activeVideoModal.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div className="flex justify-between items-center text-xs text-[var(--mut)]">
              <span>Verified Video Lecture</span>
              <a
                href={activeVideoModal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--pri)] font-bold hover:underline"
              >
                Open on YouTube ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
