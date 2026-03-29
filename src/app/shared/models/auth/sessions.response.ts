export interface UserSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
  tokenPreview: string;
}

export interface SessionsResponse {
  sessions: UserSession[];
  totalActive: number;
}
