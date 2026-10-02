'use client';

/**
 * Anti-Cheat & Multi-Account Security Engine for SawalJar
 */

export interface DeviceFingerprint {
  hash: string;
  components: {
    screen: string;
    cores: number;
    tz: string;
    lang: string;
    platform: string;
  };
}

/**
 * Generate a client device fingerprint based on browser hardware attributes and canvas
 */
export function getDeviceFingerprint(): DeviceFingerprint {
  if (typeof window === 'undefined') {
    return {
      hash: 'server_dummy',
      components: { screen: '', cores: 0, tz: '', lang: '', platform: '' }
    };
  }

  const screenStr = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const cores = navigator.hardwareConcurrency || 2;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const lang = navigator.language || 'en';
  const platform = navigator.platform || 'unknown';

  // Canvas fingerprint component
  let canvasHash = 'cv0';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 30;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = "14px 'Plus Jakarta Sans', Arial";
      ctx.fillStyle = '#2f6f4f';
      ctx.fillRect(10, 5, 60, 20);
      ctx.fillStyle = '#fbfaf3';
      ctx.fillText('SawalJar_FP_Secure', 12, 8);
      const dataUrl = canvas.toDataURL();
      let h = 0;
      for (let i = 0; i < dataUrl.length; i++) {
        h = (Math.imul(31, h) + dataUrl.charCodeAt(i)) | 0;
      }
      canvasHash = 'cv_' + Math.abs(h).toString(36);
    }
  } catch {
    // fallback if canvas is restricted
  }

  const rawKey = `${screenStr}__${cores}__${tz}__${lang}__${platform}__${canvasHash}`;
  let finalHash = 0;
  for (let i = 0; i < rawKey.length; i++) {
    finalHash = (Math.imul(31, finalHash) + rawKey.charCodeAt(i)) | 0;
  }

  return {
    hash: 'fp_' + Math.abs(finalHash).toString(36),
    components: {
      screen: screenStr,
      cores,
      tz,
      lang,
      platform,
    }
  };
}

/**
 * Check and record device account usage to detect multiple accounts from same device
 */
export function trackDeviceAccount(userEmail: string): { isMultiAccount: boolean; previousAccounts: string[] } {
  if (typeof window === 'undefined' || !userEmail) {
    return { isMultiAccount: false, previousAccounts: [] };
  }

  const fp = getDeviceFingerprint();
  const storageKey = `sj_device_accs_${fp.hash}`;

  let knownAccounts: string[] = [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      knownAccounts = JSON.parse(raw);
    }
  } catch {
    knownAccounts = [];
  }

  const normalized = userEmail.toLowerCase().trim();
  if (!knownAccounts.includes(normalized)) {
    knownAccounts.push(normalized);
    try {
      localStorage.setItem(storageKey, JSON.stringify(knownAccounts));
    } catch {}
  }

  return {
    isMultiAccount: knownAccounts.length > 1,
    previousAccounts: knownAccounts
  };
}

export interface AntiCheatOptions {
  onWarning: (message: string, count: number) => void;
  onExceededLimit?: (count: number) => void;
  maxTabSwitches?: number;
  preventCopy?: boolean;
  detectDevTools?: boolean;
}

/**
 * Attach active anti-cheat listeners during a test session
 */
export function setupAntiCheat(options: AntiCheatOptions) {
  if (typeof window === 'undefined') return () => {};

  let tabSwitchCount = 0;
  const maxSwitches = options.maxTabSwitches ?? 3;

  const handleVisibilityChange = () => {
    if (document.hidden) {
      tabSwitchCount++;
      const remaining = Math.max(0, maxSwitches - tabSwitchCount);
      options.onWarning(
        `Tab switch detected (${tabSwitchCount}/${maxSwitches}). Please stay on the test screen!`,
        tabSwitchCount
      );
      if (tabSwitchCount >= maxSwitches && options.onExceededLimit) {
        options.onExceededLimit(tabSwitchCount);
      }
    }
  };

  const handleBlur = () => {
    // Window blur (e.g., clicking on another window or devtools)
    if (!document.hidden) {
      tabSwitchCount++;
      options.onWarning(
        `Window focus lost. Anti-cheat alert logged.`,
        tabSwitchCount
      );
    }
  };

  const handleCopy = (e: ClipboardEvent) => {
    if (options.preventCopy) {
      e.preventDefault();
      options.onWarning('Copying question content is disabled during exams.', tabSwitchCount);
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    if (options.preventCopy) {
      e.preventDefault();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Block Inspect Element shortcuts: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) ||
      (e.ctrlKey && (e.key === 'u' || e.key === 'U'))
    ) {
      e.preventDefault();
      options.onWarning('Developer tools shortcut disabled during active tests.', tabSwitchCount);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('blur', handleBlur);
  if (options.preventCopy) {
    document.addEventListener('copy', handleCopy);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
  }

  // Cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('blur', handleBlur);
    document.removeEventListener('copy', handleCopy);
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('keydown', handleKeyDown);
  };
}
