import type { AuthCredentials, SignupData, AuthResult, AuthUser } from './types';
import { getDatabaseService } from '@/modules/user-profile/DatabaseService';

let instance: AuthService | null = null;

export class AuthService {
  private user: AuthUser | null = null;

  static getInstance(): AuthService {
    if (!instance) {
      instance = new AuthService();
    }
    return instance;
  }

  async restoreSession(): Promise<AuthUser | null> {
    try {
      const db = getDatabaseService();
      const result = await db.getAuthUser();
      if (result) {
        this.user = result;
        return result;
      }
    } catch (e) {
      // DB may not be ready yet
    }
    return null;
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const credentials: AuthCredentials = { email, password };
    
    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required');
    }

    const db = getDatabaseService();
    const user = await db.authenticateUser(credentials.email, credentials.password);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    this.user = user;

    return { user, token: `token_${user.id}` };
  }

  async signup(email: string, name: string, password: string): Promise<AuthResult> {
    const data: SignupData = { email, name, password };

    if (!data.email || !data.name || !data.password) {
      throw new Error('All fields are required');
    }

    const db = getDatabaseService();
    const existing = await db.getAuthUserByEmail(data.email);
    if (existing) {
      throw new Error('Email already in use');
    }

    const user = await db.createAuthUser(data.email, data.name, data.password);
    this.user = user;

    return { user, token: `token_${user.id}` };
  }

  async logout(): Promise<void> {
    this.user = null;
  }

  getUser(): AuthUser | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return this.user !== null;
  }
}

export function getAuthService(): AuthService {
  return AuthService.getInstance();
}
