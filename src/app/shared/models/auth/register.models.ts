export interface StudentRegisterRequest {
  name: string;
  email: string;
  password: string;
  regNo: string;
}

export interface RegisterResponse {
  success: boolean;
  message?: string;
  token?: string;
}