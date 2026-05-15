import { eq, desc, and, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users, trades, ocoConfigs, dailyPerformance, InsertTrade, Trade, OcoConfig, InsertOcoConfig, DailyPerformance } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ---- TRADES ----
export async function getTrades(userId: number, limit = 50, offset = 0): Promise<Trade[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trades)
    .where(eq(trades.userId, userId))
    .orderBy(desc(trades.entryAt))
    .limit(limit)
    .offset(offset);
}

export async function insertTrade(trade: InsertTrade): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(trades).values(trade);
  const id = safeInsertId(result);
  return { id: isNaN(id) ? 0 : id };
}

export async function updateTrade(id: number, userId: number, data: Partial<Trade>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(trades).set(data).where(and(eq(trades.id, id), eq(trades.userId, userId)));
}

export async function getTradesByDateRange(userId: number, startDate: string, endDate: string): Promise<Trade[]> {
  const db = await getDb();
  if (!db) return [];
  const start = new Date(startDate);
  const end = new Date(endDate + "T23:59:59");
  return db.select().from(trades)
    .where(and(eq(trades.userId, userId), gte(trades.entryAt, start), lte(trades.entryAt, end)))
    .orderBy(desc(trades.entryAt));
}

// ---- OCO CONFIG ----
export async function getOcoConfig(userId: number): Promise<OcoConfig | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(ocoConfigs)
    .where(and(eq(ocoConfigs.userId, userId), eq(ocoConfigs.isActive, true)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertOcoConfig(userId: number, config: Omit<InsertOcoConfig, 'userId'>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getOcoConfig(userId);
  if (existing) {
    await db.update(ocoConfigs).set({ ...config, updatedAt: new Date() }).where(and(eq(ocoConfigs.userId, userId), eq(ocoConfigs.isActive, true)));
  } else {
    await db.insert(ocoConfigs).values({ ...config, userId });
  }
}

// ---- DAILY PERFORMANCE ----
export async function getDailyPerformance(userId: number, days = 30): Promise<DailyPerformance[]> {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return db.select().from(dailyPerformance)
    .where(and(eq(dailyPerformance.userId, userId), gte(dailyPerformance.date, cutoffStr)))
    .orderBy(desc(dailyPerformance.date));
}

export async function upsertDailyPerformance(userId: number, date: string, data: Partial<DailyPerformance>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(dailyPerformance).values({ userId, date, ...data } as DailyPerformance)
    .onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
}

// ---- PREDICTIONS ----
import {
  predictions, InsertPrediction, Prediction,
  userSettings, InsertUserSettings, UserSettings,
  interCredentials, InsertInterCredentials, InterCredentials,
  educationalContent, EducationalContent,
} from "../drizzle/schema";

export async function getPredictions(userId: number, limit = 10): Promise<Prediction[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(predictions)
    .where(eq(predictions.userId, userId))
    .orderBy(desc(predictions.createdAt))
    .limit(limit);
}

/** Converte insertId (bigint | number | string | undefined) para number seguro, ou NaN. */
export function safeInsertId(result: unknown): number {
  const raw = (result as any)?.insertId ?? (result as any)?.[0]?.insertId;
  if (raw === undefined || raw === null) return NaN;
  const n = typeof raw === "bigint" ? Number(raw) : Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

export async function insertPrediction(data: InsertPrediction): Promise<Prediction> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(predictions).values(data);

  const id = safeInsertId(result);
  if (!isNaN(id) && id > 0) {
    const rows = await db.select().from(predictions).where(eq(predictions.id, id)).limit(1);
    if (rows[0]) return rows[0];
  }

  // Fallback: driver não retornou insertId utilizável (TiDB/alguns MySQL).
  // Busca a predição mais recente do usuário (acabamos de inserir).
  const fallback = await db
    .select()
    .from(predictions)
    .where(eq(predictions.userId, data.userId))
    .orderBy(desc(predictions.createdAt))
    .limit(1);
  if (!fallback[0]) throw new Error("Falha ao recuperar predição após insert");
  return fallback[0];
}

export async function updatePredictionStatus(
  id: number,
  userId: number,
  status: "executed" | "ignored" | "won" | "lost" | "expired"
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(predictions)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(predictions.id, id), eq(predictions.userId, userId)));
}

// ---- USER SETTINGS ----
export async function getUserSettings(userId: number): Promise<UserSettings | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return result.length > 0 ? result[0]! : null;
}

export async function upsertUserSettings(userId: number, data: Partial<InsertUserSettings>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(userSettings)
    .values({ userId, ...data } as InsertUserSettings)
    .onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
}

// ---- INTER CREDENTIALS ----
export async function getInterCredentials(userId: number): Promise<InterCredentials | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(interCredentials).where(eq(interCredentials.userId, userId)).limit(1);
  return result.length > 0 ? result[0]! : null;
}

export async function upsertInterCredentials(userId: number, data: Partial<InsertInterCredentials>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(interCredentials)
    .values({ userId, ...data } as InsertInterCredentials)
    .onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
}

// ---- EDUCATIONAL CONTENT ----
export async function getEducationalContent(topic: string): Promise<EducationalContent | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(educationalContent).where(eq(educationalContent.topic, topic)).limit(1);
  return rows.length > 0 ? rows[0]! : null;
}

export async function upsertEducationalContent(topic: string, content: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(educationalContent)
    .values({ topic, content })
    .onDuplicateKeyUpdate({ set: { content, updatedAt: new Date() } });
}
