import type { FirebaseError } from 'firebase/app';

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message && !(error as FirebaseError).code) {
    return error.message;
  }
  const code = (error as FirebaseError)?.code ?? '';

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled yet. Enable Google in Firebase Console → Authentication → Sign-in method.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains.';
    case 'auth/popup-blocked':
      return 'Pop-up was blocked. Trying redirect sign-in…';
    case 'auth/popup-closed-by-user':
      return 'Sign-in cancelled.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in cancelled.';
    case 'auth/redirect-cancelled-by-user':
      return 'Sign-in cancelled.';
    case 'auth/web-storage-unsupported':
      return 'This browser blocks sign-in storage. Turn off Private Browsing or open in Safari and try again.';
    case 'auth/redirect-operation-pending':
      return 'Sign-in already in progress. Please wait…';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';
    default:
      return code ? `Sign-in failed (${code}). Please try again.` : 'Google sign-in failed. Please try again.';
  }
}

/** iPadOS 13+ often reports as Mac — detect via touch points. */
export function isIosDevice(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPhone|iPad|iPod/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isStandalonePwa(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** In-app browsers (Instagram, Facebook, etc.) block OAuth redirects. */
export function isInAppBrowser(): boolean {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp/i.test(ua);
}

export function shouldUseGoogleRedirect(): boolean {
  const ua = navigator.userAgent;
  const isMobile = /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isSmallTouchScreen = 'ontouchstart' in window && window.innerWidth < 768;
  return isIosDevice() || isMobile || isSmallTouchScreen || isStandalonePwa();
}

export function googleSignInBlockedReason(): string | null {
  if (isInAppBrowser()) {
    return 'Google sign-in does not work inside this app’s browser. Tap ⋯ and choose “Open in Safari” (or Chrome), then try again.';
  }
  return null;
}
