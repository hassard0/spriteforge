import { createContext, useContext, ReactNode } from 'react';

/**
 * Auth has been stubbed out. The app now stores data entirely in localStorage
 * via `@/lib/sprite-store`, so every user is effectively the same local
 * "guest" identity. The original context signature is preserved so existing
 * call sites continue to compile without edits.
 */

export interface GuestUser {
  id: string;
  email: string;
}

interface AuthContextType {
  session: null;
  user: GuestUser;
  loading: boolean;
  signIn: (email?: string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const GUEST_USER: GuestUser = { id: 'guest', email: 'guest@local' };

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: GUEST_USER,
  loading: false,
  signIn: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const value: AuthContextType = {
    session: null,
    user: GUEST_USER,
    loading: false,
    signIn: async () => {},
    signOut: async () => {},
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
