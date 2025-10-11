import { AppRole, AppUser } from '../user.models';

export interface CreateAccountRequest {
  email: string;
  name: string;
  password: string;
  role: AppRole;
}

export interface CreateAccountResponse {
  message: string;
  user: AppUser & { role: string };
  password: string;
  createdBy: string;
}
