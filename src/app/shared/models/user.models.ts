export type AppRole = 'ADMIN'|'FACULTY'|'SITE'|'STUDENT'|'OFFICER';

export interface AppUserBase {
  id: string;
  name: string;
  email: string;
}

export interface AppUser extends AppUserBase {
  role?: AppRole;
  regNo?: string;
}
