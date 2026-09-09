import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { BookProvider } from '@/context/BookContext';
import { UiLocaleProvider } from '@/context/UiLocaleContext';
import App from '@/App';
import '@/index.css';

const tree = (
  <BrowserRouter>
    <UiLocaleProvider>
      <AuthProvider>
        <BookProvider>
          <App />
        </BookProvider>
      </AuthProvider>
    </UiLocaleProvider>
  </BrowserRouter>
);

// StrictMode double-invokes effects in development, which double-subscribes the
// Firestore onSnapshot listeners. Against the Firebase Emulator Suite this trips
// a Firestore SDK assertion ("INTERNAL ASSERTION FAILED: Unexpected state") that
// wedges the client. Skip StrictMode only in that local-emulator mode; keep it
// everywhere else (it is a no-op in production builds).
const withStrictMode: ReactNode =
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' ? tree : <StrictMode>{tree}</StrictMode>;

createRoot(document.getElementById('root')!).render(withStrictMode);
