// Google Analytics 4 helper. Set NEXT_PUBLIC_GA_ID (G-XXXXXXX) in Cloudflare Pages build variables.
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// Call once from a client component that mounts on every page (for example your root layout wrapper).
export function initGA() {
  if (!GA_ID || typeof window === 'undefined' || window.gtag) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // gtag.js expects the arguments object, not an array
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID);
}

// Call when a student opens a topic in a course. Powers "views of a topic in a course" in the admin.
export function trackTopicView(course: string, topic: string) {
  window.gtag?.('event', 'topic_view', { course, topic });
}

// Call when a single MCQ or Ratta Card is shown or answered.
export function trackContent(kind: 'mcq' | 'ratta', action: 'view' | 'attempt', course: string, topic: string, id: string) {
  window.gtag?.('event', `${kind}_${action}`, { course, topic, item_id: id });
}
