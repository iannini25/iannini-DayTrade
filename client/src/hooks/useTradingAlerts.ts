import { useState, useCallback, useEffect, useRef } from "react";
import {
  audioEngine,
  loadAlertSettings,
  saveAlertSettings,
  type AlertType,
  type AlertSettings,
  DEFAULT_ALERT_SETTINGS,
} from "@/lib/tradingAudio";

/**
 * Hook principal para gerenciar alertas sonoros de trading.
 * Expõe funções para disparar alertas e um estado reativo das configurações.
 */
export function useTradingAlerts() {
  const [settings, setSettings] = useState<AlertSettings>(() => loadAlertSettings());
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Desbloquear áudio na primeira interação do usuário (política de autoplay)
  useEffect(() => {
    const unlock = () => {
      setAudioUnlocked(true);
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
    };
    document.addEventListener("click", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  const playAlert = useCallback((type: AlertType) => {
    audioEngine.play(type);
  }, []);

  const updateSettings = useCallback((newSettings: AlertSettings) => {
    setSettings(newSettings);
    audioEngine.updateSettings(newSettings); // updateSettings already calls saveAlertSettings internally
  }, []);

  const updateMasterVolume = useCallback((volume: number) => {
    const next = { ...settings, masterVolume: volume };
    updateSettings(next);
  }, [settings, updateSettings]);

  const toggleAlert = useCallback((type: AlertType, enabled: boolean) => {
    const next: AlertSettings = {
      ...settings,
      alerts: {
        ...settings.alerts,
        [type]: { ...settings.alerts[type], enabled },
      },
    };
    updateSettings(next);
  }, [settings, updateSettings]);

  const updateAlertConfig = useCallback((
    type: AlertType,
    patch: Partial<AlertSettings["alerts"][AlertType]>
  ) => {
    const next: AlertSettings = {
      ...settings,
      alerts: {
        ...settings.alerts,
        [type]: { ...settings.alerts[type], ...patch },
      },
    };
    updateSettings(next);
  }, [settings, updateSettings]);

  const resetToDefaults = useCallback(() => {
    updateSettings({ ...DEFAULT_ALERT_SETTINGS });
  }, [updateSettings]);

  const testAlert = useCallback((type: AlertType) => {
    // Força reprodução ignorando debounce (para teste)
    const originalEnabled = settings.alerts[type]?.enabled;
    const tempSettings: AlertSettings = {
      ...settings,
      alerts: {
        ...settings.alerts,
        [type]: { ...settings.alerts[type], enabled: true },
      },
    };
    audioEngine.updateSettings(tempSettings);
    // Pequeno hack: zera o debounce interno forçando play
    audioEngine.play(type);
    // Restaura
    setTimeout(() => audioEngine.updateSettings(settings), 100);
  }, [settings]);

  return {
    settings,
    audioUnlocked,
    playAlert,
    updateSettings,
    updateMasterVolume,
    toggleAlert,
    updateAlertConfig,
    resetToDefaults,
    testAlert,
  };
}

/**
 * Hook para detectar cruzamento de preço com VWAP.
 * Retorna a direção do cruzamento quando ocorre.
 */
export function useVwapCrossDetector(
  currentPrice: number,
  vwapValue: number,
  onCrossUp: () => void,
  onCrossDown: () => void
) {
  const prevAboveRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!currentPrice || !vwapValue) return;
    const isAbove = currentPrice > vwapValue;

    if (prevAboveRef.current === null) {
      prevAboveRef.current = isAbove;
      return;
    }

    if (!prevAboveRef.current && isAbove) {
      // Cruzou para cima
      onCrossUp();
    } else if (prevAboveRef.current && !isAbove) {
      // Cruzou para baixo
      onCrossDown();
    }

    prevAboveRef.current = isAbove;
  }, [currentPrice, vwapValue, onCrossUp, onCrossDown]);
}
