export type Role = 'user' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'banned';

export interface User {
  id: string;
  name: string;
  email: string;
  course: string;
  status: UserStatus;
  role?: Role;
  last: number; // timestamp
  solved: number;
  acc: number;
  streak: number;
  deviceFingerprint?: string;
  multiAccountFlag?: boolean;
  acts: [string, number][]; // [action, timestamp]
}

export interface MCQ {
  id: string;
  q: string;
  o: string[];
  a: number; // correct index
  topic: string;
  course: string;
  src?: string;
  exp?: string;
}

export interface RattaCard {
  id: string;
  q: string;
  a: string;
  topic: string;
  course: string;
  src?: string;
}

export interface Report {
  id: string;
  mcq: string;
  kind?: 'MCQ' | 'Ratta';
  user: string;
  reason: string;
  status: 'pending' | 'fixed' | 'rejected';
  t: number;
}

export interface Announcement {
  id: string;
  t: string;
  m: string;
  k: 'info' | 'warning' | 'success';
  d: number;
}

export interface AuditLogItem {
  a: string;
  t: number;
}

export interface AntiCheatLogItem {
  id: string;
  userId?: string;
  userEmail?: string;
  eventType: 'tab_switch' | 'window_blur' | 'copy_attempt' | 'context_menu' | 'devtools_open' | 'rapid_answering' | 'fullscreen_exit' | 'multi_account_detected';
  testTitle?: string;
  details?: Record<string, unknown>;
  ip?: string;
  t: number;
}

export interface JsonSourceItem {
  id: string;
  u: string;
  k: string;
}

export interface AdsConfig {
  on: boolean;
  provider: 'adsense' | 'adsterra';
  code: string;
  pl: {
    dash_top: boolean;
    dash_side: boolean;
    mcq: boolean;
    revision: boolean;
    result: boolean;
    between: boolean;
  };
}

export interface FeatureFlags {
  signup: boolean;
  streaks: boolean;
  leaderboard: boolean;
  timed: boolean;
  notes: boolean;
  bookmarks: boolean;
  sharing: boolean;
  darkmode: boolean;
}

export interface MaintenanceConfig {
  on: boolean;
  msg: string;
}

export interface QuizConfig {
  shuffleQ: boolean;
  shuffleO: boolean;
  expl: boolean;
  neg: boolean;
  retake: boolean;
  rself: boolean;
  qn: number;
  qt: number;
  anim: 'fade' | 'flip' | 'slide';
}

export interface ProtectionConfig {
  api: boolean;
  late: boolean;
  rate: boolean;
  noselect: boolean;
  wm: boolean;
}

export interface SecurityConfig {
  twofa: boolean;
  timeout: number;
  rate: number;
  ips: string[];
  antiCheat: {
    enabled: boolean;
    maxTabSwitches: number;
    blockCopy: boolean;
    enforceFullscreen: boolean;
  };
  multiAccount: {
    maxAccountsPerDevice: number;
    action: 'flag' | 'block';
  };
}

export interface AppState {
  courses: string[];
  users: User[];
  mcqs: MCQ[];
  ratta: RattaCard[];
  reports: Report[];
  ads: AdsConfig;
  flags: FeatureFlags;
  maint: MaintenanceConfig;
  ann: Announcement[];
  audit: AuditLogItem[];
  antiCheatLogs: AntiCheatLogItem[];
  sec: SecurityConfig;
  week: number[];
  srcs: JsonSourceItem[];
  quiz: QuizConfig;
  prot: ProtectionConfig;
  site: { name: string };
}
