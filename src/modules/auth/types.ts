export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SignupData extends AuthCredentials {
  name: string;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}
