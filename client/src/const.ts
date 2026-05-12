export { COOKIE_NAME, THIRTY_DAYS_MS } from "@shared/const";

/** Rota de login local — sem dependência de OAuth externo */
export function getLoginUrl(returnPath?: string): string {
  const base = "/login";
  if (returnPath) return `${base}?return=${encodeURIComponent(returnPath)}`;
  return base;
}
