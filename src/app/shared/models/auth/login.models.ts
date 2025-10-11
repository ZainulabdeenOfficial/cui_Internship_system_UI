export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
  accessToken?: string; 
  refreshToken?: string;
  user?: any;
  role?: string; 
}