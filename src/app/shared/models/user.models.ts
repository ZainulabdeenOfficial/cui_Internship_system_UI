export type AppRole = 'ADMIN'|'FACULTY'|'SITE'|'STUDENT';

export interface AppUserBase {
  id: string;
  name: string;
  email: string;
}

export interface AppUser extends AppUserBase {
  role?: AppRole;
  regNo?: string;
}
