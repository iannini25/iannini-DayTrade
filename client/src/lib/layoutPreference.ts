/**
 * layoutPreference.ts — Helpers para persistir e ler a preferência de layout
 * (Desktop vs Smartphone) no localStorage.
 */

export type Layout = "desktop" | "mobile";

const STORAGE_KEY = "preferredLayout";

export function getPreferredLayout(): Layout | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "desktop" || v === "mobile") return v;
  return null;
}

export function setPreferredLayout(layout: Layout): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, layout);
}

export function getRouteForLayout(layout: Layout): string {
  return layout === "mobile" ? "/mobile" : "/workspace";
}

/**
 * Auto-detecção: se nunca foi setado, sugere "mobile" para viewports estreitas.
 * NÃO persiste — apenas sugere para a UI inicial do seletor.
 */
export function suggestLayout(): Layout {
  if (typeof window === "undefined") return "desktop";
  return window.innerWidth < 768 ? "mobile" : "desktop";
}
