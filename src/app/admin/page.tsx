'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { AdminNav, AdminViewKey } from '@/components/AdminNav';
import {
  loadAppState,
  saveAppState,
  addAuditLog,
  seedInitialData,
  uid,
  THEME_KEY,
} from '@/lib/store';
import {
  AppState,
  User,
  MCQ,
  RattaCard,
  Report,
  JsonSourceItem,
} from '@/lib/types';

export default function AdminPage() {
  const [state, setState] = useState<AppState>(seedInitialData());
  const [view, setView] = useState<AdminViewKey>('dash');
  const [online, setOnline] = useState(7);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);

  // Users view state
  const [userQuery, setUserQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');

  // MCQ view state
  const [mcqQuery, setMcqQuery] = useState('');
  const [mcqJsonInput, setMcqJsonInput] = useState('');
  const [jsonLinkUrl, setJsonLinkUrl] = useState('');
  const [jsonLinkKind, setJsonLinkKind] = useState('Same hosting');

  // Course state
  const [newCourseName, setNewCourseName] = useState('');

  // Ratta state
  const [rattaQ, setRattaQ] = useState('');
  const [rattaA, setRattaA] = useState('');
  const [rattaTopic, setRattaTopic] = useState('');
  const [rattaCourse, setRattaCourse] = useState('MDCAT');
  const [rattaSrc, setRattaSrc] = useState('');
  const [rattaJsonInput, setRattaJsonInput] = useState('');

  // Announcements state
  const [annTitle, setAnnTitle] = useState('');
  const [annMsg, setAnnMsg] = useState('');
  const [annKind, setAnnKind] = useState<'info' | 'warning' | 'success'>('info');

  // Security state
  const [newIp, setNewIp] = useState('');

  // Dynamic live feed
  const [feed, setFeed] = useState<[string, string][]>([
    ['Ayesha Khan', 'solved an MCQ'],
    ['Hira Malik', 'started a revision set'],
    ['Bilal Ahmed', 'logged in with Google'],
  ]);

  // Load from local storage on mount
  useEffect(() => {
    const loaded = loadAppState();
    setState(loaded);

    // Apply saved theme
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) {
      document.documentElement.dataset.theme = savedTheme;
    }

    // Live activity ticker
    const interval = setInterval(() => {
      setOnline((prev) => Math.max(1, prev + Math.floor(Math.random() * 3) - 1));
      const actions = [
        'solved an MCQ',
        'finished a revision set',
        'shared a score',
        'bookmarked a question',
        'logged in with Google',
      ];
      setFeed((prev) => {
        const uList = loaded.users.filter((u) => u.status === 'active');
        if (!uList.length) return prev;
        const randomUser = uList[Math.floor(Math.random() * uList.length)];
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        return [[randomUser.name, randomAction], ...prev.slice(0, 11)];
      });
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMsg(null), 2000);
  };

  const updateStateAndSave = (updater: (prev: AppState) => AppState, auditDesc?: string) => {
    setState((prev) => {
      let next = updater(prev);
      if (auditDesc) {
        next = addAuditLog(next, auditDesc);
      }
      saveAppState(next);
      return next;
    });
  };

  const toggleTheme = () => {
    const current = document.documentElement.dataset.theme || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    showToast(`Switched to ${next} mode`);
  };

  // Time-ago formatter
  const timeAgo = (t: number) => {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.round(m / 60)}h ago`;
    return `${Math.round(m / 1440)}d ago`;
  };

  // CSV Exporter
  const exportCsv = (title: string, rows: (string | number)[][]) => {
    const csvContent = rows
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    setModalContent(
      <div>
        <h3 className="text-base font-bold mb-1">{title}</h3>
        <p className="sub mb-3">Copy and paste into Excel, Google Sheets or save as .csv</p>
        <textarea
          readOnly
          value={csvContent}
          className="w-full h-48 p-2 font-mono text-xs border rounded-lg bg-[var(--bg)]"
        />
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            className="b p"
            onClick={() => {
              navigator.clipboard.writeText(csvContent);
              showToast('CSV Copied to clipboard!');
            }}
          >
            Copy
          </button>
          <button type="button" className="b" onClick={() => setModalContent(null)}>
            Close
          </button>
        </div>
      </div>
    );
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    const q = userQuery.toLowerCase().trim();
    return state.users.filter((u) => {
      const matchQ = (u.name + u.email + u.course).toLowerCase().includes(q);
      const matchStatus = !userStatusFilter || u.status === userStatusFilter;
      return matchQ && matchStatus;
    });
  }, [state.users, userQuery, userStatusFilter]);

  // Filtered MCQs
  const filteredMcqs = useMemo(() => {
    const q = mcqQuery.toLowerCase().trim();
    return state.mcqs.filter((m) =>
      (m.q + m.topic + m.course + (m.src || '')).toLowerCase().includes(q)
    );
  }, [state.mcqs, mcqQuery]);

  // ==========================================
  // VIEW RENDERERS
  // ==========================================

  const renderDashboard = () => {
    const activeUsers = state.users.filter((u) => u.status === 'active');
    const pendingReports = state.reports.filter((r) => r.status === 'pending');
    const maxWeekVal = Math.max(...state.week, 1);
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-4">
          <div className="stat">
            <span>Total Users</span>
            <b>{state.users.length}</b>
          </div>
          <div className="stat">
            <span>
              <i className="dot" />
              Online Now
            </span>
            <b className="text-[var(--pri)]">{online}</b>
          </div>
          <div className="stat">
            <span>Active Accounts</span>
            <b>{activeUsers.length}</b>
          </div>
          <div className="stat">
            <span>MCQs in Bank</span>
            <b>{state.mcqs.length}</b>
          </div>
          <div className="stat">
            <span>Pending Reports</span>
            <b className={pendingReports.length > 0 ? 'text-[var(--amb)]' : ''}>
              {pendingReports.length}
            </b>
          </div>
          <div className="stat">
            <span>Ads Status</span>
            <b>{state.ads.on ? 'ON' : 'OFF'}</b>
          </div>
        </div>

        <div className="two mb-4">
          <div className="card">
            <h3>MCQs Solved This Week</h3>
            <div className="tw">
              <svg viewBox="0 0 380 175" className="w-full min-w-[320px]">
                {state.week.map((val, i) => {
                  const h = (val / maxWeekVal) * 125;
                  const x = i * 52 + 10;
                  return (
                    <g key={i}>
                      <rect
                        x={x}
                        y={145 - h}
                        width="34"
                        height={h}
                        rx="6"
                        fill="var(--pri)"
                        opacity="0.88"
                      />
                      <text
                        x={x + 17}
                        y="164"
                        fontSize="11"
                        textAnchor="middle"
                        fill="var(--mut)"
                      >
                        {dayLabels[i]}
                      </text>
                      <text
                        x={x + 17}
                        y={138 - h}
                        fontSize="11"
                        fontWeight="700"
                        textAnchor="middle"
                        fill="var(--ink)"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="card">
            <h3>
              <i className="dot" />
              Live User Activity
            </h3>
            <div className="feed flex flex-col gap-2">
              {feed.slice(0, 6).map((item, i) => (
                <div key={i} className="py-2 border-b border-[var(--line)] text-xs flex justify-between">
                  <span>
                    <b>{item[0]}</b> {item[1]}
                  </span>
                  <span className="text-[var(--mut)]">now</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Enrolled Course Distribution</h3>
          <div className="flex flex-col gap-2">
            {state.courses.map((course) => {
              const uCount = state.users.filter((u) => u.course === course).length;
              const qCount = state.mcqs.filter((m) => m.course === course).length;
              return (
                <div key={course} className="tg">
                  <span className="font-bold">{course}</span>
                  <span className="text-xs text-[var(--mut)]">
                    <b>{uCount}</b> users · <b>{qCount}</b> MCQs available
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderUsers = () => {
    return (
      <div className="card">
        <div className="row">
          <input
            type="search"
            placeholder="Search name, email or course..."
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
          />
          <select
            value={userStatusFilter}
            onChange={(e) => setUserStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
          <button
            type="button"
            className="b"
            onClick={() =>
              exportCsv(
                'Users Export',
                [
                  ['Name', 'Email', 'Course', 'Status', 'Solved', 'Accuracy', 'Streak', 'MultiAccountFlag'],
                  ...state.users.map((u) => [
                    u.name,
                    u.email,
                    u.course,
                    u.status,
                    u.solved,
                    `${u.acc}%`,
                    u.streak,
                    u.multiAccountFlag ? 'YES' : 'NO',
                  ]),
                ]
              )
            }
          >
            Export CSV
          </button>
        </div>

        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Course</th>
                <th>Solved · Acc</th>
                <th>Status</th>
                <th>Security / Device</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-[var(--mut)]">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <b>{u.name}</b>
                      <small>{u.email}</small>
                    </td>
                    <td>{u.course}</td>
                    <td>
                      {u.solved} · {u.acc}%
                    </td>
                    <td>
                      <span className={`badge ${u.status}`}>{u.status}</span>
                    </td>
                    <td>
                      {u.multiAccountFlag ? (
                        <span className="badge banned" title="Multiple accounts detected on this device">
                          ⚠️ Multi-Acc
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--mut)]">Verified single</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        <button
                          type="button"
                          className="b text-xs"
                          onClick={() => {
                            setModalContent(
                              <div>
                                <h3 className="text-base font-bold mb-1">{u.name}</h3>
                                <p className="sub mb-3">
                                  {u.email} · {u.course} ·{' '}
                                  <span className={`badge ${u.status}`}>{u.status}</span>
                                </p>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                  <div className="stat p-2">
                                    <span>Solved</span>
                                    <b>{u.solved}</b>
                                  </div>
                                  <div className="stat p-2">
                                    <span>Accuracy</span>
                                    <b>{u.acc}%</b>
                                  </div>
                                  <div className="stat p-2">
                                    <span>Streak</span>
                                    <b>{u.streak}d</b>
                                  </div>
                                </div>
                                <h4 className="font-bold text-xs mb-1">Activity Log</h4>
                                <div className="feed max-h-48 overflow-y-auto mb-3">
                                  {u.acts.map((act, idx) => (
                                    <div key={idx} className="py-1 text-xs">
                                      {act[0]} <small className="text-[var(--mut)]">· {timeAgo(act[1])}</small>
                                    </div>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  className="b"
                                  onClick={() => setModalContent(null)}
                                >
                                  Close
                                </button>
                              </div>
                            );
                          }}
                        >
                          View
                        </button>
                        {u.status === 'active' ? (
                          <>
                            <button
                              type="button"
                              className="b text-xs"
                              onClick={() => {
                                updateStateAndSave(
                                  (prev) => ({
                                    ...prev,
                                    users: prev.users.map((x) =>
                                      x.id === u.id ? { ...x, status: 'suspended' } : x
                                    ),
                                  }),
                                  `Suspended user ${u.name}`
                                );
                                showToast(`${u.name} suspended`);
                              }}
                            >
                              Suspend
                            </button>
                            <button
                              type="button"
                              className="b d text-xs"
                              onClick={() => {
                                updateStateAndSave(
                                  (prev) => ({
                                    ...prev,
                                    users: prev.users.map((x) =>
                                      x.id === u.id ? { ...x, status: 'banned' } : x
                                    ),
                                  }),
                                  `Banned user ${u.name}`
                                );
                                showToast(`${u.name} banned`);
                              }}
                            >
                              Ban
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="b p text-xs"
                            onClick={() => {
                              updateStateAndSave(
                                (prev) => ({
                                  ...prev,
                                  users: prev.users.map((x) =>
                                    x.id === u.id ? { ...x, status: 'active' } : x
                                  ),
                                }),
                                `Restored user ${u.name}`
                              );
                              showToast(`${u.name} restored to active`);
                            }}
                          >
                            Restore
                          </button>
                        )}
                        <button
                          type="button"
                          className="b text-xs"
                          onClick={() => {
                            if (confirm(`Reset progress for ${u.name}?`)) {
                              updateStateAndSave(
                                (prev) => ({
                                  ...prev,
                                  users: prev.users.map((x) =>
                                    x.id === u.id
                                      ? {
                                          ...x,
                                          solved: 0,
                                          acc: 0,
                                          streak: 0,
                                          acts: [['Progress reset by admin', Date.now()], ...x.acts],
                                        }
                                      : x
                                  ),
                                }),
                                `Reset progress: ${u.name}`
                              );
                              showToast('Progress reset');
                            }
                          }}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          className="b d text-xs"
                          onClick={() => {
                            if (confirm(`Permanently delete ${u.name}?`)) {
                              updateStateAndSave(
                                (prev) => ({
                                  ...prev,
                                  users: prev.users.filter((x) => x.id !== u.id),
                                }),
                                `Deleted user ${u.name}`
                              );
                              showToast('User deleted');
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCourses = () => {
    return (
      <div className="card">
        <div className="row">
          <input
            type="text"
            placeholder="New course name (e.g. NUST NET, USAT, GAT)..."
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
          />
          <button
            type="button"
            className="b p"
            onClick={() => {
              const val = newCourseName.trim();
              if (!val) return showToast('Please enter a course name');
              if (state.courses.includes(val)) return showToast('Course already exists');
              updateStateAndSave(
                (prev) => ({ ...prev, courses: [...prev.courses, val] }),
                `Added course ${val}`
              );
              setNewCourseName('');
              showToast(`Course "${val}" added`);
            }}
          >
            Add Course
          </button>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          {state.courses.map((course) => {
            const uCount = state.users.filter((u) => u.course === course).length;
            const qCount = state.mcqs.filter((m) => m.course === course).length;
            return (
              <div key={course} className="tg">
                <div>
                  <b className="text-base">{course}</b>
                  <small>
                    {uCount} users selected · {qCount} MCQs in bank
                  </small>
                </div>
                <button
                  type="button"
                  className="b d"
                  onClick={() => {
                    if (confirm(`Remove course ${course}?`)) {
                      updateStateAndSave(
                        (prev) => ({
                          ...prev,
                          courses: prev.courses.filter((c) => c !== course),
                        }),
                        `Removed course ${course}`
                      );
                      showToast(`Removed ${course}`);
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMcqs = () => {
    const handleImportJson = () => {
      try {
        const parsed = JSON.parse(mcqJsonInput);
        if (!Array.isArray(parsed)) return showToast('Input must be a JSON array of MCQs');
        let imported = 0;
        let skipped = 0;
        const newItems: MCQ[] = [];

        parsed.forEach((x: any) => {
          if (
            x &&
            typeof x.q === 'string' &&
            x.q.trim() &&
            Array.isArray(x.o) &&
            x.o.length >= 2 &&
            Number.isInteger(x.a) &&
            x.a >= 0 &&
            x.a < x.o.length
          ) {
            newItems.push({
              id: uid('q'),
              q: x.q.trim(),
              o: x.o.map(String),
              a: x.a,
              topic: x.topic || 'General',
              course: x.course || 'General',
              src: x.src || '',
              exp: x.exp || '',
            });
            imported++;
          } else {
            skipped++;
          }
        });

        if (newItems.length > 0) {
          updateStateAndSave(
            (prev) => ({ ...prev, mcqs: [...newItems, ...prev.mcqs] }),
            `Bulk imported ${imported} MCQs (${skipped} skipped)`
          );
          setMcqJsonInput('');
          showToast(`Successfully imported ${imported} MCQs!`);
        } else {
          showToast(`Failed to import: ${skipped} invalid format`);
        }
      } catch {
        showToast('Invalid JSON syntax');
      }
    };

    return (
      <div className="flex flex-col gap-4">
        {/* Bulk Upload Card */}
        <div className="card">
          <h3>Bulk JSON Upload</h3>
          <div className="row mb-2">
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => setMcqJsonInput(String(reader.result || ''));
                  reader.readAsText(file);
                }
              }}
            />
            <button
              type="button"
              className="b"
              onClick={() => {
                setMcqJsonInput(
                  JSON.stringify(
                    [
                      {
                        q: 'Which organelle makes ATP?',
                        o: ['Nucleus', 'Mitochondria', 'Lysosome', 'Vacuole'],
                        a: 1,
                        topic: 'Cell Biology',
                        course: 'MDCAT',
                        src: 'MDCAT 2023',
                        exp: 'Mitochondria synthesize ATP through cellular respiration.',
                      },
                      {
                        q: 'Unit of resistance?',
                        o: ['Ohm', 'Volt', 'Amp', 'Watt'],
                        a: 0,
                        topic: 'Physics',
                        course: 'ECAT',
                        src: '',
                        exp: 'Resistance = Voltage / Current (Ohm).',
                      },
                    ],
                    null,
                    2
                  )
                );
              }}
            >
              Load Sample JSON
            </button>
          </div>

          <textarea
            placeholder="Paste a JSON array of MCQs here..."
            value={mcqJsonInput}
            onChange={(e) => setMcqJsonInput(e.target.value)}
            className="w-full"
          />
          <div className="mt-2.5">
            <button type="button" className="b p" onClick={handleImportJson}>
              Import MCQs
            </button>
          </div>
          <p className="sub mt-2">
            Fields required: <code>q</code> (question), <code>o</code> (options array),{' '}
            <code>a</code> (correct answer index starting at 0), <code>topic</code>,{' '}
            <code>course</code>, <code>src</code> (past paper source or empty), <code>exp</code> (explanation).
          </p>
        </div>

        {/* JSON Links Card */}
        <div className="card">
          <h3>JSON Links (Sync from Hosted URLs)</h3>
          <div className="row">
            <input
              type="text"
              placeholder="/data/biology.json or https://example.com/mcqs.json"
              value={jsonLinkUrl}
              onChange={(e) => setJsonLinkUrl(e.target.value)}
            />
            <select
              value={jsonLinkKind}
              onChange={(e) => setJsonLinkKind(e.target.value)}
              className="max-w-[180px]"
            >
              <option value="Same hosting">Same hosting</option>
              <option value="External link">External link</option>
            </select>
            <button
              type="button"
              className="b p"
              onClick={() => {
                const u = jsonLinkUrl.trim();
                if (!u) return showToast('Enter a URL or path');
                updateStateAndSave(
                  (prev) => ({
                    ...prev,
                    srcs: [...prev.srcs, { id: uid('s'), u, k: jsonLinkKind }],
                  }),
                  `Added JSON link ${u}`
                );
                setJsonLinkUrl('');
                showToast('JSON Link added');
              }}
            >
              Add Link
            </button>
          </div>

          <div className="flex flex-col gap-2 mt-3">
            {state.srcs.map((src) => (
              <div key={src.id} className="tg">
                <div>
                  <b className="font-mono text-xs">{src.u}</b>
                  <small>{src.k}</small>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="b"
                    onClick={async () => {
                      try {
                        const res = await fetch(src.u);
                        if (!res.ok) throw new Error('Fetch failed');
                        const data = await res.json();
                        setMcqJsonInput(JSON.stringify(data, null, 2));
                        showToast('Fetched link data into import box!');
                      } catch {
                        showToast('Could not fetch link (ensure CORS is enabled)');
                      }
                    }}
                  >
                    Fetch &amp; Import
                  </button>
                  <button
                    type="button"
                    className="b d"
                    onClick={() => {
                      updateStateAndSave(
                        (prev) => ({
                          ...prev,
                          srcs: prev.srcs.filter((s) => s.id !== src.id),
                        }),
                        `Removed JSON link ${src.u}`
                      );
                      showToast('Link removed');
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Existing MCQs List */}
        <div className="card">
          <div className="row">
            <input
              type="search"
              placeholder="Search MCQs by question, topic or course..."
              value={mcqQuery}
              onChange={(e) => setMcqQuery(e.target.value)}
            />
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Topic</th>
                  <th>Course</th>
                  <th>Source</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMcqs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-[var(--mut)]">
                      No MCQs found.
                    </td>
                  </tr>
                ) : (
                  filteredMcqs.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <span className="font-semibold">{m.q}</span>
                        <small className="text-[var(--pri)] font-medium">
                          Answer: {m.o[m.a]}
                        </small>
                      </td>
                      <td>{m.topic}</td>
                      <td>{m.course}</td>
                      <td>
                        {m.src ? (
                          <span className="badge">{m.src}</span>
                        ) : (
                          <span className="badge pending">Chances</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="b d"
                          onClick={() => {
                            updateStateAndSave(
                              (prev) => ({
                                ...prev,
                                mcqs: prev.mcqs.filter((x) => x.id !== m.id),
                              }),
                              `Deleted MCQ: ${m.q.slice(0, 30)}...`
                            );
                            showToast('MCQ deleted');
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderRatta = () => {
    return (
      <div className="flex flex-col gap-4">
        <div className="card">
          <h3>Add a Ratta Revision Card</h3>
          <textarea
            placeholder="Card text. Use ______ for the blank space to recall..."
            value={rattaQ}
            onChange={(e) => setRattaQ(e.target.value)}
            className="w-full min-h-[60px]"
          />
          <div className="row mt-2.5">
            <input
              type="text"
              placeholder="Answer to fill in blank"
              value={rattaA}
              onChange={(e) => setRattaA(e.target.value)}
            />
            <input
              type="text"
              placeholder="Topic"
              value={rattaTopic}
              onChange={(e) => setRattaTopic(e.target.value)}
            />
            <select
              value={rattaCourse}
              onChange={(e) => setRattaCourse(e.target.value)}
            >
              {state.courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Past paper source (leave empty for Chances)"
              value={rattaSrc}
              onChange={(e) => setRattaSrc(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="b p mt-2"
            onClick={() => {
              if (!rattaQ.trim() || !rattaA.trim()) {
                return showToast('Add card text and answer');
              }
              const newCard: RattaCard = {
                id: uid('c'),
                q: rattaQ.trim(),
                a: rattaA.trim(),
                topic: rattaTopic.trim() || 'General',
                course: rattaCourse,
                src: rattaSrc.trim(),
              };
              updateStateAndSave(
                (prev) => ({ ...prev, ratta: [newCard, ...prev.ratta] }),
                'Added a Ratta revision card'
              );
              setRattaQ('');
              setRattaA('');
              setRattaSrc('');
              showToast('Ratta Card created!');
            }}
          >
            Add Card
          </button>
        </div>

        <div className="card">
          <h3>Bulk JSON Upload for Cards</h3>
          <textarea
            placeholder="Paste a JSON array of cards: [{ q: '...', a: '...', topic: '...', course: '...', src: '...' }]"
            value={rattaJsonInput}
            onChange={(e) => setRattaJsonInput(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              className="b"
              onClick={() => {
                setRattaJsonInput(
                  JSON.stringify(
                    [
                      {
                        q: '______ is the powerhouse of the cell.',
                        a: 'Mitochondria',
                        topic: 'Cell Biology',
                        course: 'MDCAT',
                        src: 'MDCAT 2022',
                      },
                    ],
                    null,
                    2
                  )
                );
              }}
            >
              Load Sample
            </button>
            <button
              type="button"
              className="b p"
              onClick={() => {
                try {
                  const arr = JSON.parse(rattaJsonInput);
                  if (!Array.isArray(arr)) return showToast('Must be an array');
                  let count = 0;
                  const newCards: RattaCard[] = [];
                  arr.forEach((item: any) => {
                    if (item?.q && item?.a) {
                      newCards.push({
                        id: uid('c'),
                        q: String(item.q).trim(),
                        a: String(item.a).trim(),
                        topic: item.topic || 'General',
                        course: item.course || 'General',
                        src: item.src || '',
                      });
                      count++;
                    }
                  });
                  updateStateAndSave(
                    (prev) => ({ ...prev, ratta: [...newCards, ...prev.ratta] }),
                    `Imported ${count} Ratta cards`
                  );
                  setRattaJsonInput('');
                  showToast(`${count} Ratta cards imported`);
                } catch {
                  showToast('Invalid JSON');
                }
              }}
            >
              Import Cards
            </button>
          </div>
        </div>

        <div className="card">
          <h3>{state.ratta.length} Cards in Library</h3>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Card Text</th>
                  <th>Answer</th>
                  <th>Topic</th>
                  <th>Source</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {state.ratta.map((card) => (
                  <tr key={card.id}>
                    <td>{card.q}</td>
                    <td>
                      <b>{card.a}</b>
                    </td>
                    <td>
                      {card.topic} <small>{card.course}</small>
                    </td>
                    <td>
                      {card.src ? (
                        <span className="badge">{card.src}</span>
                      ) : (
                        <span className="badge pending">Chances</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="b d"
                        onClick={() => {
                          updateStateAndSave(
                            (prev) => ({
                              ...prev,
                              ratta: prev.ratta.filter((c) => c.id !== card.id),
                            }),
                            'Deleted a Ratta card'
                          );
                          showToast('Card deleted');
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderReports = () => {
    return (
      <div className="card">
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Target Question</th>
                <th>Reported By</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.reports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-[var(--mut)]">
                    No reports submitted yet.
                  </td>
                </tr>
              ) : (
                state.reports.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="badge mr-2">{r.kind || 'MCQ'}</span>
                      <span className="font-semibold">{r.mcq}</span>
                      <small>{timeAgo(r.t)}</small>
                    </td>
                    <td>{r.user}</td>
                    <td>{r.reason}</td>
                    <td>
                      <span className={`badge ${r.status}`}>{r.status}</span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="b text-xs"
                          onClick={() => {
                            updateStateAndSave(
                              (prev) => ({
                                ...prev,
                                reports: prev.reports.map((x) =>
                                  x.id === r.id ? { ...x, status: 'fixed' } : x
                                ),
                              }),
                              `Report marked fixed: ${r.mcq}`
                            );
                            showToast('Marked as Fixed');
                          }}
                        >
                          Fixed
                        </button>
                        <button
                          type="button"
                          className="b text-xs"
                          onClick={() => {
                            updateStateAndSave(
                              (prev) => ({
                                ...prev,
                                reports: prev.reports.map((x) =>
                                  x.id === r.id ? { ...x, status: 'rejected' } : x
                                ),
                              }),
                              `Report rejected: ${r.mcq}`
                            );
                            showToast('Marked as Rejected');
                          }}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className="b d text-xs"
                          onClick={() => {
                            updateStateAndSave(
                              (prev) => ({
                                ...prev,
                                reports: prev.reports.filter((x) => x.id !== r.id),
                              }),
                              'Deleted a report'
                            );
                            showToast('Report deleted');
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAds = () => {
    const placements = [
      ['dash_top', 'Dashboard Top Banner'],
      ['dash_side', 'Dashboard Sidebar Banner'],
      ['mcq', 'MCQ Practice Page'],
      ['revision', 'Ratta Cards Revision Page'],
      ['result', 'Score Summary Page'],
      ['between', 'Between Questions Interval'],
    ] as const;

    return (
      <div className="flex flex-col gap-4">
        <div className="card">
          <div className="tg">
            <div>
              <b>Show Ads to Users</b>
              <small>Master switch for AdSense / Adsterra across the platform</small>
            </div>
            <label className="sw">
              <input
                type="checkbox"
                checked={state.ads.on}
                onChange={(e) => {
                  updateStateAndSave(
                    (prev) => ({
                      ...prev,
                      ads: { ...prev.ads, on: e.target.checked },
                    }),
                    `Master ads switch turned ${e.target.checked ? 'ON' : 'OFF'}`
                  );
                  showToast(`Ads ${e.target.checked ? 'Enabled' : 'Disabled'}`);
                }}
              />
              <span />
            </label>
          </div>

          <div className="row mt-3">
            <select
              value={state.ads.provider}
              onChange={(e) => {
                const val = e.target.value as 'adsense' | 'adsterra';
                updateStateAndSave((prev) => ({
                  ...prev,
                  ads: { ...prev.ads, provider: val },
                }));
                showToast(`Provider set to ${val}`);
              }}
            >
              <option value="adsense">Google AdSense</option>
              <option value="adsterra">Adsterra</option>
            </select>
          </div>

          <textarea
            placeholder="Paste your ad unit script / ins tag here..."
            value={state.ads.code}
            onChange={(e) => {
              const code = e.target.value;
              setState((prev) => ({ ...prev, ads: { ...prev.ads, code } }));
            }}
            className="w-full"
          />
          <div className="mt-2.5">
            <button
              type="button"
              className="b p"
              onClick={() => {
                updateStateAndSave(
                  (prev) => prev,
                  `Saved ad script code (${state.ads.provider})`
                );
                showToast('Ad script saved');
              }}
            >
              Save Ad Code
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Ad Placements</h3>
          {placements.map(([key, label]) => (
            <div key={key} className="tg">
              <div>
                <b>{label}</b>
                <small>{state.ads.on && state.ads.pl[key] ? 'Visible to students' : 'Hidden'}</small>
              </div>
              <label className="sw">
                <input
                  type="checkbox"
                  checked={state.ads.pl[key]}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    updateStateAndSave(
                      (prev) => ({
                        ...prev,
                        ads: {
                          ...prev.ads,
                          pl: { ...prev.ads.pl, [key]: checked },
                        },
                      }),
                      `Placement ${key} set to ${checked ? 'ON' : 'OFF'}`
                    );
                  }}
                />
                <span />
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAnnouncements = () => {
    return (
      <div className="flex flex-col gap-4">
        <div className="card">
          <div className="row">
            <input
              type="text"
              placeholder="Announcement Title"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
            />
            <select
              value={annKind}
              onChange={(e) => setAnnKind(e.target.value as any)}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
            </select>
          </div>
          <textarea
            placeholder="Broadcast message to all students..."
            value={annMsg}
            onChange={(e) => setAnnMsg(e.target.value)}
            className="w-full min-h-[70px]"
          />
          <button
            type="button"
            className="b p mt-2.5"
            onClick={() => {
              if (!annTitle.trim() || !annMsg.trim()) {
                return showToast('Add title and message');
              }
              const newAnn = {
                id: uid('a'),
                t: annTitle.trim(),
                m: annMsg.trim(),
                k: annKind,
                d: Date.now(),
              };
              updateStateAndSave(
                (prev) => ({ ...prev, ann: [newAnn, ...prev.ann] }),
                `Published announcement: ${newAnn.t}`
              );
              setAnnTitle('');
              setAnnMsg('');
              showToast('Announcement published!');
            }}
          >
            Publish Notice
          </button>
        </div>

        <div className="card">
          <h3>Active Announcements</h3>
          <div className="flex flex-col gap-2">
            {state.ann.length === 0 ? (
              <p className="sub">Nothing currently published.</p>
            ) : (
              state.ann.map((x) => (
                <div key={x.id} className="tg">
                  <div>
                    <b>{x.t}</b> <span className={`badge ${x.k}`}>{x.k}</span>
                    <small>
                      {x.m} · {timeAgo(x.d)}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="b d"
                    onClick={() => {
                      updateStateAndSave(
                        (prev) => ({
                          ...prev,
                          ann: prev.ann.filter((a) => a.id !== x.id),
                        }),
                        `Deleted announcement: ${x.t}`
                      );
                      showToast('Announcement deleted');
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFeatures = () => {
    const flagsList = [
      ['signup', 'Open Registration', 'New students can sign up and login via Google'],
      ['streaks', 'Streaks & Daily Goals', 'Track daily consistency and study streaks'],
      ['leaderboard', 'Leaderboard Ranking', 'Display student accuracy and questions solved rank'],
      ['timed', 'Timed Tests & Mock Exams', 'Enable countdown timer on test sessions'],
      ['notes', 'Personal Notes per MCQ', 'Allow students to jot personal study notes'],
      ['bookmarks', 'Bookmarks & Favorites', 'Allow saving questions for later revision'],
      ['sharing', 'Score Card Sharing', 'Generate shareable scorecard link/image'],
      ['darkmode', 'Dark Mode for Students', 'Allow students to toggle dark theme on their portal'],
    ] as const;

    return (
      <div className="flex flex-col gap-4">
        <div className="card">
          <div className="tg">
            <div>
              <b>Maintenance Mode</b>
              <small>Users see maintenance screen instead of site</small>
            </div>
            <label className="sw">
              <input
                type="checkbox"
                checked={state.maint.on}
                onChange={(e) => {
                  const on = e.target.checked;
                  updateStateAndSave(
                    (prev) => ({ ...prev, maint: { ...prev.maint, on } }),
                    `Maintenance mode set to ${on ? 'ON' : 'OFF'}`
                  );
                  showToast(`Maintenance mode ${on ? 'Activated' : 'Deactivated'}`);
                }}
              />
              <span />
            </label>
          </div>
          <div className="row mt-3">
            <input
              type="text"
              value={state.maint.msg}
              onChange={(e) => {
                const msg = e.target.value;
                setState((prev) => ({ ...prev, maint: { ...prev.maint, msg } }));
              }}
            />
            <button
              type="button"
              className="b p"
              onClick={() => {
                updateStateAndSave(
                  (prev) => prev,
                  'Updated maintenance message'
                );
                showToast('Maintenance message updated');
              }}
            >
              Save Message
            </button>
          </div>
        </div>

        <div className="card">
          <h3>User Feature Flags</h3>
          {flagsList.map(([key, title, desc]) => (
            <div key={key} className="tg">
              <div>
                <b>{title}</b>
                <small>{desc}</small>
              </div>
              <label className="sw">
                <input
                  type="checkbox"
                  checked={state.flags[key]}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    updateStateAndSave(
                      (prev) => ({
                        ...prev,
                        flags: { ...prev.flags, [key]: checked },
                      }),
                      `Feature flag ${key} set to ${checked ? 'ON' : 'OFF'}`
                    );
                  }}
                />
                <span />
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    const q = state.quiz;
    const pr = state.prot;

    return (
      <div className="flex flex-col gap-4">
        {/* Test behavior */}
        <div className="card">
          <h3>Tests and Revision Behavior</h3>
          {[
            ['shuffleQ', 'Shuffle questions in test', 'Random question order for every test attempt'],
            ['shuffleO', 'Shuffle options (A/B/C/D)', 'Randomize choice positions to prevent memorization'],
            ['expl', 'Show explanation after answering', 'Reveal high-yield rationale upon submission'],
            ['neg', 'Negative marking', 'Deduct 0.25 marks for wrong answers (ECAT/MDCAT standard)'],
            ['retake', 'Allow instant retakes', 'Students can retake test immediately'],
            ['rself', 'Ratta card self-check', 'Show "I knew it / I did not" buttons on cards'],
          ].map(([key, title, desc]) => (
            <div key={key} className="tg">
              <div>
                <b>{title}</b>
                <small>{desc}</small>
              </div>
              <label className="sw">
                <input
                  type="checkbox"
                  checked={(q as any)[key]}
                  onChange={(e) => {
                    const val = e.target.checked;
                    updateStateAndSave((prev) => ({
                      ...prev,
                      quiz: { ...prev.quiz, [key]: val },
                    }));
                  }}
                />
                <span />
              </label>
            </div>
          ))}

          <div className="row mt-3">
            <div>
              <small className="sub">Default Questions per Test</small>
              <input
                type="number"
                min="5"
                max="200"
                value={q.qn}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 20;
                  setState((prev) => ({ ...prev, quiz: { ...prev.quiz, qn: val } }));
                }}
              />
            </div>
            <div>
              <small className="sub">Seconds per Question (0 = untimed)</small>
              <input
                type="number"
                min="0"
                max="600"
                value={q.qt}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  setState((prev) => ({ ...prev, quiz: { ...prev.quiz, qt: val } }));
                }}
              />
            </div>
            <div>
              <small className="sub">Show-Answer Animation</small>
              <select
                value={q.anim}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setState((prev) => ({ ...prev, quiz: { ...prev.quiz, anim: val } }));
                }}
              >
                <option value="fade">Fade</option>
                <option value="flip">Flip</option>
                <option value="slide">Slide</option>
              </select>
            </div>
            <div>
              <small className="sub">Site Name</small>
              <input
                type="text"
                value={state.site.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setState((prev) => ({ ...prev, site: { name: val } }));
                }}
              />
            </div>
          </div>
          <button
            type="button"
            className="b p mt-2"
            onClick={() => {
              updateStateAndSave((prev) => prev, 'Updated quiz & site settings');
              showToast('Settings saved');
            }}
          >
            Save Settings
          </button>
        </div>

        {/* Content protection */}
        <div className="card">
          <h3>Content Protection &amp; Anti-Scraping</h3>
          {[
            ['api', 'Serve MCQs through API only', 'Questions live securely in database; no public raw dump file'],
            ['late', 'Reveal correct answer only after answer submitted', 'Prevents inspecting answers in devtools network tab'],
            ['rate', 'Rate-limit question requests', 'Prevents automated crawlers from dumping your bank'],
            ['noselect', 'Disable copy & right-click context menu', 'Deterrent against quick copy-pasting of question text'],
            ['wm', 'Watermark pages with user ID & email', 'Helps identify origin if screenshots are leaked'],
          ].map(([key, title, desc]) => (
            <div key={key} className="tg">
              <div>
                <b>{title}</b>
                <small>{desc}</small>
              </div>
              <label className="sw">
                <input
                  type="checkbox"
                  checked={(pr as any)[key]}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    updateStateAndSave((prev) => ({
                      ...prev,
                      prot: { ...prev.prot, [key]: checked },
                    }));
                  }}
                />
                <span />
              </label>
            </div>
          ))}
        </div>

        {/* Backup and restore */}
        <div className="card">
          <h3>Backup and Reset</h3>
          <div className="flex gap-2 flex-wrap mb-3">
            <button
              type="button"
              className="b"
              onClick={() => {
                const dump = JSON.stringify(state, null, 2);
                setModalContent(
                  <div>
                    <h3 className="text-base font-bold mb-1">Full System Backup</h3>
                    <p className="sub mb-2">Save this JSON text in a safe place.</p>
                    <textarea readOnly value={dump} className="w-full h-56 font-mono text-xs p-2 border rounded-lg" />
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        className="b p"
                        onClick={() => {
                          navigator.clipboard.writeText(dump);
                          showToast('Backup copied to clipboard!');
                        }}
                      >
                        Copy
                      </button>
                      <button type="button" className="b" onClick={() => setModalContent(null)}>
                        Close
                      </button>
                    </div>
                  </div>
                );
              }}
            >
              Export Backup
            </button>
            <button
              type="button"
              className="b d"
              onClick={() => {
                if (confirm('Reset everything to default demo data?')) {
                  const fresh = seedInitialData();
                  setState(fresh);
                  saveAppState(fresh);
                  showToast('Reset to demo data');
                }
              }}
            >
              Reset to Demo Data
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSecurity = () => {
    const sec = state.sec;

    return (
      <div className="flex flex-col gap-4">
        {/* Anti-Cheat Controls (Requested Feature) */}
        <div className="card">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="mb-0">Anti-Cheat Engine</h3>
              <p className="sub">Active exam integrity monitoring for students taking tests</p>
            </div>
            <span className="badge">Active Protection</span>
          </div>

          <div className="tg">
            <div>
              <b>Enable Tab-Switch &amp; Focus Detection</b>
              <small>Counts when student leaves browser tab or minimizes window</small>
            </div>
            <label className="sw">
              <input
                type="checkbox"
                checked={sec.antiCheat.enabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  updateStateAndSave(
                    (prev) => ({
                      ...prev,
                      sec: {
                        ...prev.sec,
                        antiCheat: { ...prev.sec.antiCheat, enabled: val },
                      },
                    }),
                    `Anti-cheat engine set to ${val ? 'ON' : 'OFF'}`
                  );
                }}
              />
              <span />
            </label>
          </div>

          <div className="tg">
            <div>
              <b>Block Copy / Cut / Paste &amp; DevTools</b>
              <small>Disables clipboard hotkeys and F12/Ctrl+Shift+I inspection</small>
            </div>
            <label className="sw">
              <input
                type="checkbox"
                checked={sec.antiCheat.blockCopy}
                onChange={(e) => {
                  const val = e.target.checked;
                  updateStateAndSave((prev) => ({
                    ...prev,
                    sec: {
                      ...prev.sec,
                      antiCheat: { ...prev.sec.antiCheat, blockCopy: val },
                    },
                  }));
                }}
              />
              <span />
            </label>
          </div>

          <div className="row mt-3">
            <div>
              <small className="sub">Max Allowed Tab Switches Before Auto-Submit</small>
              <input
                type="number"
                min="1"
                max="10"
                value={sec.antiCheat.maxTabSwitches}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 3;
                  updateStateAndSave((prev) => ({
                    ...prev,
                    sec: {
                      ...prev.sec,
                      antiCheat: { ...prev.sec.antiCheat, maxTabSwitches: val },
                    },
                  }));
                }}
              />
            </div>
          </div>
        </div>

        {/* Multi-Account Prevention (Requested Feature) */}
        <div className="card">
          <h3>Multi-Account Detection (Device Fingerprinting)</h3>
          <p className="sub mb-3">
            Prevents multiple accounts from abusing free tier resources on the same machine.
          </p>

          <div className="row">
            <div>
              <small className="sub">Max Accounts Allowed per Hardware Fingerprint</small>
              <input
                type="number"
                min="1"
                max="5"
                value={sec.multiAccount.maxAccountsPerDevice}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  updateStateAndSave((prev) => ({
                    ...prev,
                    sec: {
                      ...prev.sec,
                      multiAccount: { ...prev.sec.multiAccount, maxAccountsPerDevice: val },
                    },
                  }));
                }}
              />
            </div>
            <div>
              <small className="sub">Action When Multiple Accounts Detected</small>
              <select
                value={sec.multiAccount.action}
                onChange={(e) => {
                  const val = e.target.value as any;
                  updateStateAndSave((prev) => ({
                    ...prev,
                    sec: {
                      ...prev.sec,
                      multiAccount: { ...prev.sec.multiAccount, action: val },
                    },
                  }));
                }}
              >
                <option value="flag">Flag Account for Admin Review</option>
                <option value="block">Automatically Suspend Access</option>
              </select>
            </div>
          </div>

          <div className="mt-3">
            <h4 className="font-bold text-xs mb-1">Flagged Multi-Account Users:</h4>
            {state.users.filter((u) => u.multiAccountFlag).length === 0 ? (
              <p className="text-xs text-[var(--mut)]">No multi-account violations detected.</p>
            ) : (
              state.users
                .filter((u) => u.multiAccountFlag)
                .map((u) => (
                  <div key={u.id} className="tg py-1.5">
                    <div>
                      <span className="font-bold text-xs">{u.name}</span>{' '}
                      <small className="text-[var(--red)]">{u.email}</small>
                    </div>
                    <button
                      type="button"
                      className="b d text-xs"
                      onClick={() => {
                        updateStateAndSave(
                          (prev) => ({
                            ...prev,
                            users: prev.users.map((x) =>
                              x.id === u.id ? { ...x, status: 'suspended' } : x
                            ),
                          }),
                          `Suspended multi-account suspect ${u.name}`
                        );
                        showToast(`Suspended ${u.name}`);
                      }}
                    >
                      Suspend Account
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Session & Rate Limit */}
        <div className="card">
          <div className="tg">
            <div>
              <b>Require 2-Factor Authentication for Admins</b>
              <small>Enforced via Supabase Auth TOTP</small>
            </div>
            <label className="sw">
              <input
                type="checkbox"
                checked={sec.twofa}
                onChange={(e) => {
                  const val = e.target.checked;
                  updateStateAndSave((prev) => ({
                    ...prev,
                    sec: { ...prev.sec, twofa: val },
                  }));
                }}
              />
              <span />
            </label>
          </div>

          <div className="row mt-3">
            <div>
              <small className="sub">Session Timeout (Minutes)</small>
              <input
                type="number"
                min="5"
                max="1440"
                value={sec.timeout}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 30;
                  setState((prev) => ({ ...prev, sec: { ...prev.sec, timeout: val } }));
                }}
              />
            </div>
            <div>
              <small className="sub">Rate Limit (Requests / Min per IP)</small>
              <input
                type="number"
                min="10"
                max="1000"
                value={sec.rate}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 60;
                  setState((prev) => ({ ...prev, sec: { ...prev.sec, rate: val } }));
                }}
              />
            </div>
            <button
              type="button"
              className="b p"
              onClick={() => {
                updateStateAndSave((prev) => prev, 'Updated security timeouts and rates');
                showToast('Security limits saved');
              }}
            >
              Save Limits
            </button>
          </div>
        </div>

        {/* Blocked IPs */}
        <div className="card">
          <h3>Blocked IP Addresses</h3>
          <div className="row">
            <input
              type="text"
              placeholder="e.g. 203.0.113.5 or IPv6 address..."
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
            />
            <button
              type="button"
              className="b p"
              onClick={() => {
                const ip = newIp.trim();
                if (!ip) return showToast('Enter an IP address');
                if (state.sec.ips.includes(ip)) return showToast('IP already blocked');
                updateStateAndSave(
                  (prev) => ({
                    ...prev,
                    sec: { ...prev.sec, ips: [...prev.sec.ips, ip] },
                  }),
                  `Blocked IP address ${ip}`
                );
                setNewIp('');
                showToast(`Blocked IP ${ip}`);
              }}
            >
              Block IP
            </button>
          </div>

          <div className="flex flex-col gap-2 mt-3">
            {state.sec.ips.length === 0 ? (
              <p className="sub">No IP addresses currently blocked.</p>
            ) : (
              state.sec.ips.map((ip) => (
                <div key={ip} className="tg">
                  <span className="font-mono text-xs">{ip}</span>
                  <button
                    type="button"
                    className="b d"
                    onClick={() => {
                      updateStateAndSave(
                        (prev) => ({
                          ...prev,
                          sec: {
                            ...prev.sec,
                            ips: prev.sec.ips.filter((x) => x !== ip),
                          },
                        }),
                        `Unblocked IP ${ip}`
                      );
                      showToast(`Unblocked ${ip}`);
                    }}
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderLogs = () => {
    const allUserActs = state.users
      .flatMap((u) => u.acts.map((a) => ({ name: u.name, act: a[0], time: a[1] })))
      .sort((a, b) => b.time - a.time)
      .slice(0, 30);

    return (
      <div className="flex flex-col gap-4">
        <div className="card">
          <div className="row">
            <h3 className="flex-1 m-0">Admin Audit Trail</h3>
            <button
              type="button"
              className="b"
              onClick={() =>
                exportCsv(
                  'Audit Trail Export',
                  [
                    ['Action', 'Timestamp'],
                    ...state.audit.map((l) => [l.a, new Date(l.t).toISOString()]),
                  ]
                )
              }
            >
              Export CSV
            </button>
          </div>

          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {state.audit.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="text-center py-6 text-[var(--mut)]">
                      No admin actions logged yet.
                    </td>
                  </tr>
                ) : (
                  state.audit.slice(0, 40).map((l, i) => (
                    <tr key={i}>
                      <td>{l.a}</td>
                      <td className="text-xs text-[var(--mut)] whitespace-nowrap">
                        {timeAgo(l.t)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Anti-Cheat & Security Event Logs */}
        <div className="card">
          <h3>Anti-Cheat &amp; Security Violations Log</h3>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>User / IP</th>
                  <th>Violation Type</th>
                  <th>Test Session</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {state.antiCheatLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <b>{log.userEmail || 'Anonymous'}</b>
                      <small>{log.ip || 'Local Client'}</small>
                    </td>
                    <td>
                      <span className="badge banned">{log.eventType.replace('_', ' ')}</span>
                    </td>
                    <td>{log.testTitle || 'Practice'}</td>
                    <td className="text-xs text-[var(--mut)]">{timeAgo(log.t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Recent Student Activity Stream</h3>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Activity</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {allUserActs.map((act, i) => (
                  <tr key={i}>
                    <td>
                      <b>{act.name}</b>
                    </td>
                    <td>{act.act}</td>
                    <td className="text-xs text-[var(--mut)]">{timeAgo(act.time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <AdminNav
        currentView={view}
        onSelectView={(v) => {
          setView(v);
          window.scrollTo(0, 0);
        }}
        siteName={state.site.name}
      />

      <main className="flex-1 min-w-0 p-6 pb-16 max-w-6xl max-[820px]:p-4">
        {/* Top Header */}
        <div className="top flex justify-between items-center gap-2 mb-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight capitalize">
              {view === 'dash'
                ? 'Dashboard'
                : view === 'users'
                ? 'Users Management'
                : view === 'courses'
                ? 'Course Manager'
                : view === 'mcqs'
                ? 'MCQ Bank'
                : view === 'ratta'
                ? 'Ratta Revision Cards'
                : view === 'reports'
                ? 'Student Question Reports'
                : view === 'ads'
                ? 'Ads Monetization'
                : view === 'ann'
                ? 'Announcements & Broadcasts'
                : view === 'flags'
                ? 'Features & Maintenance'
                : view === 'set'
                ? 'Settings & Protection'
                : view === 'sec'
                ? 'Security & Anti-Cheat'
                : 'System Audit Logs'}
            </h1>
            <p className="sub">
              {view === 'dash'
                ? 'Live overview and active analytics of SawalJar'
                : view === 'users'
                ? 'Search, inspect, suspend, ban and control every account'
                : view === 'courses'
                ? 'Organize target courses and examine question allocations'
                : view === 'mcqs'
                ? 'Bulk import from JSON files or sync via remote links'
                : view === 'ratta'
                ? 'Fill-in-the-blank revision cards for rapid recall'
                : view === 'reports'
                ? 'Review user feedback on questions to ensure 100% accuracy'
                : view === 'ads'
                ? 'Control Google AdSense and Adsterra placements'
                : view === 'ann'
                ? 'Broadcast notices to all registered students'
                : view === 'flags'
                ? 'Feature switches and maintenance mode control'
                : view === 'set'
                ? 'Test rules, content protection, and data backups'
                : view === 'sec'
                ? 'Anti-cheat limits, multi-account detection & blocked IPs'
                : 'Audit log trail and real-time student activity feed'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {state.maint.on && (
              <span className="badge pending font-bold">Maintenance Active</span>
            )}
            <Link href="/" className="b text-xs">
              ↗ Student Site
            </Link>
            <button
              type="button"
              className="b text-xs"
              onClick={toggleTheme}
            >
              ◐ Theme
            </button>
          </div>
        </div>

        {/* View Content */}
        {view === 'dash' && renderDashboard()}
        {view === 'users' && renderUsers()}
        {view === 'courses' && renderCourses()}
        {view === 'mcqs' && renderMcqs()}
        {view === 'ratta' && renderRatta()}
        {view === 'reports' && renderReports()}
        {view === 'ads' && renderAds()}
        {view === 'ann' && renderAnnouncements()}
        {view === 'flags' && renderFeatures()}
        {view === 'set' && renderSettings()}
        {view === 'sec' && renderSecurity()}
        {view === 'logs' && renderLogs()}
      </main>

      {/* Modal Overlay */}
      {modalContent && (
        <div className="modal-overlay" onClick={() => setModalContent(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            {modalContent}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}
