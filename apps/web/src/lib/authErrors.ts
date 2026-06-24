import type { FirebaseError } from 'firebase/app';

export function getAuthErrorMessage(error: unknown): string {
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
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';
    default:
      return code ? `Sign-in failed (${code}). Please try again.` : 'Google sign-in failed. Please try again.';
  }
}

export function shouldUseGoogleRedirect(): boolean {
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isSmallTouchScreen = 'ontouchstart' in window && window.innerWidth < 768;
  return isMobile || isSmallTouchScreen;
}
