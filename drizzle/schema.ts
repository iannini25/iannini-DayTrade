import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }), // bcrypt hash — null para usuários legados
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Tabela de operações registradas
export const trades = mysqlTable("trades", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull().default("WIN"),
  side: mysqlEnum("side", ["buy", "sell"]).notNull(),
  contracts: int("contracts").notNull(),
  entryPrice: decimal("entryPrice", { precision: 10, scale: 2 }).notNull(),
  exitPrice: decimal("exitPrice", { precision: 10, scale: 2 }),
  stopLoss: decimal("stopLoss", { precision: 10, scale: 2 }),
  takeProfit: decimal("takeProfit", { precision: 10, scale: 2 }),
  pnl: decimal("pnl", { precision: 10, scale: 2 }),
  pnlPoints: decimal("pnlPoints", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", ["open", "closed", "stopped", "target"]).default("open").notNull(),
  notes: text("notes"),
  entryAt: timestamp("entryAt").defaultNow().notNull(),
  exitAt: timestamp("exitAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;

// Configurações OCO salvas
export const ocoConfigs = mysqlTable("oco_configs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  stopLossPoints: int("stopLossPoints").notNull().default(150),
  takeProfitPoints: int("takeProfitPoints").notNull().default(250),
  breakevenTriggerPoints: int("breakevenTriggerPoints").notNull().default(100),
  trailingStopPoints: int("trailingStopPoints").notNull().default(50),
  trailingStopTriggerPoints: int("trailingStopTriggerPoints").notNull().default(150),
  defaultContracts: int("defaultContracts").notNull().default(5),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OcoConfig = typeof ocoConfigs.$inferSelect;
export type InsertOcoConfig = typeof ocoConfigs.$inferInsert;

// Performance diária
export const dailyPerformance = mysqlTable("daily_performance", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  totalPnl: decimal("totalPnl", { precision: 10, scale: 2 }).default("0").notNull(),
  totalPnlPoints: decimal("totalPnlPoints", { precision: 10, scale: 2 }).default("0").notNull(),
  tradesCount: int("tradesCount").default(0).notNull(),
  winsCount: int("winsCount").default(0).notNull(),
  lossesCount: int("lossesCount").default(0).notNull(),
  maxDrawdown: decimal("maxDrawdown", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyPerformance = typeof dailyPerformance.$inferSelect;
export type InsertDailyPerformance = typeof dailyPerformance.$inferInsert;

// ─── NOVAS TABELAS ────────────────────────────────────────────────────────────

// Predições / Análises da IA por usuário
export const predictions = mysqlTable("predictions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull().default("WIN"),
  signalType: mysqlEnum("signalType", ["buy", "sell", "neutral", "avoid"]).notNull(),
  confidence: int("confidence").notNull().default(50), // 0-100
  entryZoneLow: decimal("entryZoneLow", { precision: 10, scale: 2 }),
  entryZoneHigh: decimal("entryZoneHigh", { precision: 10, scale: 2 }),
  stopLoss: decimal("stopLoss", { precision: 10, scale: 2 }),
  takeProfit: decimal("takeProfit", { precision: 10, scale: 2 }),
  reasoning: text("reasoning"),          // Análise textual da IA
  marketContext: text("marketContext"),   // Contexto de mercado (índices, notícias)
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high"]).notNull().default("medium"),
  status: mysqlEnum("status", ["pending", "executed", "ignored", "won", "lost", "expired"]).notNull().default("pending"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Prediction = typeof predictions.$inferSelect;
export type InsertPrediction = typeof predictions.$inferInsert;

// Configurações de perfil por usuário
export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  preferredContracts: int("preferredContracts").notNull().default(5),
  riskProfile: mysqlEnum("riskProfile", ["conservative", "moderate", "aggressive"]).notNull().default("moderate"),
  dailyGoal: decimal("dailyGoal", { precision: 10, scale: 2 }).notNull().default("2000"),
  dailyLimit: decimal("dailyLimit", { precision: 10, scale: 2 }).notNull().default("1000"),
  stopLossPoints: int("stopLossPoints").notNull().default(150),
  takeProfitPoints: int("takeProfitPoints").notNull().default(250),
  enableAiPredictions: boolean("enableAiPredictions").default(true).notNull(),
  enableSoundAlerts: boolean("enableSoundAlerts").default(true).notNull(),
  enableAutoBreakeven: boolean("enableAutoBreakeven").default(true).notNull(),
  pauseAfterLosses: int("pauseAfterLosses").notNull().default(3),
  timezone: varchar("timezone", { length: 50 }).notNull().default("America/Sao_Paulo"),
  // ── Proteções operacionais ────────────────────────────────
  tradingPaused: boolean("tradingPaused").default(false).notNull(),
  enableLiveTrading: boolean("enableLiveTrading").default(false).notNull(),
  requireOrderConfirmation: boolean("requireOrderConfirmation").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

// Credenciais do Banco Inter por usuário (armazenadas de forma segura)
export const interCredentials = mysqlTable("inter_credentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  clientId: varchar("clientId", { length: 255 }),
  clientSecretHash: varchar("clientSecretHash", { length: 255 }), // hashed
  certFingerprint: varchar("certFingerprint", { length: 255 }),   // fingerprint do cert mTLS
  accountNumber: varchar("accountNumber", { length: 50 }),
  environment: mysqlEnum("environment", ["sandbox", "production"]).notNull().default("sandbox"),
  status: mysqlEnum("status", ["not_configured", "pending", "active", "error"]).notNull().default("not_configured"),
  lastTestedAt: timestamp("lastTestedAt"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InterCredentials = typeof interCredentials.$inferSelect;
export type InsertInterCredentials = typeof interCredentials.$inferInsert;

// Conteúdo educacional gerado pelo LLM e cacheado (1x por tópico)
export const educationalContent = mysqlTable("educational_content", {
  id: int("id").autoincrement().primaryKey(),
  topic: varchar("topic", { length: 100 }).notNull().unique(),
  content: text("content").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EducationalContent = typeof educationalContent.$inferSelect;
export type InsertEducationalContent = typeof educationalContent.$inferInsert;
