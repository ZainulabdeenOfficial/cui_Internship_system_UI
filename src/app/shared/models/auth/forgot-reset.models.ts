export interface ForgotPasswordRequest { email: string; }
export interface ForgotPasswordResponse { message: string; }

export interface ResetPasswordRequest { token: string; password: string; }
export interface ResetPasswordResponse { message: string; }

export interface SendVerificationEmailRequest { email: string; }
export interface SendVerificationEmailResponse { message: string; }
