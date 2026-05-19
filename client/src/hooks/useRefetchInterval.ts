/**
 * useRefetchInterval — intervalo de polling dinâmico.
 * Durante o pregão (9h00–17h30 BRT) atualiza a cada 15s; fora, a cada 60s.
 * Retorna uma função (React Query aceita refetchInterval como função).
 */

export function getRefetchInterval(): number {
  const now = new Date();
  // Brasília = UTC-3
  const hourBRT = (now.getUTCHours() - 3 + 24) % 24;
  const minuteBRT = now.getUTCMinutes();
  const timeDecimal = hourBRT + minuteBRT / 60;
  const isPregao = timeDecimal >= 9.0 && timeDecimal <= 17.5;
  return isPregao ? 15_000 : 60_000;
}

/** Hook trivial — retorna a função para passar ao React Query. */
export function useRefetchInterval() {
  return getRefetchInterval;
}
