import { useEffect, useRef, useCallback } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type Time,
} from "lightweight-charts";

export interface PriceLineSpec {
  price: number;
  color: string;
  title?: string;
  lineStyle?: 0 | 1 | 2 | 3 | 4; // 0=Solid, 1=Dotted, 2=Dashed, 3=LargeDashed, 4=SparseDotted
  lineWidth?: 1 | 2 | 3 | 4;
}

interface CandlestickChartProps {
  marketData: unknown;
  onVwapCrossUp?: () => void;
  onVwapCrossDown?: () => void;
  /** Linhas horizontais extras (ex.: entry/stop/gain da predição da IA). */
  priceLines?: PriceLineSpec[];
}

function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let prev = data[0] ?? 0;
  for (let i = 0; i < data.length; i++) {
    if (i === 0) { ema.push(data[0] ?? 0); prev = data[0] ?? 0; continue; }
    const val = (data[i] ?? 0) * k + prev * (1 - k);
    ema.push(val);
    prev = val;
  }
  return ema;
}

function calcVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number[] {
  const vwap: number[] = [];
  let cumPV = 0, cumVol = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = ((highs[i] ?? 0) + (lows[i] ?? 0) + (closes[i] ?? 0)) / 3;
    cumPV += tp * (volumes[i] ?? 0);
    cumVol += volumes[i] ?? 0;
    vwap.push(cumVol > 0 ? cumPV / cumVol : closes[i] ?? 0);
  }
  return vwap;
}

export default function CandlestickChart({ marketData, onVwapCrossUp, onVwapCrossDown, priceLines }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema9SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  // Lista de price-lines criadas para podermos limpar e recriar
  const priceLinesRef = useRef<Array<{ remove: () => void }>>([]);

  // Rastrear cruzamento VWAP: armazena se o último close estava acima da VWAP
  const prevAboveVwapRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(140,140,160,1)",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(40,42,54,1)", style: 1 },
        horzLines: { color: "rgba(40,42,54,1)", style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(140,140,160,0.6)", width: 1, style: 1 },
        horzLine: { color: "rgba(140,140,160,0.6)", width: 1, style: 1 },
      },
      rightPriceScale: {
        borderColor: "rgba(40,42,54,1)",
        textColor: "rgba(140,140,160,1)",
        scaleMargins: { top: 0.05, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "rgba(40,42,54,1)",
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });
    chartRef.current = chart;

    // Candlestick
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    candleSeriesRef.current = candleSeries;

    // Volume
    const volSeries = chart.addSeries(HistogramSeries, {
      color: "rgba(100,149,237,0.3)",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    volumeSeriesRef.current = volSeries;

    // VWAP
    const vwapSeries = chart.addSeries(LineSeries, {
      color: "#d97706",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: "VWAP",
    });
    vwapSeriesRef.current = vwapSeries;

    // EMA 9
    const ema9Series = chart.addSeries(LineSeries, {
      color: "#06b6d4",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      title: "EMA9",
    });
    ema9SeriesRef.current = ema9Series;

    // EMA 21
    const ema21Series = chart.addSeries(LineSeries, {
      color: "#a855f7",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      title: "EMA21",
    });
    ema21SeriesRef.current = ema21Series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !marketData) return;
    const result = (marketData as any)?.data?.chart?.result?.[0];
    if (!result) return;

    const timestamps: number[] = result.timestamp ?? [];
    const quotes = result.indicators?.quote?.[0] ?? {};
    const opens: number[] = quotes.open ?? [];
    const highs: number[] = quotes.high ?? [];
    const lows: number[] = quotes.low ?? [];
    const closes: number[] = quotes.close ?? [];
    const volumes: number[] = quotes.volume ?? [];

    if (!timestamps.length) return;

    const candles: CandlestickData[] = [];
    const volData: HistogramData[] = [];
    const validHighs: number[] = [], validLows: number[] = [], validCloses: number[] = [], validVols: number[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (!opens[i] || !highs[i] || !lows[i] || !closes[i]) continue;
      const time = timestamps[i] as Time;
      candles.push({ time, open: opens[i], high: highs[i], low: lows[i], close: closes[i] });
      volData.push({
        time,
        value: volumes[i] ?? 0,
        color: closes[i] >= opens[i] ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
      });
      validHighs.push(highs[i]);
      validLows.push(lows[i]);
      validCloses.push(closes[i]);
      validVols.push(volumes[i] ?? 0);
    }

    if (!candles.length) return;

    candleSeriesRef.current.setData(candles);
    volumeSeriesRef.current?.setData(volData);

    const times = candles.map(c => c.time);
    const vwapVals = calcVWAP(validHighs, validLows, validCloses, validVols);
    const ema9Vals = calcEMA(validCloses, 9);
    const ema21Vals = calcEMA(validCloses, 21);

    const toLine = (vals: number[]): LineData[] =>
      times.map((t, i) => ({ time: t, value: vals[i] ?? 0 }));

    vwapSeriesRef.current?.setData(toLine(vwapVals));
    ema9SeriesRef.current?.setData(toLine(ema9Vals));
    ema21SeriesRef.current?.setData(toLine(ema21Vals));

    chartRef.current?.timeScale().fitContent();

    // ─── Detecção de cruzamento VWAP ───────────────────────────────────────
    // Compara o último close com o último valor VWAP calculado
    const lastClose = validCloses[validCloses.length - 1];
    const lastVwap = vwapVals[vwapVals.length - 1];

    if (lastClose !== undefined && lastVwap !== undefined) {
      const isAbove = lastClose > lastVwap;

      if (prevAboveVwapRef.current !== null) {
        if (!prevAboveVwapRef.current && isAbove) {
          // Cruzou VWAP para CIMA
          onVwapCrossUp?.();
        } else if (prevAboveVwapRef.current && !isAbove) {
          // Cruzou VWAP para BAIXO
          onVwapCrossDown?.();
        }
      }
      prevAboveVwapRef.current = isAbove;
    }
  }, [marketData, onVwapCrossUp, onVwapCrossDown]);

  // ─── Price lines extras (entry/stop/gain da predição da IA) ───────────────
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    // Remove price-lines anteriores
    for (const pl of priceLinesRef.current) {
      try { pl.remove(); } catch { /* já removida */ }
    }
    priceLinesRef.current = [];

    if (!priceLines || priceLines.length === 0) return;

    for (const spec of priceLines) {
      if (!Number.isFinite(spec.price) || spec.price <= 0) continue;
      const pl = series.createPriceLine({
        price: spec.price,
        color: spec.color,
        lineWidth: spec.lineWidth ?? 2,
        lineStyle: spec.lineStyle ?? 2, // dashed por padrão
        axisLabelVisible: true,
        title: spec.title ?? "",
      });
      priceLinesRef.current.push(pl as any);
    }
  }, [priceLines, marketData]);

  return (
    <div ref={containerRef} className="w-full h-full relative" style={{ minHeight: 200 }}>
      {/* Legenda de indicadores com tooltips */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-3 flex-wrap">
        <div className="group relative flex items-center gap-1 cursor-help">
          <div className="w-3 h-0.5 bg-[#f59e0b]" />
          <span className="text-[10px] text-[#f59e0b] font-medium">VWAP</span>
          <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block w-56 bg-[#1a1f2e] border border-[#2a3040] rounded p-2 text-[10px] text-slate-300 shadow-xl z-30">
            <strong className="text-[#f59e0b]">VWAP</strong> — Preço Médio Ponderado por Volume.<br/>
            Acima da linha: domínio comprador.<br/>
            Abaixo da linha: domínio vendedor.<br/>
            Usado como referência de preço justo por institucionais.
          </div>
        </div>
        <div className="group relative flex items-center gap-1 cursor-help">
          <div className="w-3 h-0.5 bg-[#22c55e]" />
          <span className="text-[10px] text-[#22c55e] font-medium">EMA 9</span>
          <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block w-52 bg-[#1a1f2e] border border-[#2a3040] rounded p-2 text-[10px] text-slate-300 shadow-xl z-30">
            <strong className="text-[#22c55e]">EMA 9</strong> — Média Móvel Exponencial de 9 períodos.<br/>
            Tendência de curtissímo prazo.<br/>
            Cruzamento com EMA 21 gera sinal de entrada.
          </div>
        </div>
        <div className="group relative flex items-center gap-1 cursor-help">
          <div className="w-3 h-0.5 bg-[#a855f7]" />
          <span className="text-[10px] text-[#a855f7] font-medium">EMA 21</span>
          <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block w-52 bg-[#1a1f2e] border border-[#2a3040] rounded p-2 text-[10px] text-slate-300 shadow-xl z-30">
            <strong className="text-[#a855f7]">EMA 21</strong> — Média Móvel Exponencial de 21 períodos.<br/>
            Suporte/resistência dinâmica de curto prazo.<br/>
            Referência de tendência intradiaria.
          </div>
        </div>
        <div className="group relative flex items-center gap-1 cursor-help">
          <div className="w-3 h-2 bg-[rgba(34,197,94,0.3)] rounded-sm" />
          <span className="text-[10px] text-slate-400 font-medium">Vol</span>
          <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block w-52 bg-[#1a1f2e] border border-[#2a3040] rounded p-2 text-[10px] text-slate-300 shadow-xl z-30">
            <strong className="text-slate-200">Volume Financeiro</strong><br/>
            Verde: candle de alta. Vermelho: candle de baixa.<br/>
            Volume alto confirma a força do movimento.
          </div>
        </div>
      </div>
      {!marketData && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Carregando dados de mercado...</span>
          </div>
        </div>
      )}
    </div>
  );
}
