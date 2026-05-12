import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { parseSessionUser } from "../auth";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const session = await parseSessionUser(opts.req);
    if (session) {
      const db = await getDb();
      if (db) {
        const result = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
        user = result[0] ?? null;
      }
    }
  } catch {
    user = null;
  }

  return { req: opts.req, res: opts.res, user };
}
