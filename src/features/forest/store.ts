import { create } from "zustand";
import type { ForestTree, QualityMode } from "./types";

export type ForestMode = "overview" | "walk";

type ForestState = {
  mode: ForestMode;
  selected: ForestTree | null;
  walkPlaying: boolean;
  walkProgress: number; // 0..1 along path
  soundOn: boolean;
  ambientVolume: number;
  effectsVolume: number;
  quality: QualityMode;
  uiHidden: boolean;
  setMode: (m: ForestMode) => void;
  setSelected: (t: ForestTree | null) => void;
  setWalkPlaying: (p: boolean) => void;
  setWalkProgress: (p: number) => void;
  setSoundOn: (v: boolean) => void;
  setAmbientVolume: (v: number) => void;
  setEffectsVolume: (v: number) => void;
  setQuality: (q: QualityMode) => void;
  setUiHidden: (h: boolean) => void;
};

export const useForestStore = create<ForestState>((set) => ({
  mode: "overview",
  selected: null,
  walkPlaying: true,
  walkProgress: 0,
  soundOn: false,
  ambientVolume: 0.5,
  effectsVolume: 0.6,
  quality: "auto",
  uiHidden: false,
  setMode: (mode) => set({ mode, selected: null }),
  setSelected: (selected) => set({ selected }),
  setWalkPlaying: (walkPlaying) => set({ walkPlaying }),
  setWalkProgress: (walkProgress) => set({ walkProgress }),
  setSoundOn: (soundOn) => set({ soundOn }),
  setAmbientVolume: (ambientVolume) => set({ ambientVolume }),
  setEffectsVolume: (effectsVolume) => set({ effectsVolume }),
  setQuality: (quality) => set({ quality }),
  setUiHidden: (uiHidden) => set({ uiHidden }),
}));

// Module-level shared mutable look-offset ref (yaw/pitch added by drag).
// Kept outside React state to avoid per-frame re-renders.
export const lookRef = { yaw: 0, pitch: 0 };
