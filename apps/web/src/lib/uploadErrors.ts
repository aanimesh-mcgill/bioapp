import type { FirebaseError } from 'firebase/app';

export function getUploadErrorMessage(error: unknown): string {
  const code = (error as FirebaseError)?.code ?? '';
  const message = (error as FirebaseError)?.message ?? '';

  switch (code) {
    case 'storage/unauthorized':
    case 'permission-denied':
      return 'Permission denied. Storage rules may not be deployed yet — try again in a moment.';
    case 'storage/unauthenticated':
      return 'You must be signed in to upload. Please sign in and try again.';
    case 'storage/canceled':
      return 'Upload was cancelled.';
    case 'storage/quota-exceeded':
      return 'Storage quota exceeded.';
    case 'storage/retry-limit-exceeded':
      return 'Upload timed out. Check your connection and try again.';
    default:
      if (message.includes('PERMISSION_DENIED') || message.includes('Missing or insufficient permissions')) {
        return 'Permission denied. Make sure you are signed in and try again.';
      }
      return code ? `Upload failed (${code}). Please try again.` : 'Upload failed. Please try again.';
  }
}
