import type React from 'react';

// Colour tokens shared by the landing page, student pages and admin (no fonts here, so it stays light)
const common = { '--acc': '#f2b01e', fontFamily: 'var(--font-body), system-ui, sans-serif', fontSize: '16px' };
export const theme = {
  ...common, colorScheme: 'light',
  '--bg': '#f0efe1', '--card': '#fbfaf3', '--ink': '#1a1a2e', '--mut': '#62617a', '--line': '#dcdac6', '--pri': '#2b2d8e', '--pri2': '#e3e3f6',
  '--t0': '#e3e3f6', '--t1': '#fbeccb', '--t2': '#dff0fa', '--t3': '#fadde5', '--ybg': '#fadde5', '--yfg': '#8a1f45', '--pbg': '#dff0fa', '--pfg': '#1b5a7a',
  '--ok': '#1f7a53', '--okbg': '#dcefe5', '--bad': '#b3261e', '--badbg': '#f8dcd8',
} as React.CSSProperties;
export const themeDark = {
  ...common, colorScheme: 'dark',
  '--bg': '#14141f', '--card': '#1d1d2d', '--ink': '#eeeef7', '--mut': '#a3a2b8', '--line': '#2e2e45', '--pri': '#8b8dff', '--pri2': '#26264a',
  '--t0': '#26264a', '--t1': '#3a3115', '--t2': '#15323f', '--t3': '#3d1f2b', '--ybg': '#3d1f2b', '--yfg': '#f5a3bd', '--pbg': '#15323f', '--pfg': '#8fd0f0',
  '--ok': '#6fd3a2', '--okbg': '#173528', '--bad': '#ff8a80', '--badbg': '#3d1c1a',
} as React.CSSProperties;
