import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { LoginRequest, UserDto } from '@physio-portal/contracts';
import { clearToken, getToken, setToken } from '../api/client';
import { login as loginRequest, me } from '../api/auth';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: UserDto | null;
  status: AuthStatus;
  login: (body: LoginRequest) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const hydrated = useRef(false);

  const hydrate = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setStatus('unauthenticated');
      return;
    }
    try {
      const fetched = await me();
      setUser(fetched);
      setStatus('authenticated');
    } catch {
      clearToken();
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    void hydrate();
  }, [hydrate]);

  const login = useCallback(async (body: LoginRequest) => {
    const { token, user: fresh } = await loginRequest(body);
    setToken(token);
    setUser(fresh);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout, refresh: hydrate }),
    [user, status, login, logout, hydrate],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}
