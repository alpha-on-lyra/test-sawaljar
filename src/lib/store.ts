import { AppState, User, MCQ, RattaCard, Report, Announcement, AntiCheatLogItem } from './types';

export const STORAGE_KEY = 'sj_admin_v1';
export const THEME_KEY = 'sj_theme';

const ago = (minutes: number) => Date.now() - minutes * 60000;
export const uid = (prefix: string) => prefix + Math.random().toString(36).slice(2, 8);

export function seedInitialData(): AppState {
  const courses = ['MDCAT', 'ECAT', 'Matric', 'FSc'];
  const userNames = [
    'Ayesha Khan', 'Bilal Ahmed', 'Hira Malik', 'Usman Ali',
    'Sana Iqbal', 'Hamza Shah', 'Fatima Noor', 'Zain Abbas',
    'Maryam Raza', 'Ali Hassan', 'Noor Fatima', 'Daniyal Khan'
  ];

  const users: User[] = userNames.map((name, i) => ({
    id: 'u' + (i + 1),
    name,
    email: name.toLowerCase().replace(' ', '.') + '@mail.com',
    course: courses[i % 4],
    status: i === 9 ? 'banned' : i === 6 ? 'suspended' : 'active',
    role: i === 0 ? 'admin' : 'user',
    last: ago(i * 37 + 2),
    solved: 40 + i * 23,
    acc: 55 + (i * 7) % 40,
    streak: i % 6,
    deviceFingerprint: 'fp_' + (i % 3 === 0 ? 'shared_device_lab' : 'dev_' + i),
    multiAccountFlag: i % 3 === 0 && i > 0,
    acts: [
      ['Logged in with Google', ago(i * 37 + 2)],
      ['Solved 10 MCQs in ' + courses[i % 4], ago(i * 37 + 30)],
      ['Selected course ' + courses[i % 4], ago(1440 * (i + 3))]
    ]
  }));

  const mcqs: MCQ[] = [
    {
      id: uid('q'),
      q: 'Powerhouse of the cell?',
      o: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi'],
      a: 1,
      topic: 'Cell Biology',
      course: 'MDCAT',
      src: 'MDCAT 2022',
      exp: 'Mitochondria are membrane-bound cell organelles that generate most of the chemical energy needed to power the biochemical reactions.'
    },
    {
      id: uid('q'),
      q: 'SI unit of force?',
      o: ['Joule', 'Pascal', 'Newton', 'Watt'],
      a: 2,
      topic: 'Physics',
      course: 'ECAT',
      src: 'ECAT 2021',
      exp: 'The SI unit of force is the newton, symbol N. One newton is 1 kg*m/s^2.'
    },
    {
      id: uid('q'),
      q: 'pH of pure water at 25°C?',
      o: ['5', '7', '9', '14'],
      a: 1,
      topic: 'Chemistry',
      course: 'MDCAT',
      src: '',
      exp: 'At 25 degrees Celsius, pure water has a neutral pH of exactly 7.'
    },
    {
      id: uid('q'),
      q: 'Derivative of sin x?',
      o: ['cos x', '-cos x', 'sin x', 'tan x'],
      a: 0,
      topic: 'Calculus',
      course: 'FSc',
      src: '',
      exp: 'd/dx (sin x) = cos x.'
    },
    {
      id: uid('q'),
      q: 'Which organelle makes ATP in eukaryotic cells?',
      o: ['Nucleus', 'Mitochondria', 'Lysosome', 'Vacuole'],
      a: 1,
      topic: 'Cell Biology',
      course: 'MDCAT',
      src: 'MDCAT 2023',
      exp: 'ATP synthase located in the inner membrane of mitochondria produces ATP.'
    },
    {
      id: uid('q'),
      q: 'The unit of electrical resistance is:',
      o: ['Ohm', 'Volt', 'Ampere', 'Watt'],
      a: 0,
      topic: 'Physics',
      course: 'ECAT',
      src: '',
      exp: 'Resistance = Voltage / Current (Ohm = V / A).'
    }
  ];

  const ratta: RattaCard[] = [
    {
      id: uid('c'),
      q: '______ is the powerhouse of the cell.',
      a: 'Mitochondria',
      topic: 'Cell Biology',
      course: 'MDCAT',
      src: 'MDCAT 2022'
    },
    {
      id: uid('c'),
      q: '______ organisms have separate male and female individuals.',
      a: 'Dioecious',
      topic: 'Reproduction',
      course: 'FSc',
      src: ''
    },
    {
      id: uid('c'),
      q: 'The SI unit of force is ______.',
      a: 'Newton',
      topic: 'Physics',
      course: 'ECAT',
      src: ''
    },
    {
      id: uid('c'),
      q: 'Speed of light in vacuum is approximately ______ m/s.',
      a: '3 x 10^8',
      topic: 'Physics',
      course: 'ECAT',
      src: 'ECAT 2020'
    }
  ];

  const reports: Report[] = [
    {
      id: uid('r'),
      mcq: 'SI unit of force?',
      kind: 'MCQ',
      user: 'Bilal Ahmed',
      reason: 'Wrong answer marked',
      status: 'pending',
      t: ago(50)
    },
    {
      id: uid('r'),
      mcq: 'pH of pure water at 25°C?',
      kind: 'MCQ',
      user: 'Hira Malik',
      reason: 'Typo in option',
      status: 'pending',
      t: ago(300)
    },
    {
      id: uid('r'),
      mcq: '______ is the powerhouse of the cell.',
      kind: 'Ratta',
      user: 'Sana Iqbal',
      reason: 'Answer needs fixing',
      status: 'pending',
      t: ago(120)
    }
  ];

  return {
    courses,
    users,
    mcqs,
    ratta,
    reports,
    ads: {
      on: false,
      provider: 'adsense',
      code: '<!-- SawalJar Ad placeholder -->\n<div style="background:#e1ede4;padding:12px;border-radius:8px;text-align:center;font-size:12px;color:#2f6f4f;font-weight:600">Sponsored Ad Space</div>',
      pl: {
        dash_top: true,
        dash_side: true,
        mcq: true,
        revision: false,
        result: true,
        between: false
      }
    },
    flags: {
      signup: true,
      streaks: true,
      leaderboard: true,
      timed: true,
      notes: true,
      bookmarks: true,
      sharing: true,
      darkmode: true
    },
    maint: {
      on: false,
      msg: 'SawalJar is being improved. Back soon!'
    },
    ann: [
      {
        id: uid('a'),
        t: 'Welcome to SawalJar!',
        m: 'Complete MCQ preparation with high-yield past papers and anti-cheat exam mode.',
        k: 'info',
        d: ago(240)
      }
    ],
    audit: [
      { a: 'System initialized with secure Google OAuth & Anti-Cheat', t: ago(360) }
    ],
    antiCheatLogs: [
      {
        id: uid('ac'),
        userEmail: 'usman.ali@mail.com',
        eventType: 'tab_switch',
        testTitle: 'MDCAT Cell Biology Test',
        details: { switchCount: 1, durationOutOfTabSec: 4 },
        ip: '203.0.113.42',
        t: ago(45)
      },
      {
        id: uid('ac'),
        userEmail: 'hira.malik@mail.com',
        eventType: 'copy_attempt',
        testTitle: 'ECAT Physics Test',
        details: { blockedContent: 'The unit of electrical resistance...' },
        ip: '198.51.100.12',
        t: ago(180)
      }
    ],
    sec: {
      twofa: true,
      timeout: 30,
      rate: 60,
      ips: [],
      antiCheat: {
        enabled: true,
        maxTabSwitches: 3,
        blockCopy: true,
        enforceFullscreen: false
      },
      multiAccount: {
        maxAccountsPerDevice: 1,
        action: 'flag'
      }
    },
    week: [120, 180, 150, 240, 210, 300, 260],
    srcs: [
      { id: uid('s'), u: '/data/sample-mcqs.json', k: 'Same hosting' }
    ],
    quiz: {
      shuffleQ: true,
      shuffleO: true,
      expl: true,
      neg: false,
      retake: true,
      rself: true,
      qn: 20,
      qt: 60,
      anim: 'fade'
    },
    prot: {
      api: true,
      late: true,
      rate: true,
      noselect: true,
      wm: false
    },
    site: {
      name: 'SawalJar'
    }
  };
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
    // ensure all fields exist
    const seed = seedInitialData();
    return {
      ...seed,
      ...parsed,
      ads: { ...seed.ads, ...(parsed.ads || {}) },
      flags: { ...seed.flags, ...(parsed.flags || {}) },
      maint: { ...seed.maint, ...(parsed.maint || {}) },
      quiz: { ...seed.quiz, ...(parsed.quiz || {}) },
      prot: { ...seed.prot, ...(parsed.prot || {}) },
      sec: {
        ...seed.sec,
        ...(parsed.sec || {}),
        antiCheat: { ...seed.sec.antiCheat, ...(parsed.sec?.antiCheat || {}) },
        multiAccount: { ...seed.sec.multiAccount, ...(parsed.sec?.multiAccount || {}) }
      },
      site: { ...seed.site, ...(parsed.site || {}) }
    };
  } catch {
    return seedInitialData();
  }
}

export function saveAppState(state: AppState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state to localStorage:', err);
  }
}

export function addAuditLog(state: AppState, action: string): AppState {
  const updated = {
    ...state,
    audit: [{ a: action, t: Date.now() }, ...state.audit.slice(0, 199)]
  };
  saveAppState(updated);
  return updated;
}
