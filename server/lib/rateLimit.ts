import type { Request, Response, NextFunction } from "express";

type Hit = { count: number; resetAt: number };

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  message?: string;
};

/**
 * Lightweight in-memory IP rate limiter. Single-process only — fine for our PM2
 * setup (1 instance) and for the very low traffic on a private day-trade tool.
 * For a multi-instance setup, swap for a Redis-backed limiter.
 */
export function rateLimit(opts: RateLimitOptions) {
  const { windowMs, max, message = "Too many requests, please slow down." } = opts;
  const hits = new Map<string, Hit>();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();

    const current = hits.get(ip);
    if (!current || current.resetAt < now) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({ error: message, retryAfter });
      return;
    }
    next();
  };
}

/**
 * Check-only variant for use inside tRPC procedures (no Express middleware).
 * Returns true if request is allowed, false if rate limit exceeded.
 */
export function makeProcedureLimiter(opts: RateLimitOptions) {
  const { windowMs, max } = opts;
  const hits = new Map<string, Hit>();

  return function check(ip: string): { allowed: boolean; retryAfter: number } {
    const now = Date.now();
    const current = hits.get(ip);
    if (!current || current.resetAt < now) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfter: 0 };
    }
    current.count += 1;
    if (current.count > max) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
    }
    return { allowed: true, retryAfter: 0 };
  };
}
