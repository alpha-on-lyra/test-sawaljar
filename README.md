# SawalJar — Next.js + Supabase + Cloudflare Pages MCQ Platform

A high-performance MCQ and exam preparation platform built with **Next.js 16**, **TypeScript**, **Tailwind CSS**, and **Supabase**, optimized specifically for **Free Tier** hosting on **Cloudflare Pages** and **Supabase**.

---

## 🚀 Key Highlights & Features

### 1. 🛡️ Security, Anti-Cheat & Multi-Account Protection
- **Anti-Cheat Exam Mode**:
  - Real-time tab-switch detection via Page Visibility API and window blur events.
  - Configurable maximum allowed tab switches before automatic test submission.
  - Active clipboard blocking (disables copy, cut, paste, and right-click context menu).
  - DevTools shortcut blocker (F12, Ctrl+Shift+I/J).
  - Content protection: answers can be verified server-side so students cannot inspect network payloads.
- **Multi-Account Prevention**:
  - Client hardware fingerprinting (Screen, Cores, Timezone, Language, Canvas hash).
  - Detects when multiple accounts log in from the same machine.
  - Configurable admin action: Flag for manual review or automatic suspension.
- **Access Control & RBAC**:
  - Super Admin, Moderator, and Student roles with Supabase Row Level Security (RLS).
  - Instant user actions: Suspend, Ban, Restore, Reset progress, or Delete.
  - Blocked IP addresses management table with instant unblock.

### 2. 🔐 "Continue with Google" Authentication Only
- Strictly configured to accept **"Continue with Google"** OAuth.
- Eliminates fake password registrations, bots, and disposable email spam.
- One-click Google sign-in with automatic profile creation and avatar sync.

### 3. 🖥️ Full 12-View Admin Control Center (`/admin`)
Faithfully implemented from the original mockup with the custom earthy design system:
1. **Dashboard**: High-level KPIs, 7-day SVG graph of solved questions, dynamic live activity ticker, enrolled courses breakdown.
2. **Users**: Search, status filter, user inspection modal, CSV export, suspend, ban, progress reset, delete.
3. **Courses**: Add courses (e.g. MDCAT, ECAT, Matric, FSc, NUST NET), delete, live question and student counts.
4. **MCQ Bank**: Bulk JSON file upload, sample JSON loader, remote JSON link sync with "Fetch & import", live search, delete.
5. **Ratta Cards**: Active-recall fill-in-the-blank cards with `______` blank slots, bulk JSON upload, delete.
6. **Reports**: Wrong-answer reports submitted by students with status tagging (Fixed, Rejected, Deleted).
7. **Ads**: Master switch, Google AdSense & Adsterra selector, custom script code paste, 6 distinct placement switches (`dash_top`, `dash_side`, `mcq`, `revision`, `result`, `between`).
8. **Announcements**: Broadcast notices to all students with style tags (info, warning, success).
9. **Features**: Maintenance mode with custom student message, 8 feature flags (signup, streaks, leaderboard, timed tests, notes, bookmarks, sharing, dark mode).
10. **Settings**: Quiz options (question shuffle, option shuffle, explanation reveal, negative marking, instant retakes, self-check), questions per test, timer in seconds, animation selector, content protection toggles, and JSON data backup/restore.
11. **Security**: 2FA toggle, session timeouts, rate limits, anti-cheat limits, multi-account device threshold, blocked IPs list.
12. **Logs**: Audit trail with CSV export and real-time student activity feed.

### 4. 🎓 Student Practice Portal
- **MCQ Exam Engine (`/practice`)**: Timed tests, instant explanations, negative marking deduction (-0.25), question reporting modal, and score review.
- **Ratta Cards Revision (`/ratta`)**: Fill-in-the-blank cards with smooth reveal animations and "I Knew It" / "I Did Not" self-assessment buttons.
- **Leaderboard (`/leaderboard`)**: Real-time student ranking by accuracy and total solved.
- **Course Catalog (`/courses`)**: Overview of syllabi and topic breakdowns.
- **Dark & Light Mode**: Built-in toggle persisting to `localStorage` and `data-theme`.

---

## 🛠️ Free Tier Setup Guide

### 1. Supabase Setup (100% Free Plan)
1. Create a free account at [supabase.com](https://supabase.com) and create a new project.
2. In your Supabase Dashboard, open the **SQL Editor**.
3. Open `sawaljar/supabase/schema.sql`, copy all contents, paste into the SQL editor, and click **Run**.
4. This creates all tables, indexes, Row Level Security (RLS) policies, and default seed data.
5. Go to **Project Settings** -> **API** and copy:
   - `Project URL`
   - `Project API anon key`

### 2. "Continue with Google" OAuth Configuration
1. Go to [Google Cloud Console](https://console.cloud.google.com).
2. Create a project -> **APIs & Services** -> **Credentials**.
3. Click **Create Credentials** -> **OAuth 2.0 Client ID** (Application type: Web application).
4. In **Authorized redirect URIs**, enter:
   ```
   https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
   ```
5. Click **Create** and copy your **Client ID** and **Client Secret**.
6. In your Supabase Dashboard, go to **Authentication** -> **Providers** -> **Google**.
7. Toggle **Enable Google**, paste the Client ID and Client Secret, and save.

### 3. Local Development
```bash
cd sawaljar
cp .env.example .env.local
# Add your Supabase URL and anon key into .env.local

npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) for the student portal or [http://localhost:3000/admin](http://localhost:3000/admin) for the admin panel.

*Note: The platform features an automatic local storage fallback, meaning it functions completely error-free even before connecting Supabase credentials!*

### 4. Cloudflare Pages Deployment (Free Plan)
1. Push this repository to GitHub or GitLab.
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) -> **Workers & Pages** -> **Create application** -> **Pages**.
3. Connect your repository:
   - **Framework preset**: `Next.js`
   - **Build command**: `npm run build`
   - **Build output directory**: `.next`
   - **Root directory**: `sawaljar` (or `/` if root of repo)
4. Under **Environment variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://your-project.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `your-anon-key`
   - `NEXT_PUBLIC_SITE_URL`: `https://your-project.pages.dev`
5. Click **Save and Deploy**. Your site will be live worldwide on Cloudflare's global edge network!
