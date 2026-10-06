'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/supabase';

export type AuthUser = { id?: string; email?: string; role?: string; status?: string; user_metadata?: { full_name?: string; name?: string } };

// undefined = still loading, null = signed out
export function useUser() {
  const [u, setU] = useState<AuthUser | null | undefined>(undefined);
  useEffect(() => {
    let on = true;
    const load = () =>
      getCurrentUser()
        .then((x) => on && setU((x as unknown as AuthUser) || null))
        .catch(() => on && setU(null));
    void load();
    window.addEventListener('sj_cloud_pulled', load); // a ban or role change shows up without a new sign-in
    return () => {
      on = false;
      window.removeEventListener('sj_cloud_pulled', load);
    };
  }, []);
  return u;
}

export const displayName = (u: AuthUser | null | undefined) => u?.user_metadata?.full_name || u?.user_metadata?.name || u?.email?.split('@')[0] || 'Student';
