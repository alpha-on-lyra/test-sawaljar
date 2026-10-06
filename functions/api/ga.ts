// Cloudflare Pages Function: GET /api/ga?report=sources|pages|topics|countries&days=28
// Secrets (Pages > Settings > Variables and Secrets): GA_PROPERTY_ID, GA_CLIENT_EMAIL, GA_PRIVATE_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
interface Env {
  GA_PROPERTY_ID: string;
  GA_CLIENT_EMAIL: string;
  GA_PRIVATE_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

const REPORTS: Record<string, { dimensions: string[]; metrics: string[]; filter?: object }> = {
  sources: { dimensions: ['sessionSource', 'sessionMedium'], metrics: ['sessions', 'totalUsers'] },
  pages: { dimensions: ['pagePath'], metrics: ['screenPageViews', 'totalUsers'] },
  countries: { dimensions: ['country'], metrics: ['totalUsers', 'sessions'] },
  topics: {
    dimensions: ['customEvent:course', 'customEvent:topic'],
    metrics: ['eventCount'],
    filter: { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'topic_view' } } },
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const b64u = (input: string | ArrayBuffer) => {
  const raw = typeof input === 'string' ? btoa(input) : btoa(String.fromCharCode(...new Uint8Array(input)));
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function googleToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u(JSON.stringify({ iss: env.GA_CLIENT_EMAIL, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const pem = env.GA_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${claim}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${b64u(sig)}` }),
  });
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('Google sign-in failed. Check GA_CLIENT_EMAIL and GA_PRIVATE_KEY.');
  return data.access_token;
}

// Only a signed-in admin who has also passed the admin username and password step may read analytics
async function isAdmin(env: Env, token: string): Promise<boolean> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/admin_is_unlocked`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  return res.ok && (await res.json()) === true;
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '');
  if (!token) return json({ error: 'Sign in as admin first' }, 401);
  if (!(await isAdmin(env, token))) return json({ error: 'Admins only' }, 403);

  const url = new URL(request.url);
  const def = REPORTS[url.searchParams.get('report') || ''];
  if (!def) return json({ error: 'Unknown report' }, 400);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 28));

  try {
    const access = await googleToken(env);
    const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA_PROPERTY_ID}:runReport`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        dimensions: def.dimensions.map((name) => ({ name })),
        metrics: def.metrics.map((name) => ({ name })),
        orderBys: [{ metric: { metricName: def.metrics[0] }, desc: true }],
        dimensionFilter: def.filter,
        limit: 50,
      }),
    });
    const data = (await res.json()) as { error?: { message?: string }; rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] };
    if (!res.ok) return json({ error: data.error?.message || 'Google Analytics request failed' }, 502);
    return json({ rows: (data.rows || []).map((r) => ({ dims: r.dimensionValues.map((d) => d.value), metrics: r.metricValues.map((m) => Number(m.value)) })) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Analytics error' }, 500);
  }
};
