import type { QualityMode } from "./types";

export function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

export function isCoarseMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function resolveQuality(mode: QualityMode): "low" | "high" {
  if (mode === "low") return "low";
  if (mode === "high") return "high";
  // auto
  const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (isCoarseMobile() && (dm < 4 || cores < 4)) return "low";
  return "high";
}

export function dprCap(quality: "low" | "high"): [number, number] {
  if (quality === "low") return [1, 1];
  return isCoarseMobile() ? [1, 1.5] : [1, 2];
}

export function fogDistance(quality: "low" | "high"): [number, number] {
  return quality === "low" ? [10, 35] : [15, 60];
}
