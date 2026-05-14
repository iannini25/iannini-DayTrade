/**
 * predictionStats.ts — Estatísticas dos últimos 30 dias de predições para
 * alimentar o LLM com contexto de "aprendizado" (memória do usuário).
 */

import { and, desc, eq, gte } from "drizzle-orm";
import { predictions, type Prediction } from "../../drizzle/schema";
import { getDb } from "../db";

export type PredictionStats = {
  total: number;
  bySignal: Record<"buy" | "sell" | "neutral" | "avoid", { count: number; won: number; lost: number; winRate: number }>;
  byTimeOfDay: { morning: { count: number; won: number; winRate: number }; afternoon: { count: number; won: number; winRate: number } };
  overallWinRate: number;
  totalDecided: number; // won + lost (ignora pending/expired/ignored)
};

const EMPTY_STATS: PredictionStats = {
  total: 0,
  bySignal: {
    buy: { count: 0, won: 0, lost: 0, winRate: 0 },
    sell: { count: 0, won: 0, lost: 0, winRate: 0 },
    neutral: { count: 0, won: 0, lost: 0, winRate: 0 },
    avoid: { count: 0, won: 0, lost: 0, winRate: 0 },
  },
  byTimeOfDay: {
    morning: { count: 0, won: 0, winRate: 0 },
    afternoon: { count: 0, won: 0, winRate: 0 },
  },
  overallWinRate: 0,
  totalDecided: 0,
};

export function computeStats(preds: Prediction[]): PredictionStats {
  if (preds.length === 0) return EMPTY_STATS;

  const stats: PredictionStats = JSON.parse(JSON.stringify(EMPTY_STATS));
  stats.total = preds.length;

  let totalWon = 0;
  let totalDecided = 0;

  for (const p of preds) {
    const sig = p.signalType as keyof typeof stats.bySignal;
    if (!stats.bySignal[sig]) continue;

    stats.bySignal[sig].count++;
    if (p.status === "won") {
      stats.bySignal[sig].won++;
      totalWon++;
      totalDecided++;
    } else if (p.status === "lost") {
      stats.bySignal[sig].lost++;
      totalDecided++;
    }

    // Horário
    const hour = new Date(p.createdAt).getHours();
    const bucket = hour < 13 ? "morning" : "afternoon";
    stats.byTimeOfDay[bucket].count++;
    if (p.status === "won") stats.byTimeOfDay[bucket].won++;
  }

  // Calcula win-rate por bucket
  for (const sig of Object.keys(stats.bySignal) as Array<keyof typeof stats.bySignal>) {
    const b = stats.bySignal[sig];
    const decided = b.won + b.lost;
    b.winRate = decided > 0 ? Math.round((b.won / decided) * 1000) / 10 : 0;
  }
  for (const t of ["morning", "afternoon"] as const) {
    const b = stats.byTimeOfDay[t];
    b.winRate = b.count > 0 ? Math.round((b.won / b.count) * 1000) / 10 : 0;
  }
  stats.totalDecided = totalDecided;
  stats.overallWinRate = totalDecided > 0 ? Math.round((totalWon / totalDecided) * 1000) / 10 : 0;
  return stats;
}

/**
 * Busca todas as predições dos últimos 30 dias do usuário.
 */
export async function getRecentPredictions(userId: number, days = 30): Promise<Prediction[]> {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(predictions)
    .where(and(eq(predictions.userId, userId), gte(predictions.createdAt, cutoff)))
    .orderBy(desc(predictions.createdAt));
}

/**
 * Formata as estatísticas como string compacta para incluir no prompt do LLM.
 */
export function formatStatsForPrompt(stats: PredictionStats): string {
  if (stats.total === 0) {
    return "HISTÓRICO: usuário sem predições anteriores (primeiro uso).";
  }
  const parts: string[] = [];
  parts.push(`HISTÓRICO (últimos 30 dias, ${stats.total} predições, ${stats.totalDecided} com resultado):`);
  parts.push(`- Win-rate geral: ${stats.overallWinRate}%`);
  for (const sig of ["buy", "sell"] as const) {
    const b = stats.bySignal[sig];
    if (b.count > 0) {
      parts.push(`- ${sig === "buy" ? "COMPRA" : "VENDA"}: ${b.count} sinais, win-rate ${b.winRate}% (${b.won}V/${b.lost}P)`);
    }
  }
  const m = stats.byTimeOfDay.morning;
  const a = stats.byTimeOfDay.afternoon;
  if (m.count > 0) parts.push(`- Manhã (até 13h): ${m.count} predições, win-rate ${m.winRate}%`);
  if (a.count > 0) parts.push(`- Tarde (após 13h): ${a.count} predições, win-rate ${a.winRate}%`);
  return parts.join("\n");
}
