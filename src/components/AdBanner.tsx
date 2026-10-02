'use client';

import React from 'react';
import { AdsConfig } from '@/lib/types';

interface AdBannerProps {
  placement: keyof AdsConfig['pl'];
  adsConfig: AdsConfig;
}

export function AdBanner({ placement, adsConfig }: AdBannerProps) {
  if (!adsConfig.on || !adsConfig.pl[placement]) {
    return null;
  }

  // If custom ad code is provided, we can render it safely or display fallback
  return (
    <div className="my-4 p-3 rounded-xl border border-dashed border-[var(--line)] bg-[var(--card)] text-center text-xs text-[var(--mut)]">
      {adsConfig.code ? (
        <div
          dangerouslySetInnerHTML={{ __html: adsConfig.code }}
          className="min-h-[50px] flex items-center justify-center"
        />
      ) : (
        <div className="py-2">
          <span className="font-semibold text-[var(--pri)]">[{adsConfig.provider.toUpperCase()} AD]</span>{' '}
          Placement: {placement.replace('_', ' ')}
        </div>
      )}
    </div>
  );
}
