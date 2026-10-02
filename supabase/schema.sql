-- ============================================================
-- SawalJar Database Schema (Next.js + Supabase + Cloudflare Pages)
-- Designed for Free Tier: Zero unnecessary overhead, efficient indexes
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Profiles (Auth linked)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  course TEXT DEFAULT 'MDCAT',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  solved INTEGER NOT NULL DEFAULT 0,
  accuracy INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  device_fingerprint TEXT DEFAULT '',
  multi_account_flag BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_device ON public.profiles(device_fingerprint);

-- Auto-create profile upon Google OAuth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    -- Automatically make the first user or designated email an admin
    CASE WHEN NEW.email = 'admin@sawaljar.com' THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. Anti-Cheat & Security Logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.anti_cheat_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_email TEXT DEFAULT '',
  event_type TEXT NOT NULL CHECK (event_type IN ('tab_switch', 'window_blur', 'copy_attempt', 'context_menu', 'devtools_open', 'rapid_answering', 'fullscreen_exit', 'multi_account_detected')),
  test_title TEXT DEFAULT 'Practice Test',
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anti_cheat_user ON public.anti_cheat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_anti_cheat_created ON public.anti_cheat_logs(created_at DESC);

-- ============================================================
-- 3. Device Sessions & Multi-Account Tracker
-- ============================================================
CREATE TABLE IF NOT EXISTS public.device_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fingerprint_hash TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_address TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fingerprint_hash, user_id)
);

CREATE INDEX IF NOT EXISTS idx_device_sessions_fp ON public.device_sessions(fingerprint_hash);

-- Trigger to detect multiple accounts on same device
CREATE OR REPLACE FUNCTION public.check_multi_account_abuse()
RETURNS TRIGGER AS $$
DECLARE
  account_count INT;
BEGIN
  SELECT COUNT(DISTINCT user_id) INTO account_count
  FROM public.device_sessions
  WHERE fingerprint_hash = NEW.fingerprint_hash;

  IF account_count > 1 THEN
    -- Mark profile with multi_account_flag
    UPDATE public.profiles
    SET multi_account_flag = true
    WHERE id = NEW.user_id;

    -- Insert security log
    INSERT INTO public.anti_cheat_logs (user_id, event_type, details, ip_address)
    VALUES (
      NEW.user_id,
      'multi_account_detected',
      json_build_object('fingerprint', NEW.fingerprint_hash, 'total_accounts_on_device', account_count),
      NEW.ip_address
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_device_session_inserted ON public.device_sessions;
CREATE TRIGGER on_device_session_inserted
  AFTER INSERT OR UPDATE ON public.device_sessions
  FOR EACH ROW EXECUTE FUNCTION public.check_multi_account_abuse();

-- ============================================================
-- 4. Courses
-- ============================================================
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. MCQ Bank
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mcqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer_index INTEGER NOT NULL DEFAULT 0,
  explanation TEXT DEFAULT '',
  topic TEXT NOT NULL DEFAULT 'General',
  course TEXT NOT NULL DEFAULT 'General',
  source TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcqs_course ON public.mcqs(course);
CREATE INDEX IF NOT EXISTS idx_mcqs_topic ON public.mcqs(topic);

-- ============================================================
-- 6. Ratta Cards (Fill in the blank)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ratta_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT 'General',
  course TEXT NOT NULL DEFAULT 'General',
  source TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ratta_course ON public.ratta_cards(course);

-- ============================================================
-- 7. Wrong-Answer Reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mcq_text TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'MCQ' CHECK (kind IN ('MCQ', 'Ratta')),
  user_name TEXT NOT NULL DEFAULT 'Anonymous',
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fixed', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- ============================================================
-- 8. Announcements
-- ============================================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'info' CHECK (kind IN ('info', 'warning', 'success')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. Audit Logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_name TEXT DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_time ON public.audit_logs(created_at DESC);

-- ============================================================
-- 10. User Activity
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL DEFAULT '',
  activity TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_time ON public.user_activity(created_at DESC);

-- ============================================================
-- 11. Settings (Key-Value Config for Ads, Features, Security)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. Blocked IPs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.blocked_ips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT DEFAULT 'Administrative block',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. External JSON Sources
-- ============================================================
CREATE TABLE IF NOT EXISTS public.json_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'Same hosting',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. Weekly Solved MCQ Stats (Free tier friendly)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.weekly_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  count INTEGER NOT NULL DEFAULT 0,
  week_start DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(day_of_week, week_start)
);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratta_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.json_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anti_cheat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- MCQs
CREATE POLICY "MCQs are readable by everyone" ON public.mcqs FOR SELECT USING (true);
CREATE POLICY "Admins can manage MCQs" ON public.mcqs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Courses
CREATE POLICY "Courses are readable by everyone" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Admins can manage courses" ON public.courses FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Ratta Cards
CREATE POLICY "Ratta cards are readable by everyone" ON public.ratta_cards FOR SELECT USING (true);
CREATE POLICY "Admins can manage ratta cards" ON public.ratta_cards FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Reports
CREATE POLICY "Users can submit reports" ON public.reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view and manage reports" ON public.reports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Announcements
CREATE POLICY "Announcements readable by everyone" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Admins can manage announcements" ON public.announcements FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Settings
CREATE POLICY "Settings are viewable by everyone" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Anti Cheat Logs
CREATE POLICY "Students can insert anti cheat events" ON public.anti_cheat_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can read anti cheat logs" ON public.anti_cheat_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Device Sessions
CREATE POLICY "Users can insert/update own device session" ON public.device_sessions FOR ALL USING (
  auth.uid() = user_id
);
CREATE POLICY "Admins can inspect device sessions" ON public.device_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Audit Logs
CREATE POLICY "Admins can view and create audit logs" ON public.audit_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Weekly Stats
CREATE POLICY "Weekly stats viewable by all" ON public.weekly_stats FOR SELECT USING (true);
CREATE POLICY "Admins can update weekly stats" ON public.weekly_stats FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Blocked IPs
CREATE POLICY "Admins can manage blocked IPs" ON public.blocked_ips FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- Default Seed Data
-- ============================================================

INSERT INTO public.courses (name, description) VALUES
  ('MDCAT', 'Medical & Dental College Admission Test preparation'),
  ('ECAT', 'Engineering College Admission Test practice questions'),
  ('Matric', 'Secondary School Certificate board exam preparation'),
  ('FSc', 'Higher Secondary Pre-Medical and Pre-Engineering')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.settings (key, value) VALUES
  ('ads', '{"on": false, "provider": "adsense", "code": "", "placements": {"dash_top": true, "dash_side": true, "mcq": true, "revision": false, "result": true, "between": false}}'::jsonb),
  ('flags', '{"signup": true, "streaks": true, "leaderboard": true, "timed": true, "notes": true, "bookmarks": true, "sharing": true, "darkmode": true}'::jsonb),
  ('maint', '{"on": false, "msg": "SawalJar is being improved. Back soon!"}'::jsonb),
  ('quiz', '{"shuffleQ": true, "shuffleO": true, "expl": true, "neg": false, "retake": true, "rself": true, "qn": 20, "qt": 60, "anim": "fade"}'::jsonb),
  ('prot', '{"api": true, "late": true, "rate": true, "noselect": true, "wm": false}'::jsonb),
  ('sec', '{"twofa": true, "timeout": 30, "rate": 60, "antiCheat": {"enabled": true, "maxTabSwitches": 3, "blockCopy": true, "enforceFullscreen": false}, "multiAccount": {"maxAccountsPerDevice": 1, "action": "flag"}}'::jsonb),
  ('site', '{"name": "SawalJar"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.mcqs (question, options, answer_index, topic, course, source, explanation) VALUES
  ('Powerhouse of the cell?', '["Nucleus", "Mitochondria", "Ribosome", "Golgi"]'::jsonb, 1, 'Cell Biology', 'MDCAT', 'MDCAT 2022', 'Mitochondria generate most of the chemical energy needed to power the cell''s biochemical reactions.'),
  ('SI unit of force?', '["Joule", "Pascal", "Newton", "Watt"]'::jsonb, 2, 'Physics', 'ECAT', 'ECAT 2021', 'One newton is the force needed to accelerate one kilogram of mass at the rate of one metre per second squared.'),
  ('pH of pure water at 25°C?', '["5", "7", "9", "14"]'::jsonb, 1, 'Chemistry', 'MDCAT', '', 'Pure water has an equal concentration of H+ and OH- ions, giving it a neutral pH of 7 at 25°C.'),
  ('Derivative of sin x?', '["cos x", "-cos x", "sin x", "tan x"]'::jsonb, 0, 'Calculus', 'FSc', '', 'The standard derivative of sin(x) with respect to x is cos(x).'),
  ('Which organelle makes ATP?', '["Nucleus", "Mitochondria", "Lysosome", "Vacuole"]'::jsonb, 1, 'Cell Biology', 'MDCAT', 'MDCAT 2023', 'ATP synthesis occurs via oxidative phosphorylation in mitochondria.'),
  ('Unit of electric resistance?', '["Ohm", "Volt", "Ampere", "Watt"]'::jsonb, 0, 'Physics', 'ECAT', '', 'Resistance is measured in Ohms (symbol: Ω).');

INSERT INTO public.ratta_cards (question, answer, topic, course, source) VALUES
  ('______ is the powerhouse of the cell.', 'Mitochondria', 'Cell Biology', 'MDCAT', 'MDCAT 2022'),
  ('______ organisms have separate male and female individuals.', 'Dioecious', 'Reproduction', 'FSc', ''),
  ('The SI unit of force is ______.', 'Newton', 'Physics', 'ECAT', ''),
  ('The speed of light in vacuum is approximately ______ m/s.', '3 x 10^8', 'Physics', 'ECAT', 'ECAT 2020');

INSERT INTO public.reports (mcq_text, user_name, reason, status, kind) VALUES
  ('SI unit of force?', 'Bilal Ahmed', 'Wrong answer marked in past papers key', 'pending', 'MCQ'),
  ('pH of pure water at 25°C?', 'Hira Malik', 'Typo in option 3', 'pending', 'MCQ'),
  ('______ is the powerhouse of the cell.', 'Sana Iqbal', 'Answer needs fixing', 'pending', 'Ratta');

INSERT INTO public.announcements (title, message, kind) VALUES
  ('MDCAT 2024 Practice Available', 'New past papers and high-yield questions have been added for MDCAT 2024 preparation.', 'info'),
  ('Scheduled System Maintenance', 'Platform will undergo a quick 5-minute database upgrade at 2 AM PKT.', 'warning');
