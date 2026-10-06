import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://sawaljar.pages.dev';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/login', '/dashboard', '/practice', '/ratta', '/stats', '/leaderboard', '/announcements'] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
