/**
 * Trading Audio Engine
 * Motor de áudio para alertas sonoros de trading usando Web Audio API.
 * Não requer dependências externas — gera sons sintetizados em tempo real.
 */

export type AlertType =
  | "order_buy"       // Ordem de compra executada
  | "order_sell"      // Ordem de venda executada
  | "vwap_cross_up"   // Preço cruzou VWAP para cima
  | "vwap_cross_down" // Preço cruzou VWAP para baixo
  | "stop_loss"       // Preço atingiu Stop Loss
  | "take_profit"     // Preço atingiu Take Profit
  | "alert_generic";  // Alerta genérico

export interface AlertConfig {
  enabled: boolean;
  volume: number;       // 0.0 - 1.0
  frequency: number;    // Hz (frequência base do tom)
  waveform: OscillatorType; // sine | square | sawtooth | triangle
}

export interface AlertSettings {
  masterVolume: number;
  alerts: Record<AlertType, AlertConfig>;
}

// Configurações padrão para cada tipo de alerta
export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  masterVolume: 0.7,
  alerts: {
    order_buy: {
      enabled: true,
      volume: 0.8,
      frequency: 880,
      waveform: "sine",
    },
    order_sell: {
      enabled: true,
      volume: 0.8,
      frequency: 440,
      waveform: "sine",
    },
    vwap_cross_up: {
      enabled: true,
      volume: 0.6,
      frequency: 660,
      waveform: "triangle",
    },
    vwap_cross_down: {
      enabled: true,
      volume: 0.6,
      frequency: 330,
      waveform: "triangle",
    },
    stop_loss: {
      enabled: true,
      volume: 1.0,
      frequency: 220,
      waveform: "sawtooth",
    },
    take_profit: {
      enabled: true,
      volume: 1.0,
      frequency: 1047,
      waveform: "sine",
    },
    alert_generic: {
      enabled: true,
      volume: 0.5,
      frequency: 523,
      waveform: "sine",
    },
  },
};

export const ALERT_LABELS: Record<AlertType, string> = {
  order_buy: "Ordem de Compra Executada",
  order_sell: "Ordem de Venda Executada",
  vwap_cross_up: "Cruzamento VWAP ↑ (para cima)",
  vwap_cross_down: "Cruzamento VWAP ↓ (para baixo)",
  stop_loss: "Stop Loss Atingido",
  take_profit: "Take Profit Atingido",
  alert_generic: "Alerta Genérico",
};

export const ALERT_COLORS: Record<AlertType, string> = {
  order_buy: "#22c55e",
  order_sell: "#ef4444",
  vwap_cross_up: "#06b6d4",
  vwap_cross_down: "#d97706",
  stop_loss: "#ef4444",
  take_profit: "#22c55e",
  alert_generic: "#a855f7",
};

const STORAGE_KEY = "iannini_alert_settings";

/**
 * Carrega configurações do localStorage
 */
export function loadAlertSettings(): AlertSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ALERT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AlertSettings>;
    // Merge com defaults para garantir que novos tipos existam
    return {
      masterVolume: parsed.masterVolume ?? DEFAULT_ALERT_SETTINGS.masterVolume,
      alerts: {
        ...DEFAULT_ALERT_SETTINGS.alerts,
        ...(parsed.alerts ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_ALERT_SETTINGS };
  }
}

/**
 * Salva configurações no localStorage
 */
export function saveAlertSettings(settings: AlertSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // silencioso
  }
}

// Padrões de nota para cada tipo de alerta
// Cada entrada é um array de [frequência, duração_ms, pausa_ms]
type NotePattern = Array<[number, number, number]>;

const ALERT_PATTERNS: Record<AlertType, NotePattern> = {
  order_buy: [
    [880, 80, 30],
    [1047, 80, 30],
    [1319, 150, 0],
  ],
  order_sell: [
    [440, 80, 30],
    [370, 80, 30],
    [294, 150, 0],
  ],
  vwap_cross_up: [
    [660, 60, 20],
    [784, 120, 0],
  ],
  vwap_cross_down: [
    [523, 60, 20],
    [392, 120, 0],
  ],
  stop_loss: [
    [220, 100, 50],
    [220, 100, 50],
    [220, 200, 0],
  ],
  take_profit: [
    [1047, 80, 20],
    [1319, 80, 20],
    [1568, 80, 20],
    [2093, 200, 0],
  ],
  alert_generic: [
    [523, 100, 50],
    [659, 150, 0],
  ],
};

/**
 * Motor de áudio principal — singleton
 */
class TradingAudioEngine {
  private ctx: AudioContext | null = null;
  private settings: AlertSettings;
  private lastAlertTime: Record<string, number> = {};
  private readonly DEBOUNCE_MS = 500; // evita alertas duplicados

  constructor() {
    this.settings = loadAlertSettings();
  }

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resumir contexto suspenso (política de autoplay do browser)
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Toca uma nota com envelope ADSR simplificado
   */
  private playNote(
    ctx: AudioContext,
    frequency: number,
    duration: number,
    volume: number,
    waveform: OscillatorType,
    startTime: number
  ): void {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = waveform;
    osc.frequency.setValueAtTime(frequency, startTime);

    const attack = 0.005;
    const release = 0.05;
    const sustainEnd = startTime + duration / 1000 - release;

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + attack);
    gainNode.gain.setValueAtTime(volume, sustainEnd > startTime + attack ? sustainEnd : startTime + attack);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration / 1000);

    osc.start(startTime);
    osc.stop(startTime + duration / 1000 + 0.01);
  }

  /**
   * Dispara um alerta sonoro
   */
  play(type: AlertType): void {
    const now = Date.now();
    const lastTime = this.lastAlertTime[type] ?? 0;
    if (now - lastTime < this.DEBOUNCE_MS) return;
    this.lastAlertTime[type] = now;

    const config = this.settings.alerts[type];
    if (!config?.enabled) return;

    const effectiveVolume = config.volume * this.settings.masterVolume;
    if (effectiveVolume <= 0) return;

    try {
      const ctx = this.getContext();
      const pattern = ALERT_PATTERNS[type];
      let time = ctx.currentTime + 0.01;

      for (const [freq, dur, pause] of pattern) {
        // Escala a frequência base pelo config do usuário (relativo ao padrão)
        const defaultFreq = DEFAULT_ALERT_SETTINGS.alerts[type].frequency;
        const scaledFreq = (freq / defaultFreq) * config.frequency;
        this.playNote(ctx, scaledFreq, dur, effectiveVolume, config.waveform, time);
        time += (dur + pause) / 1000;
      }
    } catch (err) {
      console.warn("[TradingAudio] Erro ao reproduzir alerta:", err);
    }
  }

  /**
   * Atualiza as configurações em tempo real
   */
  updateSettings(settings: AlertSettings): void {
    this.settings = settings;
    saveAlertSettings(settings);
  }

  /**
   * Recarrega configurações do localStorage
   */
  reloadSettings(): void {
    this.settings = loadAlertSettings();
  }

  getSettings(): AlertSettings {
    return this.settings;
  }
}

// Instância singleton exportada
export const audioEngine = new TradingAudioEngine();
