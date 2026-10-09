import type { Metadata } from 'next';
import StudentShell from '@/components/StudentShell';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How SawalJar collects, uses and protects your information, and how advertising and analytics work on the site.',
  alternates: { canonical: '/privacy' },
};

const heading = { fontFamily: 'var(--font-display), system-ui, sans-serif' };
const ext = 'underline underline-offset-2 font-semibold text-[var(--pri)] hover:opacity-80';
const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={ext}>{children}</a>
);

const sections: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: 'about',
    title: '1. About this policy',
    body: (
      <>
        <p>SawalJar (&quot;SawalJar&quot;, &quot;we&quot;, &quot;us&quot;) is a free study website that offers practice MCQs, Ratta revision cards, monthly tests and progress tracking for students preparing for MDCAT, ECAT, FSc and Matric examinations.</p>
        <p>This Privacy Policy explains what information we collect, why we collect it, who we share it with, and the choices you have. By creating an account or using SawalJar, you agree to this policy. If you do not agree, please do not use the site.</p>
      </>
    ),
  },
  {
    id: 'collect',
    title: '2. Information we collect',
    body: (
      <>
        <p><b>Account information.</b> When you sign in with Google, we receive your name, email address and profile picture from your Google account. We never receive or store your Google password.</p>
        <p><b>Study activity.</b> We record your selected course, how many questions you attempt and answer correctly, your accuracy, your daily streak, results by subject and by day, the question files you open, and your monthly test attempts. For each question we also keep an anonymous count of how many students answered it and how many were correct. This count is not linked to your identity.</p>
        <p><b>Reports and feedback.</b> If you report a question, we store your report text, the question concerned and your name.</p>
        <p><b>Exam integrity events.</b> During monthly tests and timed sessions, we may record events such as leaving the test tab, together with the time and test name, to keep tests fair.</p>
        <p><b>Technical information.</b> Our analytics and advertising partners may collect your IP address, device and browser type, approximate location, pages visited and referring website, using cookies and similar technologies (see sections 5 and 6).</p>
        <p><b>Information stored in your browser.</b> To work quickly, the site saves your sign-in session, theme choice, side menu preference, a copy of shared course content, and any answers that have not yet been submitted in your browser&apos;s local storage.</p>
      </>
    ),
  },
  {
    id: 'use',
    title: '3. How we use your information',
    body: (
      <>
        <ul className="list-disc pl-6 space-y-1">
          <li>To create your account, keep you signed in and show your progress and statistics.</li>
          <li>To run features such as the leaderboard, monthly tests, bookmarks and score sharing.</li>
          <li>To review reported questions and improve the quality of our content.</li>
          <li>To keep tests fair, prevent misuse and protect the security of the site.</li>
          <li>To understand how the site is used so that we can fix problems and improve it.</li>
          <li>To show advertising that helps cover the cost of running a free website.</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </>
    ),
  },
  {
    id: 'visible',
    title: '4. What other students can see',
    body: (
      <p>If you have answered questions, your first name and last initial, your selected course, number of questions solved, accuracy and streak may appear on the leaderboard to other signed-in students. Your email address and profile picture are never shown to other students. We may offer a way to hide yourself from the leaderboard; if you want to be removed now, contact us using the details in section 12.</p>
    ),
  },
  {
    id: 'ads',
    title: '5. Advertising',
    body: (
      <>
        <p>SawalJar is free to use. To help pay for hosting and development, we show a small number of advertisements. We keep them limited, place them in clearly separated areas, and try not to let them interrupt your studying.</p>
        <p>Advertisements are provided by third-party advertising partners such as Google AdSense and Adsterra. These partners may use cookies, web beacons and similar technologies to show ads, measure how well they perform and, where permitted, personalise them based on your visits to this and other websites. We do not give advertisers your name, email address or study records.</p>
        <p>Third-party vendors, including Google, use cookies to serve ads based on a user&apos;s prior visits to this website or other websites. Google&apos;s use of advertising cookies enables it and its partners to serve ads to you based on your visit to SawalJar and/or other sites on the Internet.</p>
        <p>You can opt out of personalised advertising from Google by visiting <A href="https://adssettings.google.com">Google Ads Settings</A>. You can also learn how Google uses information from sites that use its services <A href="https://policies.google.com/technologies/partner-sites">here</A>, or opt out of many third-party vendors&apos; personalised advertising at <A href="https://www.aboutads.info/choices/">aboutads.info</A>. Your browser settings also let you block or delete cookies, although some parts of the site may then work less well.</p>
        <p>We may also check whether your browser blocks advertising, so that we can show a message asking you to allow ads. This check does not collect or store any personal information.</p>
      </>
    ),
  },
  {
    id: 'analytics',
    title: '6. Analytics',
    body: (
      <p>We use Google Analytics to understand how visitors find and use SawalJar, for example which pages are opened, which courses and topics are popular, and which countries visitors come from. Google Analytics uses cookies and similar technologies and receives information such as your IP address and device details. We do not send your name or email address to Google Analytics. You can prevent data collection by installing the <A href="https://tools.google.com/dlpage/gaoptout">Google Analytics opt-out browser add-on</A>. Learn more in <A href="https://policies.google.com/privacy">Google&apos;s Privacy Policy</A>.</p>
    ),
  },
  {
    id: 'providers',
    title: '7. Service providers who handle data for us',
    body: (
      <>
        <ul className="list-disc pl-6 space-y-1">
          <li><b>Google</b> provides sign-in (Google Sign-In), analytics and advertising.</li>
          <li><b>Supabase</b> stores account, statistics and report data in a secured database (<A href="https://supabase.com/privacy">privacy policy</A>).</li>
          <li><b>Cloudflare</b> hosts and delivers the website (<A href="https://www.cloudflare.com/privacypolicy/">privacy policy</A>).</li>
          <li><b>Advertising partners</b> such as Google AdSense and Adsterra, as described in section 5.</li>
        </ul>
        <p>In short: our website is hosted on Cloudflare, and our backend (sign-in and database) runs on Supabase. These providers process information only as needed to provide their services and under their own privacy terms. Their servers may be located in other countries, so your information may be processed there. We may also share information when required by law or to protect the rights, safety and security of our users and the site.</p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: '8. Cookies and local storage',
    body: (
      <p>We use local storage in your browser to keep you signed in and remember your preferences. Analytics and advertising partners set cookies of their own. You can clear local storage and cookies in your browser settings at any time. Doing so signs you out, and any answers that were not yet submitted may be lost.</p>
    ),
  },
  {
    id: 'retention',
    title: '9. How long we keep information',
    body: (
      <>
        <p>We keep your account and statistics for as long as your account exists. Exam integrity events are kept for about 60 days, closed reports for about 90 days and administrator activity records for about 180 days, after which they are deleted. When an account is deleted, its profile and personal statistics are removed. Anonymous question counts that are not linked to you may remain.</p>
      </>
    ),
  },
  {
    id: 'security',
    title: '10. Security',
    body: (
      <p>We protect your information with encrypted connections (HTTPS), access rules in our database so that students can only reach their own records, and separate, password-protected administrator access. No website or storage method is completely secure, so we cannot guarantee absolute security. Please keep your Google account protected with a strong password and 2-step verification.</p>
    ),
  },
  {
    id: 'children',
    title: '11. Age and children',
    body: (
      <p>SawalJar is intended for students aged 13 and over. We do not knowingly collect personal information from children under 13. If you are under 18, please use the site with the knowledge of a parent or guardian. If you believe a child under 13 has created an account, contact us and we will delete it.</p>
    ),
  },
  {
    id: 'rights',
    title: '12. Your choices and how to contact us',
    body: (
      <>
        <p>You may ask us to show you the information we hold about you, correct it, or delete your account and personal data. You can also withdraw from personalised advertising using the links in section 5. To make a request, or if you have any question about this policy, send us a message using our feedback page at <A href="https://reply-sawaljar.pages.dev">reply-sawaljar.pages.dev</A>, mentioning the email address of your Google account. We may need to confirm your identity before acting on a request.</p>
      </>
    ),
  },
  {
    id: 'other',
    title: '13. Content, external links and disclaimer',
    body: (
      <p>SawalJar&apos;s questions, notes and video suggestions are provided for study practice only. We work to keep them accurate, but we do not guarantee that they match any official examination, and results in practice tests do not predict exam results. Some pages link to videos, PDF files or other websites that we do not control; their own privacy policies apply when you visit them.</p>
    ),
  },
  {
    id: 'changes',
    title: '14. Changes to this policy',
    body: (
      <p>We may update this policy from time to time. When we do, we will change the date at the top of this page, and for important changes we may also show a notice on the site. Continuing to use SawalJar after a change means you accept the updated policy.</p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <StudentShell>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={heading}>Privacy Policy</h1>
        <p className="mt-2 text-sm text-[var(--mut)]">Last updated: 8 October 2026</p>

        <nav aria-label="Contents" className="mt-6 rounded-2xl bg-[var(--card)] border border-[var(--line)] p-4 sm:p-5">
          <p className="font-bold mb-2" style={heading}>Contents</p>
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {sections.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} className="text-[var(--mut)] hover:text-[var(--pri)]">{s.title}</a></li>
            ))}
          </ol>
        </nav>

        <div className="mt-8 flex flex-col gap-8">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-xl font-bold mb-3" style={heading}>{s.title}</h2>
              <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-[var(--ink)] [&_p]:text-[var(--ink)] [&_ul]:text-[var(--ink)]">{s.body}</div>
            </section>
          ))}
        </div>
      </main>
    </StudentShell>
  );
}
