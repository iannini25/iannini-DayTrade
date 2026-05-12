/**
 * auth.ts — Sistema de autenticação próprio (sem dependência Manus)
 * Usa bcryptjs para hash de senha + JWT (jose) para sessões
 */
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { COOKIE_NAME, THIRTY_DAYS_MS, isAuthorizedEmail } from "@shared/const";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { getSessionCookieOptions } from "./lib/cookies";

const SALT_ROUNDS = 12;

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

// ─── Hash / Verify password ───────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT Session ──────────────────────────────────────────────────────────────
export async function createSessionToken(userId: number, email: string, name: string): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ userId, email, name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<{ userId: number; email: string; name: string } | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const { userId, email, name } = payload as Record<string, unknown>;
    if (typeof userId !== "number" || typeof email !== "string" || typeof name !== "string") return null;
    return { userId, email, name };
  } catch {
    return null;
  }
}

// ─── Middleware: parse session from cookie ────────────────────────────────────
export async function parseSessionUser(req: Request): Promise<{ id: number; email: string; name: string; role: "user" | "admin" } | null> {
  const rawCookies = req.headers.cookie ?? "";
  const cookies = Object.fromEntries(
    rawCookies.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k?.trim() ?? "", decodeURIComponent(v.join("="))];
    })
  );
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  // Verify user still exists in DB and email is still authorized
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  const user = result[0];
  if (!user) return null;
  if (!isAuthorizedEmail(user.email)) return null;

  return { id: user.id, email: user.email ?? "", name: user.name ?? "", role: user.role };
}

// ─── Register auth routes ─────────────────────────────────────────────────────
import type { Express } from "express";
import { rateLimit } from "./lib/rateLimit";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Muitas tentativas de login. Aguarde 15 minutos e tente novamente.",
});

export function registerAuthRoutes(app: Express) {
  // POST /api/auth/login — email + password
  app.post("/api/auth/login", loginLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        res.status(400).json({ error: "E-mail e senha são obrigatórios" });
        return;
      }

      // Check whitelist first
      if (!isAuthorizedEmail(email)) {
        res.status(403).json({ error: "Acesso não autorizado para este e-mail" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "Banco de dados indisponível" });
        return;
      }

      const result = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
      const user = result[0];

      if (!user || !user.passwordHash) {
        res.status(401).json({ error: "Credenciais inválidas" });
        return;
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Credenciais inválidas" });
        return;
      }

      // Update lastSignedIn
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      const token = await createSessionToken(user.id, user.email ?? "", user.name ?? "");
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: THIRTY_DAYS_MS });
      res.json({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (err) {
      console.error("[Auth] Login error:", err);
      res.status(500).json({ error: "Erro interno no servidor" });
    }
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ success: true });
  });

  // POST /api/auth/setup — cria usuário inicial (apenas se não existir nenhum)
  app.post("/api/auth/setup", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body as { email?: string; password?: string; name?: string };
      if (!email || !password || !name) {
        res.status(400).json({ error: "email, password e name são obrigatórios" });
        return;
      }
      if (!isAuthorizedEmail(email)) {
        res.status(403).json({ error: "E-mail não está na lista de acesso autorizado" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "Banco de dados indisponível" });
        return;
      }

      // Check if user already exists
      const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
      if (existing.length > 0) {
        res.status(409).json({ error: "Usuário já cadastrado" });
        return;
      }

      const hash = await hashPassword(password);
      await db.insert(users).values({
        openId: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        email: email.toLowerCase().trim(),
        name,
        passwordHash: hash,
        loginMethod: "local",
        role: "admin",
        lastSignedIn: new Date(),
      });

      res.json({ success: true, message: "Usuário criado com sucesso" });
    } catch (err) {
      console.error("[Auth] Setup error:", err);
      res.status(500).json({ error: "Erro interno no servidor" });
    }
  });

  // POST /api/auth/change-password
  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    try {
      const rawCookies = req.headers.cookie ?? "";
      const cookies = Object.fromEntries(
        rawCookies.split(";").map((c) => {
          const [k, ...v] = c.trim().split("=");
          return [k?.trim() ?? "", decodeURIComponent(v.join("="))];
        })
      );
      const token = cookies[COOKIE_NAME];
      const session = await verifySessionToken(token);
      if (!session) {
        res.status(401).json({ error: "Não autenticado" });
        return;
      }

      const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
      if (!currentPassword || !newPassword || newPassword.length < 8) {
        res.status(400).json({ error: "Senha atual e nova senha (mín. 8 chars) são obrigatórias" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "Banco de dados indisponível" });
        return;
      }

      const result = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
      const user = result[0];
      if (!user || !user.passwordHash) {
        res.status(404).json({ error: "Usuário não encontrado" });
        return;
      }

      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Senha atual incorreta" });
        return;
      }

      const newHash = await hashPassword(newPassword);
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
      res.json({ success: true });
    } catch (err) {
      console.error("[Auth] Change password error:", err);
      res.status(500).json({ error: "Erro interno no servidor" });
    }
  });
}
