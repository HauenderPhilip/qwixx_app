import { Platform } from 'react-native';

/**
 * Browser erlauben Vollbild nur nach einer Berührung. Deshalb schaltet die Web-Version beim
 * ersten Antippen in den Vollbildmodus und dreht ins Querformat (Android). Auf dem iPhone gibt es
 * diese Schnittstelle nicht – dort hilft „Zum Home-Bildschirm“ (siehe manifest.json).
 */

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function isTouchDevice(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

function isInstalledApp(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return (
    standalone === true ||
    (window.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches ?? false)
  );
}

function canRequestFullscreen(): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  const el = document.documentElement as FullscreenElement;
  return Boolean(el.requestFullscreen || el.webkitRequestFullscreen);
}

/** Ob ein Tippen den Vollbildmodus (und damit das Querformat) auslösen kann. */
export function fullscreenAvailable(): boolean {
  return canRequestFullscreen() && isTouchDevice() && !isInstalledApp();
}

export async function enterFullscreen(): Promise<void> {
  if (!canRequestFullscreen() || document.fullscreenElement) return;
  const el = document.documentElement as FullscreenElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else await el.webkitRequestFullscreen?.();
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    await orientation?.lock?.('landscape');
  } catch {
    // Abgelehnt oder nicht unterstützt – dann eben ohne Vollbild.
  }
}

/** Beim ersten Antippen der Seite in den Vollbildmodus wechseln (nur Handys/Tablets im Browser). */
export function enterFullscreenOnFirstTap(): () => void {
  if (!fullscreenAvailable()) return () => {};
  const handler = () => {
    enterFullscreen();
  };
  document.addEventListener('click', handler, { once: true, capture: true });
  return () => document.removeEventListener('click', handler, { capture: true });
}
