import { describe, expect, it } from "vitest";

/**
 * Testes unitários para a lógica de alertas sonoros.
 * Como o motor de áudio usa Web Audio API (browser-only),
 * testamos a lógica de configuração e detecção de cruzamento VWAP.
 */

// ─── Tipos espelhados do tradingAudio.ts ───────────────────────────────────
type AlertType =
  | "order_buy"
  | "order_sell"
  | "vwap_cross_up"
  | "vwap_cross_down"
  | "stop_loss"
  | "take_profit"
  | "alert_generic";

interface AlertConfig {
  enabled: boolean;
  volume: number;
  frequency: number;
  waveform: string;
}

interface AlertSettings {
  masterVolume: number;
  alerts: Record<AlertType, AlertConfig>;
}

const DEFAULT_SETTINGS: AlertSettings = {
  masterVolume: 0.7,
  alerts: {
    order_buy:      { enabled: true,  volume: 0.8, frequency: 880,  waveform: "sine"     },
    order_sell:     { enabled: true,  volume: 0.8, frequency: 440,  waveform: "sine"     },
    vwap_cross_up:  { enabled: true,  volume: 0.6, frequency: 660,  waveform: "triangle" },
    vwap_cross_down:{ enabled: true,  volume: 0.6, frequency: 330,  waveform: "triangle" },
    stop_loss:      { enabled: true,  volume: 1.0, frequency: 220,  waveform: "sawtooth" },
    take_profit:    { enabled: true,  volume: 1.0, frequency: 1047, waveform: "sine"     },
    alert_generic:  { enabled: true,  volume: 0.5, frequency: 523,  waveform: "sine"     },
  },
};

// ─── Lógica de detecção de cruzamento VWAP ────────────────────────────────
function detectVwapCross(
  prevAbove: boolean | null,
  currentPrice: number,
  vwapValue: number
): { direction: "up" | "down" | null; newAbove: boolean } {
  const isAbove = currentPrice > vwapValue;
  if (prevAbove === null) return { direction: null, newAbove: isAbove };
  if (!prevAbove && isAbove) return { direction: "up", newAbove: isAbove };
  if (prevAbove && !isAbove) return { direction: "down", newAbove: isAbove };
  return { direction: null, newAbove: isAbove };
}

// ─── Testes ───────────────────────────────────────────────────────────────

describe("Alert Settings", () => {
  it("deve ter volume master padrão de 0.7", () => {
    expect(DEFAULT_SETTINGS.masterVolume).toBe(0.7);
  });

  it("deve ter todos os 7 tipos de alerta definidos", () => {
    const types: AlertType[] = [
      "order_buy", "order_sell", "vwap_cross_up", "vwap_cross_down",
      "stop_loss", "take_profit", "alert_generic",
    ];
    types.forEach(t => {
      expect(DEFAULT_SETTINGS.alerts[t]).toBeDefined();
    });
  });

  it("stop_loss e take_profit devem ter volume máximo (1.0)", () => {
    expect(DEFAULT_SETTINGS.alerts.stop_loss.volume).toBe(1.0);
    expect(DEFAULT_SETTINGS.alerts.take_profit.volume).toBe(1.0);
  });

  it("take_profit deve ter frequência mais alta que stop_loss", () => {
    expect(DEFAULT_SETTINGS.alerts.take_profit.frequency)
      .toBeGreaterThan(DEFAULT_SETTINGS.alerts.stop_loss.frequency);
  });

  it("order_buy deve ter frequência mais alta que order_sell", () => {
    expect(DEFAULT_SETTINGS.alerts.order_buy.frequency)
      .toBeGreaterThan(DEFAULT_SETTINGS.alerts.order_sell.frequency);
  });

  it("todos os alertas devem estar habilitados por padrão", () => {
    Object.values(DEFAULT_SETTINGS.alerts).forEach(cfg => {
      expect(cfg.enabled).toBe(true);
    });
  });

  it("volume de cada alerta deve estar entre 0 e 1", () => {
    Object.values(DEFAULT_SETTINGS.alerts).forEach(cfg => {
      expect(cfg.volume).toBeGreaterThanOrEqual(0);
      expect(cfg.volume).toBeLessThanOrEqual(1);
    });
  });
});

describe("Detecção de Cruzamento VWAP", () => {
  it("não deve detectar cruzamento na primeira leitura (prevAbove = null)", () => {
    const result = detectVwapCross(null, 130000, 129500);
    expect(result.direction).toBeNull();
    expect(result.newAbove).toBe(true);
  });

  it("deve detectar cruzamento para CIMA quando preço passa de abaixo para acima da VWAP", () => {
    const result = detectVwapCross(false, 130100, 130000);
    expect(result.direction).toBe("up");
    expect(result.newAbove).toBe(true);
  });

  it("deve detectar cruzamento para BAIXO quando preço passa de acima para abaixo da VWAP", () => {
    const result = detectVwapCross(true, 129900, 130000);
    expect(result.direction).toBe("down");
    expect(result.newAbove).toBe(false);
  });

  it("não deve detectar cruzamento quando preço permanece acima da VWAP", () => {
    const result = detectVwapCross(true, 130500, 130000);
    expect(result.direction).toBeNull();
    expect(result.newAbove).toBe(true);
  });

  it("não deve detectar cruzamento quando preço permanece abaixo da VWAP", () => {
    const result = detectVwapCross(false, 129500, 130000);
    expect(result.direction).toBeNull();
    expect(result.newAbove).toBe(false);
  });

  it("deve detectar cruzamento para CIMA com preço exatamente igual à VWAP + 1 ponto", () => {
    const result = detectVwapCross(false, 130001, 130000);
    expect(result.direction).toBe("up");
  });

  it("deve detectar cruzamento para BAIXO com preço exatamente igual à VWAP - 1 ponto", () => {
    const result = detectVwapCross(true, 129999, 130000);
    expect(result.direction).toBe("down");
  });
});

describe("Toggle de Alertas", () => {
  it("deve desabilitar um alerta específico sem afetar os demais", () => {
    const updated: AlertSettings = {
      ...DEFAULT_SETTINGS,
      alerts: {
        ...DEFAULT_SETTINGS.alerts,
        stop_loss: { ...DEFAULT_SETTINGS.alerts.stop_loss, enabled: false },
      },
    };
    expect(updated.alerts.stop_loss.enabled).toBe(false);
    expect(updated.alerts.order_buy.enabled).toBe(true);
    expect(updated.alerts.take_profit.enabled).toBe(true);
  });

  it("deve atualizar volume master sem alterar configurações individuais", () => {
    const updated: AlertSettings = { ...DEFAULT_SETTINGS, masterVolume: 0.3 };
    expect(updated.masterVolume).toBe(0.3);
    expect(updated.alerts.order_buy.volume).toBe(DEFAULT_SETTINGS.alerts.order_buy.volume);
  });
});
