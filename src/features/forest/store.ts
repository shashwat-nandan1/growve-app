import { create } from "zustand";
import type { ForestTree, QualityMode } from "./types";

export type ForestMode = "overview" | "walk";

type ForestState = {
  mode: ForestMode;
  selected: ForestTree | null;
  walkPlaying: boolean;       // Auto-wander enabled?
  walkProgress: number;
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
  walkPlaying: false, // Auto-wander is opt-in; free-roam is the default.
  walkProgress: 0,
  soundOn: false,
  ambientVolume: 0.55,
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

// Shared mutable refs for high-frequency input state. Kept outside React so
// per-frame updates never trigger re-renders.
export const lookRef = { yaw: 0, pitch: 0 };
export const moveRef = { x: 0, z: 0 }; // −1..1 joystick / keyboard vector (local space)
