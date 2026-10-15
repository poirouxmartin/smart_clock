import { useState, useEffect, useCallback } from 'react';
import { getAuthService, AuthService } from './AuthService';
import { User, AuthState } from './types';

export function useAuth() {
  const [service] = useState<AuthService>(() => getAuthService());
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await service.initialize();
        if (mounted) {
          setState({
            user: service.getCurrentUser(),
            isAuthenticated: service.isAuthenticated(),
            isLoading: false,
          });
        }
      } catch (e) {
        console.error('Auth initialization failed:', e);
        if (mounted) {
          setState({ user: null, isAuthenticated: false, isLoading: false });
        }
      }
    };

    init();

    return () => { mounted = false; };
  }, [service]);

  const login = useCallback(async (email: string, password: string) => {
    const user = await service.login(email, password);
    setState({ user, isAuthenticated: true, isLoading: false });
    return user;
  }, [service]);

  const signup = useCallback(async (email: string, name: string, password: string) => {
    const user = await service.signup(email, name, password);
    setState({ user, isAuthenticated: true, isLoading: false });
    return user;
  }, [service]);

  const logout = useCallback(async () => {
    await service.logout();
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, [service]);

  return {
    ...state,
    login,
    signup,
    logout,
  };
}
