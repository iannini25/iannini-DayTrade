export const COOKIE_NAME = "app_session_id";
export const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = "Please login (10001)";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// Whitelist de e-mails autorizados para acesso à plataforma
export const AUTHORIZED_EMAILS = [
  "tulio.iannini@gmail.com",
  "lucaszbr@gmail.com",
  "bernardo.iannini14@gmail.com",
] as const;

export type AuthorizedEmail = (typeof AUTHORIZED_EMAILS)[number];

export function isAuthorizedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return AUTHORIZED_EMAILS.includes(email.toLowerCase().trim() as AuthorizedEmail);
}
