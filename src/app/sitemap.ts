import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://sawaljar.pages.dev';

// Only public pages belong here. Student pages need a sign-in, so search engines cannot see them.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 }];
}
