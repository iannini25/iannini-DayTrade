/**
 * education.ts — Conteúdo educacional + narrativa de mercado.
 *
 * Os tópicos estáticos têm conteúdo de qualidade já escrito (sempre funciona,
 * mesmo sem OPENAI_API_KEY). A narrativa "O Mercado Agora" é gerada a partir
 * dos indicadores técnicos calculados server-side.
 */

import type { TechnicalSignal } from "./technicalAnalysis";

export const EDUCATION_TOPICS = [
  "vwap",
  "ema-cross",
  "volume",
  "suporte-resistencia",
  "risco-retorno",
  "horarios-pregao",
] as const;

export type EducationTopic = (typeof EDUCATION_TOPICS)[number];

export const STATIC_CONTENT: Record<EducationTopic, { title: string; content: string }> = {
  vwap: {
    title: "O que é VWAP e como usá-lo",
    content:
      "VWAP (Volume Weighted Average Price) é o preço médio ponderado pelo volume, calculado desde a abertura do pregão. " +
      "É a principal referência de \"preço justo\" usada por players institucionais.\n\n" +
      "**Como usar:** quando o preço está ACIMA da VWAP, há domínio comprador — favoreça operações de compra. " +
      "Quando está ABAIXO, domínio vendedor — favoreça vendas. O cruzamento da VWAP costuma marcar mudança de fluxo. " +
      "Em dias de tendência, a VWAP funciona como suporte/resistência dinâmico: o preço recua até ela e retoma a direção.",
  },
  "ema-cross": {
    title: "Cruzamento de médias móveis (EMA9 / EMA21)",
    content:
      "A EMA (média móvel exponencial) dá mais peso aos preços recentes, reagindo mais rápido que a média simples.\n\n" +
      "**EMA9 acima da EMA21** = tendência de alta de curto prazo. **EMA9 abaixo da EMA21** = tendência de baixa. " +
      "O momento do cruzamento é um gatilho clássico de entrada.\n\n" +
      "**Boa prática:** combine com a VWAP. Compra só quando EMA9 > EMA21 E preço > VWAP (dupla confirmação). " +
      "Evite operar o cruzamento isolado em mercado lateral — gera muitos sinais falsos (serra).",
  },
  volume: {
    title: "Como interpretar o volume",
    content:
      "Volume é a quantidade de contratos negociados. Confirma (ou desmente) o movimento de preço.\n\n" +
      "**Regra geral:** movimento com volume crescente = força e tende a continuar. Movimento com volume fraco = " +
      "pode ser uma armadilha (falta de convicção).\n\n" +
      "Numa retração saudável dentro de uma tendência de alta, o volume DIMINUI na queda e VOLTA a crescer quando " +
      "o preço retoma a subida — sinal de que os vendedores não têm força.",
  },
  "suporte-resistencia": {
    title: "Suportes e resistências",
    content:
      "Suporte é uma região de preço onde a compra historicamente supera a venda (o preço \"para de cair\"). " +
      "Resistência é o oposto (o preço \"para de subir\").\n\n" +
      "**No Mini Índice**, observe as máximas e mínimas do dia anterior, números redondos (ex.: 130.000) e a VWAP. " +
      "Suporte rompido vira resistência e vice-versa. Opere a favor do rompimento COM volume, ou o repique a partir " +
      "do nível quando há rejeição clara (pavio longo).",
  },
  "risco-retorno": {
    title: "Como calcular risco/retorno",
    content:
      "Risco/retorno (R/R) compara quanto você arrisca vs quanto pode ganhar.\n\n" +
      "**Cálculo:** R/R = (pontos até o alvo) ÷ (pontos até o stop). Ex.: stop de 150 pts e alvo de 300 pts = R/R 1:2.\n\n" +
      "No Mini Índice cada ponto vale R$ 0,20 por contrato. Com 5 contratos e stop de 150 pts, o risco é " +
      "150 × 0,20 × 5 = R$ 150. Só opere setups com R/R mínimo de 1:1,5. Com R/R 1:2 você pode errar 60% das " +
      "operações e ainda ser lucrativo.",
  },
  "horarios-pregao": {
    title: "Os horários mais importantes do pregão",
    content:
      "O Mini Índice negocia das 9h às 18h (B3).\n\n" +
      "**9h00–9h30 (abertura):** alta volatilidade, gaps, movimentos bruscos. O método recomenda aguardar " +
      "estabilização antes de operar.\n" +
      "**10h–12h:** período mais técnico e confiável, tendências mais limpas.\n" +
      "**12h–13h (almoço):** liquidez reduzida, evite novas entradas.\n" +
      "**13h–16h:** retomada de fluxo, bons movimentos de tarde.\n" +
      "**16h–17h (pré-fechamento):** ajustes de posição, risco de reversão. Opere com cautela ou encerre.",
  },
};

/**
 * Gera a narrativa "O Mercado Agora" a partir do sinal técnico calculado.
 * Linguagem simples e acessível.
 */
export function buildMarketNarrative(signal: TechnicalSignal | null, now: Date): string {
  if (!signal || signal.indicators.currentPrice === 0) {
    const hour = now.getHours();
    if (hour < 9 || hour >= 18) {
      return "O mercado está fechado. O Mini Índice (WIN) negocia das 9h às 18h (horário de Brasília). " +
        "Volte durante o pregão para ver a análise ao vivo.";
    }
    return "Não foi possível obter dados de mercado no momento (fonte de cotação indisponível). " +
      "Tente novamente em alguns instantes.";
  }

  const { ema9, ema21, vwap, rsi, currentPrice } = signal.indicators;
  const trendUp = ema9 > ema21;
  const aboveVwap = currentPrice > vwap;

  const parts: string[] = [];

  parts.push(
    `O Mini Índice está cotado a ${currentPrice.toFixed(0)} pontos. ` +
      `A tendência de curto prazo é de **${trendUp ? "alta" : "baixa"}** ` +
      `(EMA9 em ${ema9.toFixed(0)} ${trendUp ? "acima" : "abaixo"} da EMA21 em ${ema21.toFixed(0)}).`
  );

  parts.push(
    `O preço está **${aboveVwap ? "acima" : "abaixo"}** da VWAP (${vwap.toFixed(0)}), ` +
      `o que indica domínio ${aboveVwap ? "comprador" : "vendedor"} no momento.`
  );

  if (rsi >= 70) {
    parts.push(`O RSI está em ${rsi.toFixed(0)} (sobrecompra) — cuidado com possível realização/correção.`);
  } else if (rsi <= 30) {
    parts.push(`O RSI está em ${rsi.toFixed(0)} (sobrevenda) — possível repique técnico à frente.`);
  } else {
    parts.push(`O RSI está em ${rsi.toFixed(0)}, em zona neutra — sem exageros de momento.`);
  }

  const sentiment =
    signal.signalType === "buy"
      ? "O sentimento geral favorece compras na retração."
      : signal.signalType === "sell"
        ? "O sentimento geral favorece vendas em repiques."
        : signal.signalType === "avoid"
          ? "O cenário pede cautela — melhor aguardar uma definição clara."
          : "O mercado está indeciso, sem direção dominante.";
  parts.push(sentiment);

  return parts.join(" ");
}

/**
 * Guia de integração com o Profit One Pro (P6) — conteúdo estruturado estático.
 */
export function getProfitGuide(): Array<{ title: string; content: string }> {
  return [
    {
      title: "1. Como usar o código NTSL gerado",
      content:
        "Na IA Operacional, clique em \"Copiar Código\". No Profit One Pro:\n" +
        "1. Abra o menu \"Estratégias\" → \"Editor de Estratégias\".\n" +
        "2. Crie uma nova estratégia (botão \"Novo\").\n" +
        "3. Cole o código NTSL no editor (Ctrl+V).\n" +
        "4. Clique em \"Compilar\" (ícone de engrenagem). Não deve haver erros.\n" +
        "5. Salve a estratégia com um nome (ex.: \"Iannini IA\").\n" +
        "6. Arraste a estratégia para o gráfico do WIN ou ative pelo gerenciador de estratégias.",
    },
    {
      title: "2. Configurações recomendadas no Profit One Pro",
      content:
        "- **Ativo:** contrato WIN vigente (ex.: WINM26).\n" +
        "- **Timeframe:** 5 minutos.\n" +
        "- **Modo de execução:** Tick a Tick (maior precisão de entrada/saída).\n" +
        "- **Horário de operação:** 9h15 às 17h00 (já embutido no código via HoraInicio/HoraFim).\n" +
        "- **Gestão de risco:** mantenha o stop automático ligado. Nunca desative o SetStopLoss.\n" +
        "- **Quantidade:** comece com 1 contrato para validar o comportamento antes de escalar.",
    },
    {
      title: "3. Limitações da integração atual",
      content:
        "Esta plataforma **analisa e sugere**; a **execução é feita por você** no Profit One Pro " +
        "(integração indireta via código NTSL).\n\n" +
        "A execução automática direta dependeria de uma API pública da Neologica para envio de ordens " +
        "por sistemas externos — algo que precisa ser verificado caso a caso com a Neologica e que pode " +
        "exigir contrato/produto específico. Enquanto isso, o fluxo recomendado é: a IA gera o código e a " +
        "orientação textual; você cola no Profit One Pro e acompanha. " +
        "Sempre confira o sinal e a qualidade (Forte/Moderado/Fraco) antes de ativar a automação.",
    },
    {
      title: "4. Boas práticas de segurança operacional",
      content:
        "- Teste a estratégia em conta de simulação do Profit antes de usar dinheiro real.\n" +
        "- Respeite o limite de perda diário configurado em Configurações.\n" +
        "- Use o Kill Switch (botão Pausar no Workspace) se algo sair do esperado.\n" +
        "- Sinais \"Fracos\" (confiança < 50%) pedem confirmação manual — não opere no automático.\n" +
        "- A IA é orientativa e não constitui recomendação de investimento.",
    },
  ];
}
