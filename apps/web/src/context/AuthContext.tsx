import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  updateProfile,
  reload,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, googleProvider, functions } from '@/lib/firebase';
import {
  getAuthErrorMessage,
  googleSignInBlockedReason,
  shouldUseGoogleRedirect,
} from '@/lib/authErrors';
import type { UserProfile, UserPreferences } from '@/types';

const defaultPreferences: UserPreferences = {
  hindiOutputMode: 'hindi_script',
  defaultLanguage: 'mixed',
  storyPerspective: 'first',
};

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  googleRedirectError: string | null;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  clearGoogleRedirectError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function resolveDisplayName(user: User, override?: string): Promise<string> {
  const trimmed = override?.trim() || user.displayName?.trim() || '';
  if (trimmed) return trimmed;
  return user.email?.split('@')[0] ?? '';
}

async function syncServerUserProfile(): Promise<void> {
  try {
    const sync = httpsCallable(functions, 'syncMyUserProfile');
    await sync();
  } catch (err) {
    console.warn('Server profile sync failed:', err);
  }
}

async function ensureUserProfile(user: User, displayNameOverride?: string): Promise<UserProfile> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  const displayName = await resolveDisplayName(user, displayNameOverride);

  if (snap.exists()) {
    const data = snap.data();
    const existingName = (data.displayName as string | undefined)?.trim() ?? '';
    const resolvedName = existingName || displayName;

    if (!existingName && resolvedName) {
      await setDoc(
        ref,
        { displayName: resolvedName, updatedAt: serverTimestamp() },
        { merge: true },
      );
    }

    return {
      uid: user.uid,
      email: data.email ?? user.email ?? '',
      displayName: resolvedName,
      photoURL: data.photoURL ?? user.photoURL ?? undefined,
      role: data.role ?? 'storyteller',
      preferences: data.preferences ?? defaultPreferences,
      stimulusProgress: data.stimulusProgress ?? { completedStimulusIds: [], currentIndex: 0 },
      bookId: data.bookId as string | undefined,
      createdAt: data.createdAt?.toDate() ?? new Date(),
      updatedAt: data.updatedAt?.toDate() ?? new Date(),
    };
  }

  const profile: Record<string, unknown> = {
    uid: user.uid,
    email: user.email ?? '',
    displayName,
    role: 'storyteller',
    preferences: defaultPreferences,
    stimulusProgress: { completedStimulusIds: [], currentIndex: 0 },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (user.photoURL) {
    profile.photoURL = user.photoURL;
  }

  await setDoc(ref, profile);

  return {
    uid: user.uid,
    email: user.email ?? '',
    displayName,
    photoURL: user.photoURL ?? undefined,
    role: 'storyteller' as const,
    preferences: defaultPreferences,
    stimulusProgress: { completedStimulusIds: [], currentIndex: 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleRedirectError, setGoogleRedirectError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user && mounted) {
          await ensureUserProfile(result.user);
        }
      } catch (err) {
        console.error('Google redirect sign-in failed:', err);
        if (mounted) {
          setGoogleRedirectError(getAuthErrorMessage(err));
        }
      }

      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!mounted) return;
        setUser(firebaseUser);
        if (firebaseUser) {
          try {
            await syncServerUserProfile();
            const userProfile = await ensureUserProfile(firebaseUser);
            setProfile(userProfile);
          } catch (err) {
            console.error('Failed to ensure user profile:', err);
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      });

      return unsubscribe;
    }

    const unsubscribePromise = initAuth();

    return () => {
      mounted = false;
      unsubscribePromise.then((unsubscribe) => unsubscribe?.());
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserProfile(cred.user);
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name.trim() });
    await reload(cred.user);
    await ensureUserProfile(cred.user, name.trim());
  };

  const signInWithGoogle = async () => {
    setGoogleRedirectError(null);

    const blocked = googleSignInBlockedReason();
    if (blocked) {
      throw new Error(blocked);
    }

    if (shouldUseGoogleRedirect()) {
      await signInWithRedirect(auth, googleProvider);
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (
        code === 'auth/popup-blocked'
        || code === 'auth/popup-closed-by-user'
        || code === 'auth/cancelled-popup-request'
      ) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      throw err;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const updatePreferences = async (prefs: Partial<UserPreferences>) => {
    if (!user || !profile) return;
    const updated = { ...profile.preferences, ...prefs };
    await setDoc(
      doc(db, 'users', user.uid),
      { preferences: updated, updatedAt: serverTimestamp() },
      { merge: true },
    );
    setProfile({ ...profile, preferences: updated });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        googleRedirectError,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        updatePreferences,
        clearGoogleRedirectError: () => setGoogleRedirectError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
