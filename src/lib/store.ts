import {
  AppState,
  Course,
  Topic,
  User,
  MCQ,
  RattaCard,
  Report,
  AuditLogItem,
} from './types';

export const STORAGE_KEY = 'sj_admin_v3'; // v3: drops the old demo data kept by earlier versions
export const THEME_KEY = 'sj_theme';
export const ACTIVE_COURSE_KEY = 'sj_active_course';

export const uid = (prefix: string) => prefix + '_' + Math.random().toString(36).slice(2, 8);

export function seedInitialData(): AppState {
  // No demo content: courses, users and questions come from the database (or from the admin panel)
  return {
    courses: [] as Course[],
    topics: [] as Topic[],
    users: [] as User[],
    mcqs: [] as MCQ[],
    ratta: [] as RattaCard[],
    reports: [] as Report[],
    ads: { on: false, provider: 'adsense', code: '', pl: { dash_top: true, dash_side: true, mcq: true, revision: false, result: true, between: false } },
    flags: { signup: true, streaks: true, leaderboard: true, timed: true, notes: true, bookmarks: true, sharing: true, darkmode: true },
    maint: { on: false, msg: 'SawalJar is being improved. Back shortly!' },
    ann: [] as AppState['ann'],
    audit: [] as AuditLogItem[],
    antiCheatLogs: [],
    sec: {
      twofa: true,
      timeout: 30,
      rate: 60,
      ips: [],
      antiCheat: { enabled: true, maxTabSwitches: 3, blockCopy: true, enforceFullscreen: false },
      multiAccount: { maxAccountsPerDevice: 1, action: 'flag' },
    },
    week: [0, 0, 0, 0, 0, 0, 0],
    srcs: [] as AppState['srcs'],
    quiz: { shuffleQ: true, shuffleO: true, expl: true, neg: false, retake: true, rself: true, qn: 20, qt: 0, anim: 'fade' },
    prot: { api: true, late: true, rate: true, noselect: true, wm: false },
    site: { name: 'SawalJar' },
  } as AppState;
}

export function loadAppState(): AppState {
  if (typeof window === 'undefined') {
    return seedInitialData();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = seedInitialData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    const seed = seedInitialData();
    return {
      ...seed,
      ...parsed,
      courses: parsed.courses || seed.courses,
      topics: parsed.topics || seed.topics,
      ads: { ...seed.ads, ...(parsed.ads || {}) },
      flags: { ...seed.flags, ...(parsed.flags || {}) },
      maint: { ...seed.maint, ...(parsed.maint || {}) },
      quiz: { ...seed.quiz, ...(parsed.quiz || {}) },
      prot: { ...seed.prot, ...(parsed.prot || {}) },
      sec: {
        ...seed.sec,
        ...(parsed.sec || {}),
        antiCheat: { ...seed.sec.antiCheat, ...(parsed.sec?.antiCheat || {}) },
        multiAccount: { ...seed.sec.multiAccount, ...(parsed.sec?.multiAccount || {}) },
      },
      site: { ...seed.site, ...(parsed.site || {}) },
    };
  } catch {
    return seedInitialData();
  }
}

type SaveHook = (state: AppState) => void;
let saveHook: SaveHook | null = null;
// The cloud layer registers here so every admin save is also sent to Supabase
export function setSaveHook(fn: SaveHook | null): void {
  saveHook = fn;
}
// Writes to this browser only (used when data arrives from the cloud)
export function writeLocalState(state: AppState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state to localStorage:', err);
  }
}
export function saveAppState(state: AppState): void {
  if (typeof window === 'undefined') return;
  writeLocalState(state);
  saveHook?.(state);
}

export function addAuditLog(state: AppState, action: string): AppState {
  const updated = {
    ...state,
    audit: [{ a: action, t: Date.now() }, ...state.audit.slice(0, 199)],
  };
  saveAppState(updated);
  return updated;
}

/**
 * Get active enrolled course for student (One course per student model)
 */
export function getActiveCourse(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(ACTIVE_COURSE_KEY) || '';
}

/**
 * Set active enrolled course for student
 */
export function setActiveCourse(courseName: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_COURSE_KEY, courseName);
}
