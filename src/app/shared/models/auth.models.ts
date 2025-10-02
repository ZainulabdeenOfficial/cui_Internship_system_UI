export interface StudentRegisterRequest {
  name: string;
  email: string;
  password: string;
 // role: 'student';
  regNo: string; // registration number
}

export interface RegisterResponse {
  success: boolean;
  message?: string;
  token?: string; // if backend returns a JWT or similar
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: any;
}
