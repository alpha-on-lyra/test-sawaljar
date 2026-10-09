'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { initCloud, syncFromCloud, getCloudStatus, subscribeCloud, PULL_EVERY } from '@/lib/cloud';
import { recoverPending } from '@/lib/batch';

// Call once per page. The first page pulls the latest data; moving between pages does not pull again.
// It re-checks when the tab is focused again (at most every 10 minutes) and every 10 minutes while the tab is open.
// force = true is for the admin panel, which must pull right after the admin password is entered.
export function useCloudSync(force = false) {
  useEffect(() => {
    initCloud();
    void syncFromCloud(force);
    void recoverPending(); // sends answers left from a test that was never finished
    const focus = () => void syncFromCloud();
    window.addEventListener('focus', focus);
    const id = setInterval(() => {
      if (!document.hidden) void syncFromCloud(true);
    }, PULL_EVERY);
    return () => {
      window.removeEventListener('focus', focus);
      clearInterval(id);
    };
  }, [force]);
  return useSyncExternalStore(subscribeCloud, getCloudStatus, getCloudStatus);
}
