import { useRef, useCallback } from "react";

export type AlertType = "buy" | "sell" | "warning";

/**
 * useSignalAlert — bipes via Web Audio API (sem dependência externa).
 * compra = 2 bipes agudos, venda = 2 bipes graves, atenção = 1 bipe médio.
 */
export function useSignalAlert() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getCtx = (): AudioContext | null => {
    try {
      if (!audioCtxRef.current) {
        const Ctor =
          window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return null;
        audioCtxRef.current = new Ctor();
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  };

  const playAlert = useCallback((type: AlertType) => {
    try {
      const ctx = getCtx();
      if (!ctx) return;
      const cfg = {
        buy: { freq: 880, duration: 0.3, reps: 2 },
        sell: { freq: 440, duration: 0.3, reps: 2 },
        warning: { freq: 660, duration: 0.5, reps: 1 },
      }[type];

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(cfg.freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + cfg.duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + cfg.duration);

      if (cfg.reps > 1) {
        setTimeout(() => playAlert(type), 400);
      }
    } catch (e) {
      console.warn("[useSignalAlert] áudio indisponível:", e);
    }
  }, []);

  return { playAlert };
}
