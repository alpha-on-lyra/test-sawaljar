'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { initCloud, syncFromCloud, getCloudStatus, subscribeCloud } from '@/lib/cloud';

// Call once per page: pulls the latest data on open, when the tab is focused again, and every 5 minutes
export function useCloudSync() {
  useEffect(() => {
    initCloud();
    void syncFromCloud(true);
    const focus = () => void syncFromCloud();
    window.addEventListener('focus', focus);
    const id = setInterval(() => {
      if (!document.hidden) void syncFromCloud(true);
    }, 300000);
    return () => {
      window.removeEventListener('focus', focus);
      clearInterval(id);
    };
  }, []);
  return useSyncExternalStore(subscribeCloud, getCloudStatus, getCloudStatus);
}
