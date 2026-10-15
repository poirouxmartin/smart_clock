import { useState, useEffect, useCallback } from 'react';
import { getAuthService } from './AuthService';
import type { AuthUser } from './types';

/**
 * Hook d'état d'authentification, aligné sur l'API réelle de AuthService.
 * Non utilisé par l'app pour l'instant (routage sans porte de connexion).
 */
export function useAuth() {
  const [service] = useState(() => getAuthService());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const restored = await service.restoreSession();
        if (mounted) setUser(restored);
      } catch (e) {
        console.error('Auth initialization failed:', e);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    init();

    return () => { mounted = false; };
  }, [service]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await service.login(email, password);
    setUser(result.user);
    return result.user;
  }, [service]);

  const signup = useCallback(async (email: string, name: string, password: string) => {
    const result = await service.signup(email, name, password);
    setUser(result.user);
    return result.user;
  }, [service]);

  const logout = useCallback(async () => {
    await service.logout();
    setUser(null);
  }, [service]);

  return {
    user,
    isAuthenticated: service.isAuthenticated(),
    isLoading,
    login,
    signup,
    logout,
  };
}
