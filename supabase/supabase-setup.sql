-- ============================================================================
-- SawalJar database for Supabase (Postgres).  Run ONCE in Supabase > SQL Editor.
-- Lives here: sign-in profiles (role, ban status), shared content (JSON), student
-- stats, reports, anti-cheat logs, audit log. Safe to re-run.
-- ============================================================================
-- If you already ran your OLD schema and have NO real data, uncomment this one line first:
-- drop table if exists public.weekly_stats, public.blocked_ips, public.device_sessions, public.audit_logs, public.settings, public.announcements, public.reports, public.anti_cheat_logs, public.ratta_cards, public.mcqs, public.topic_resources, public.topics, public.profiles, public.courses cascade;

begin;

-- 1) PROFILES ---------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  name text not null default '',
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended', 'banned')),
  enrolled_course text,
  solved integer not null default 0,
  correct integer not null default 0,
  accuracy integer not null default 0,
  streak integer not null default 0,
  last_active_day date,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (lower(email));

-- 1b) EXTRA ADMIN LOGIN: a username and password checked by the database, on top of Google sign-in and role = admin.
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.admin_credentials (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  username text not null,
  password_hash text not null,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists admin_credentials_username_idx on public.admin_credentials (username);
-- One row per unlocked browser session (the Supabase session id). Admin powers work only while a row is valid.
create table if not exists public.admin_unlocks (
  session_id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null
);
alter table public.admin_credentials enable row level security;
alter table public.admin_unlocks enable row level security;
revoke all on public.admin_credentials, public.admin_unlocks from anon, authenticated; -- no policies: only the functions below can touch them

-- 2) HELPERS used by the security rules ---------------------------------------
create or replace function public.is_admin_role() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' and status = 'active' from public.profiles where id = auth.uid()), false);
$$;
-- A real admin = admin role AND this browser session has entered the admin username and password
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin_role() and exists (
    select 1 from public.admin_unlocks u
     where u.user_id = auth.uid()
       and u.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
       and u.expires_at > now());
$$;
create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'active' from public.profiles where id = auth.uid()), false);
$$;
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- 3) Profile is created automatically on first Google sign-in (nobody becomes admin by email) ----
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update set email = excluded.email, name = excluded.name, avatar_url = excluded.avatar_url, updated_at = now();
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- People who signed in before this script ran
insert into public.profiles (id, email, name, avatar_url)
select u.id, coalesce(u.email, ''), coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(coalesce(u.email, ''), '@', 1)), u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do nothing;

-- 4) CONTENT: courses, subjects, topics, MCQ and card files, announcements, strip, settings (JSON by key) ----
create table if not exists public.content (
  key text primary key check (char_length(key) between 1 and 120),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
drop trigger if exists content_touch on public.content;
create trigger content_touch before insert or update on public.content for each row execute function public.touch_updated_at();

-- 5) STUDENT STATS (written only through the functions in section 7) -------------
create table if not exists public.user_daily_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  attempted integer not null default 0,
  correct integer not null default 0,
  primary key (user_id, day)
);
create table if not exists public.user_subject_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  attempted integer not null default 0,
  correct integer not null default 0,
  primary key (user_id, subject)
);
-- Per-question results, so you can see which questions students get wrong. The questions themselves are NOT stored here:
-- the JSON files live on another website and are opened by link. qkey is a short code of the question text.
create table if not exists public.question_stats (
  set_id text not null check (char_length(set_id) between 1 and 80),
  qkey text not null check (char_length(qkey) between 1 and 40),
  attempts integer not null default 0,
  correct integer not null default 0,
  primary key (set_id, qkey)
);
create table if not exists public.set_stats (
  set_id text primary key,
  views integer not null default 0,
  attempts integer not null default 0
);

-- 6) REPORTS, ANTI-CHEAT, AUDIT ----------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  mcq_text text not null check (char_length(mcq_text) <= 2000),
  kind text not null default 'MCQ' check (kind in ('MCQ', 'Ratta')),
  user_name text not null default 'Anonymous',
  user_id uuid references public.profiles (id) on delete set null,
  reason text not null check (char_length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending', 'fixed', 'rejected')),
  created_at timestamptz not null default now()
);
create table if not exists public.anti_cheat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  user_email text not null default '',
  event_type text not null check (char_length(event_type) <= 60),
  test_title text not null default 'Practice Session',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid default auth.uid() references public.profiles (id) on delete set null,
  action text not null check (char_length(action) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists anti_cheat_created_idx on public.anti_cheat_logs (created_at desc);

-- 7) FUNCTIONS students call (they cannot edit stats, role or ban status directly) ----------
create or replace function public.touch_me(p_course text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set last_seen = now(),
         enrolled_course = coalesce(nullif(left(p_course, 80), ''), enrolled_course),
         updated_at = now()
   where id = auth.uid();
end $$;

create or replace function public.record_answer(p_correct boolean, p_subject text default 'General') returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Asia/Karachi')::date;
  ok integer := case when p_correct then 1 else 0 end;
  subj text := coalesce(nullif(left(trim(p_subject), 80), ''), 'General');
  prev date;
begin
  if me is null or not public.is_active() then return; end if;
  select last_active_day into prev from public.profiles where id = me;
  update public.profiles
     set solved = solved + 1,
         correct = correct + ok,
         accuracy = round(100.0 * (correct + ok) / (solved + 1)),
         streak = case when prev = today then streak when prev = today - 1 then streak + 1 else 1 end,
         last_active_day = today, last_seen = now(), updated_at = now()
   where id = me;
  insert into public.user_daily_stats (user_id, day, attempted, correct) values (me, today, 1, ok)
    on conflict (user_id, day) do update
      set attempted = public.user_daily_stats.attempted + 1, correct = public.user_daily_stats.correct + ok;
  insert into public.user_subject_stats (user_id, subject, attempted, correct) values (me, subj, 1, ok)
    on conflict (user_id, subject) do update
      set attempted = public.user_subject_stats.attempted + 1, correct = public.user_subject_stats.correct + ok;
end $$;

-- ONE call when a student FINISHES a test. While they solve, nothing is sent to Supabase.
-- p_items = [{"s": "<file id>", "j": "<subject>", "k": "<question key>", "ok": true}, ...]
-- p_views = the file ids that were opened. p_logs = anti-cheat events collected during the test.
-- p_profile = true for MCQs (counts toward Statistics and the leaderboard), false for Ratta Cards.
drop function if exists public.record_batch(text, text, boolean, jsonb);
create or replace function public.record_batch(p_profile boolean, p_items jsonb, p_views text[] default '{}', p_course text default null, p_logs jsonb default '[]'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Asia/Karachi')::date;
  it jsonb; ev jsonb; sid text; k text; subj text; v text; em text; good boolean;
  n int := 0; ok_n int := 0; total int; used int; prev date; prof boolean; cnt int := 0;
begin
  if me is null or not public.is_active() then return; end if;
  if p_views is not null then
    foreach v in array p_views loop
      cnt := cnt + 1;
      exit when cnt > 20;
      continue when char_length(coalesce(v, '')) not between 1 and 80;
      insert into public.set_stats (set_id, views, attempts) values (v, 1, 0)
        on conflict (set_id) do update set views = public.set_stats.views + 1;
    end loop;
  end if;
  if p_logs is not null and jsonb_typeof(p_logs) = 'array' then
    select email into em from public.profiles where id = me;
    for ev in select value from jsonb_array_elements(p_logs) limit 20 loop
      insert into public.anti_cheat_logs (user_id, user_email, event_type, test_title)
        values (me, coalesce(em, ''), left(coalesce(ev ->> 'e', 'event'), 60), left(coalesce(ev ->> 't', 'Practice Session'), 120));
    end loop;
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then return; end if;
  total := least(jsonb_array_length(p_items), 300);
  if total = 0 then return; end if;
  prof := coalesce(p_profile, false);
  if prof then -- at most 2000 answers a day count, so nobody can inflate the leaderboard
    select attempted into used from public.user_daily_stats where user_id = me and day = today;
    if coalesce(used, 0) + total > 2000 then prof := false; end if;
  end if;
  for it in select value from jsonb_array_elements(p_items) limit 300 loop
    sid := left(coalesce(it ->> 's', ''), 80);
    k := left(coalesce(it ->> 'k', ''), 40);
    continue when sid = '' or k = '';
    subj := coalesce(nullif(left(trim(coalesce(it ->> 'j', '')), 80), ''), 'General');
    good := (it ->> 'ok') = 'true';
    n := n + 1;
    ok_n := ok_n + case when good then 1 else 0 end;
    insert into public.question_stats (set_id, qkey, attempts, correct) values (sid, k, 1, case when good then 1 else 0 end)
      on conflict (set_id, qkey) do update
        set attempts = public.question_stats.attempts + 1, correct = public.question_stats.correct + excluded.correct;
    insert into public.set_stats (set_id, views, attempts) values (sid, 0, 1)
      on conflict (set_id) do update set attempts = public.set_stats.attempts + 1;
    if prof then
      insert into public.user_subject_stats (user_id, subject, attempted, correct) values (me, subj, 1, case when good then 1 else 0 end)
        on conflict (user_id, subject) do update
          set attempted = public.user_subject_stats.attempted + 1, correct = public.user_subject_stats.correct + excluded.correct;
    end if;
  end loop;
  if n = 0 or not prof then return; end if;
  select last_active_day into prev from public.profiles where id = me;
  update public.profiles
     set solved = solved + n,
         correct = correct + ok_n,
         accuracy = round(100.0 * (correct + ok_n) / (solved + n)),
         streak = case when prev = today then streak when prev = today - 1 then streak + 1 else 1 end,
         enrolled_course = coalesce(nullif(left(p_course, 80), ''), enrolled_course),
         last_active_day = today, last_seen = now(), updated_at = now()
   where id = me;
  insert into public.user_daily_stats (user_id, day, attempted, correct) values (me, today, n, ok_n)
    on conflict (user_id, day) do update
      set attempted = public.user_daily_stats.attempted + n, correct = public.user_daily_stats.correct + ok_n;
end $$;

-- ONE call when the app opens: who is signed in (role, ban status), whether the admin password step is done,
-- and the version list of the shared content. Replaces three separate requests.
create or replace function public.bootstrap() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'profile', (select jsonb_build_object('id', p.id, 'email', p.email, 'name', p.name, 'avatar_url', p.avatar_url, 'role', p.role, 'status', p.status)
                  from public.profiles p where p.id = auth.uid()),
    'unlocked', public.is_admin(),
    'versions', coalesce((select jsonb_agg(jsonb_build_object('key', c.key, 'updated_at', c.updated_at))
                            from public.content c
                           where c.key in ('courses', 'site', 'maint', 'strip', 'ann') or public.is_active()), '[]'::jsonb));
$$;

-- ONE call for the Statistics page
create or replace function public.my_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'solved', coalesce((select solved from public.profiles where id = auth.uid()), 0),
    'correct', coalesce((select correct from public.profiles where id = auth.uid()), 0),
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'a', attempted, 'c', correct)) from public.user_daily_stats
                       where user_id = auth.uid() and day >= (now() at time zone 'Asia/Karachi')::date - 60), '[]'::jsonb),
    'subjects', coalesce((select jsonb_agg(jsonb_build_object('s', subject, 'a', attempted, 'c', correct)) from public.user_subject_stats
                           where user_id = auth.uid()), '[]'::jsonb));
$$;

create or replace function public.bump_set_stat(p_set text, p_field text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active() or p_field not in ('views', 'attempts') or char_length(coalesce(p_set, '')) not between 1 and 80 then return; end if;
  insert into public.set_stats (set_id, views, attempts)
    values (p_set, (p_field = 'views')::int, (p_field = 'attempts')::int)
    on conflict (set_id) do update
      set views = public.set_stats.views + (p_field = 'views')::int,
          attempts = public.set_stats.attempts + (p_field = 'attempts')::int;
end $$;

create or replace function public.get_leaderboard(p_course text default null)
returns table (id uuid, name text, course text, solved integer, accuracy integer, streak integer)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.enrolled_course, p.solved, p.accuracy, p.streak
    from public.profiles p
   where public.is_active() and p.status = 'active' and p.solved > 0
     and (p_course is null or p.enrolled_course = p_course)
   order by p.solved * p.accuracy desc, p.solved desc
   limit 50;
$$;

revoke all on function public.touch_me(text), public.record_answer(boolean, text), public.record_batch(boolean, jsonb, text[], text, jsonb), public.my_stats(), public.bump_set_stat(text, text), public.get_leaderboard(text) from public, anon;
grant execute on function public.touch_me(text), public.record_answer(boolean, text), public.record_batch(boolean, jsonb, text[], text, jsonb), public.my_stats(), public.bump_set_stat(text, text), public.get_leaderboard(text) to authenticated;
-- bootstrap is also for visitors who are not signed in (it returns only the public content versions for them)
revoke all on function public.bootstrap() from public;
grant execute on function public.bootstrap() to anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.admin_reset_user(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.profiles set solved = 0, correct = 0, accuracy = 0, streak = 0, last_active_day = null, updated_at = now() where id = p_id;
  delete from public.user_daily_stats where user_id = p_id;
  delete from public.user_subject_stats where user_id = p_id;
end $$;

-- Removes the student's account and all their data. The same person can sign in again later as a brand new student.
create or replace function public.admin_delete_user(p_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_id = auth.uid() then raise exception 'You cannot delete your own account'; end if;
  delete from auth.users where id = p_id;
end $$;

revoke all on function public.admin_reset_user(uuid), public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_reset_user(uuid), public.admin_delete_user(uuid) to authenticated;

-- Keeps the free 500 MB database small: removes old logs. Students' stats and your content are never touched.
create or replace function public.cleanup_old_data() returns text
language plpgsql security definer set search_path = public as $$
declare a int; b int; c int; d int;
begin
  delete from public.anti_cheat_logs where created_at < now() - interval '60 days'; get diagnostics a = row_count;
  delete from public.audit_logs where created_at < now() - interval '180 days'; get diagnostics b = row_count;
  delete from public.reports where status <> 'pending' and created_at < now() - interval '90 days'; get diagnostics c = row_count;
  delete from public.user_daily_stats where day < (now() - interval '400 days')::date; get diagnostics d = row_count;
  return format('Removed %s anti-cheat logs, %s audit entries, %s old reports and %s old daily stats', a, b, c, d);
end $$;
create or replace function public.admin_cleanup() returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return public.cleanup_old_data();
end $$;
create or replace function public.admin_db_usage() returns bigint
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return pg_database_size(current_database());
end $$;

revoke all on function public.cleanup_old_data() from public, anon, authenticated;
revoke all on function public.admin_cleanup(), public.admin_db_usage() from public, anon;
grant execute on function public.admin_cleanup(), public.admin_db_usage() to authenticated;
-- Optional nightly run (first enable pg_cron in Dashboard > Database > Extensions):
-- select cron.schedule('sawaljar-cleanup', '0 3 * * *', $$select public.cleanup_old_data()$$);

-- Admin login functions ------------------------------------------------------------------------------------
-- Run ONCE in the SQL Editor (not from the app) to create or change the admin username and password:
--   select public.set_admin_credentials('you@gmail.com', 'your-username', 'a-long-password');
create or replace function public.set_admin_credentials(p_email text, p_user text, p_pass text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare pid uuid;
begin
  if char_length(trim(coalesce(p_user, ''))) < 3 then raise exception 'Username must be at least 3 characters'; end if;
  if char_length(coalesce(p_pass, '')) < 10 then raise exception 'Password must be at least 10 characters'; end if;
  select id into pid from public.profiles where lower(email) = lower(p_email) and role = 'admin';
  if pid is null then raise exception 'No admin profile for %. Sign in once and set role = admin first.', p_email; end if;
  insert into public.admin_credentials (user_id, username, password_hash)
    values (pid, lower(trim(p_user)), crypt(p_pass, gen_salt('bf', 10)))
    on conflict (user_id) do update
      set username = excluded.username, password_hash = excluded.password_hash, failed_count = 0, locked_until = null, updated_at = now();
  delete from public.admin_unlocks where user_id = pid;
  return 'Admin login saved for ' || p_email;
end $$;

create or replace function public.admin_login(p_user text, p_pass text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  c public.admin_credentials;
begin
  if me is null or sid is null or not public.is_admin_role() then return false; end if;
  select * into c from public.admin_credentials where user_id = me;
  if not found then return false; end if;
  if c.locked_until is not null and c.locked_until > now() then
    raise exception 'Too many wrong attempts. Try again in 15 minutes.';
  end if;
  if c.username = lower(trim(coalesce(p_user, ''))) and c.password_hash = crypt(coalesce(p_pass, ''), c.password_hash) then
    update public.admin_credentials set failed_count = 0, locked_until = null where user_id = me;
    delete from public.admin_unlocks where expires_at < now();
    insert into public.admin_unlocks (session_id, user_id, expires_at) values (sid, me, now() + interval '8 hours')
      on conflict (session_id) do update set user_id = excluded.user_id, expires_at = excluded.expires_at;
    return true;
  end if;
  update public.admin_credentials
     set failed_count = case when failed_count + 1 >= 5 then 0 else failed_count + 1 end,
         locked_until = case when failed_count + 1 >= 5 then now() + interval '15 minutes' else null end
   where user_id = me;
  return false;
end $$;

create or replace function public.admin_is_unlocked() returns boolean
language sql stable security definer set search_path = public as $$ select public.is_admin(); $$;

create or replace function public.admin_logout() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.admin_unlocks where user_id = auth.uid() and session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid;
end $$;

revoke all on function public.set_admin_credentials(text, text, text) from public, anon, authenticated;
revoke all on function public.admin_login(text, text), public.admin_is_unlocked(), public.admin_logout() from public, anon;
grant execute on function public.admin_login(text, text), public.admin_is_unlocked(), public.admin_logout() to authenticated;

-- 8) SECURITY RULES (Row Level Security) -------------------------------------------------
alter table public.profiles enable row level security;
alter table public.content enable row level security;
alter table public.user_daily_stats enable row level security;
alter table public.user_subject_stats enable row level security;
alter table public.set_stats enable row level security;
alter table public.question_stats enable row level security;
alter table public.reports enable row level security;
alter table public.anti_cheat_logs enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles read own or admin" on public.profiles;
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles read own or admin" on public.profiles for select to authenticated using (auth.uid() = id or public.is_admin());
create policy "profiles admin update" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "content public keys" on public.content;
drop policy if exists "content members read" on public.content;
drop policy if exists "content admin write" on public.content;
-- visitors (not signed in) can read only what the landing page needs
create policy "content public keys" on public.content for select to anon, authenticated using (key in ('courses', 'site', 'maint', 'strip', 'ann'));
-- signed-in students who are not banned can read everything else (MCQs, cards, topics...)
create policy "content members read" on public.content for select to authenticated using (public.is_active());
create policy "content admin write" on public.content for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "daily own or admin" on public.user_daily_stats;
drop policy if exists "subject own or admin" on public.user_subject_stats;
drop policy if exists "set stats admin" on public.set_stats;
drop policy if exists "question stats admin" on public.question_stats;
create policy "daily own or admin" on public.user_daily_stats for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "subject own or admin" on public.user_subject_stats for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "set stats admin" on public.set_stats for select to authenticated using (public.is_admin());
create policy "question stats admin" on public.question_stats for select to authenticated using (public.is_admin());

drop policy if exists "reports students send" on public.reports;
drop policy if exists "reports admin all" on public.reports;
create policy "reports students send" on public.reports for insert to authenticated with check (user_id = auth.uid() and status = 'pending' and public.is_active());
create policy "reports admin all" on public.reports for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "anti cheat students log" on public.anti_cheat_logs;
drop policy if exists "anti cheat admin all" on public.anti_cheat_logs;
create policy "anti cheat students log" on public.anti_cheat_logs for insert to authenticated with check (user_id = auth.uid() and public.is_active());
create policy "anti cheat admin all" on public.anti_cheat_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "audit admin all" on public.audit_logs;
create policy "audit admin all" on public.audit_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Visitors who are not signed in get nothing except the public content keys above
revoke all on all tables in schema public from anon;
grant select on public.content to anon;

commit;

-- 9) MAKE YOURSELF ADMIN (two steps). First sign in once with your Google account, then run both lines with your own email:
--   update public.profiles set role = 'admin' where email = 'you@gmail.com';
--   select public.set_admin_credentials('you@gmail.com', 'your-username', 'a-long-password');
