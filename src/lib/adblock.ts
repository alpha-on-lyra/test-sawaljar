// Detects an ad blocker in two ways: (1) a bait element with class names blockers usually hide,
// (2) a tiny request to the Google ad address (blocked by most blockers) compared with a request to our own site.
// No personal information is sent. The result is remembered for 2 minutes so moving between pages costs nothing.
const AD_URL = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

export const isBlocked = (baitHidden: boolean, selfOk: boolean, adOk: boolean) => baitHidden || (selfOk && !adOk);

const reach = (url: string, init: RequestInit) => fetch(url, init).then(() => true, () => false);

async function baitHidden(): Promise<boolean> {
  const bait = document.createElement('div');
  bait.className = 'adsbox ad-banner ad_unit pub_300x250 textAd text-ad banner_ad adsbygoogle';
  bait.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:10px;height:10px;';
  bait.innerHTML = '&nbsp;';
  document.body.appendChild(bait);
  await new Promise((r) => setTimeout(r, 120));
  const cs = getComputedStyle(bait);
  const hidden = cs.display === 'none' || cs.visibility === 'hidden' || bait.offsetParent === null || bait.offsetHeight === 0;
  bait.remove();
  return hidden;
}

export async function detectAdblock(): Promise<boolean> {
  const [bait, adOk, selfOk] = await Promise.all([
    baitHidden(),
    reach(AD_URL, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' }),
    reach('/robots.txt', { method: 'HEAD', cache: 'no-store' }),
  ]);
  return isBlocked(bait, selfOk, adOk);
}

let last: { at: number; blocked: boolean } | null = null;
export async function checkAdblock(force = false): Promise<boolean> {
  if (!force && last && Date.now() - last.at < 120000) return last.blocked;
  const blocked = await detectAdblock();
  last = { at: Date.now(), blocked };
  return blocked;
}
