import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

// Set NEXT_PUBLIC_SITE_URL in Cloudflare to your real address, e.g. https://sawaljar.com
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://sawaljar.pages.dev';
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-59VVQC2SGQ';
const TITLE = 'SawalJar: Free MCQs and Ratta Cards for MDCAT, ECAT, FSc and Matric';
const DESC = 'Practise topic-wise MCQs with past paper sources, revise with fill-in-the-blank Ratta Cards, take monthly tests and track your progress. Free for MDCAT, ECAT, FSc and Matric students.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: '%s | SawalJar' },
  description: DESC,
  applicationName: 'SawalJar',
  keywords: ['MDCAT MCQs', 'ECAT MCQs', 'FSc MCQs', 'Matric MCQs', 'past papers', 'Ratta Cards', 'free test preparation Pakistan'],
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: 'SawalJar', title: TITLE, description: DESC, url: '/', locale: 'en_PK' },
  twitter: { card: 'summary', title: TITLE, description: DESC },
  robots: { index: true, follow: true },

  appleWebApp: {
    capable: true,
    title: 'Sawal Jar',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f0efe1' }, { media: '(prefers-color-scheme: dark)', color: '#14141f' }],
};

const jsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'SawalJar',
  url: SITE,
  description: DESC,
  inLanguage: 'en',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
        {/* Google Analytics: added once here, so it runs on every page automatically */}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="ga-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
        </Script>
      </body>
    </html>
  );
}
