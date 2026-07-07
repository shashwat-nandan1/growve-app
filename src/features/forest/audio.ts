import { Howl, Howler } from "howler";

// Real CC0 audio assets processed for mobile. See public/audio/ATTRIBUTION.md.
// Each ambient loop has an mp3 fallback for iOS Safari; effects stay ogg.
const AUDIO_BASE = "/audio";

const RUSTLE_COUNT = 20;

type AmbientKey = "forest" | "birdsWind";

class AudioManager {
  private ambient: Partial<Record<AmbientKey, Howl>> = {};
  private bell: Howl | null = null;
  private steps: Howl[] = [];
  private rustles: Howl[] = [];
  private started = false;
  private muted = true;
  private ambientVol = 0.55;
  private effectsVol = 0.6;
  private lastStepAt = 0;
  private lastRustleAt = 0;
  private occasionalTimer: ReturnType<typeof setTimeout> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private pausedByVisibility = false;

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    try {
      const ctx = (Howler as unknown as { ctx?: AudioContext }).ctx;
      if (ctx && ctx.state === "suspended") await ctx.resume();
    } catch { /* noop */ }

    this.ambient.forest = new Howl({
      src: [`${AUDIO_BASE}/forest-ambience.ogg`, `${AUDIO_BASE}/forest-ambience.mp3`],
      loop: true, volume: 0, html5: false, preload: true,
    });
    this.ambient.birdsWind = new Howl({
      src: [`${AUDIO_BASE}/birds-wind.ogg`, `${AUDIO_BASE}/birds-wind.mp3`],
      loop: true, volume: 0, html5: false, preload: true,
    });
    this.bell = new Howl({
      src: [`${AUDIO_BASE}/bell.ogg`, `${AUDIO_BASE}/bell.mp3`],
      loop: false, volume: 0.7, html5: false, preload: true,
    });
    this.steps = [
      new Howl({ src: [`${AUDIO_BASE}/step-leaves-1.ogg`], volume: 0.55, preload: true }),
      new Howl({ src: [`${AUDIO_BASE}/step-leaves-2.ogg`], volume: 0.55, preload: true }),
      new Howl({ src: [`${AUDIO_BASE}/step-gravel.ogg`],   volume: 0.45, preload: true }),
    ];
    this.rustles = Array.from({ length: RUSTLE_COUNT }, (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      return new Howl({ src: [`${AUDIO_BASE}/rustle${n}.ogg`], volume: 0.5, preload: false });
    });

    this.playAmbient();
    this.scheduleOccasional();

    if (typeof document !== "undefined" && !this.visibilityHandler) {
      this.visibilityHandler = () => {
        if (document.hidden) {
          this.pausedByVisibility = true;
          this.fadeAmbient(0, 300);
        } else if (this.pausedByVisibility) {
          this.pausedByVisibility = false;
          this.fadeAmbient(1, 800);
        }
      };
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }
  }

  private playAmbient(): void {
    for (const k of Object.keys(this.ambient) as AmbientKey[]) {
      const h = this.ambient[k];
      if (!h) continue;
      if (!h.playing()) h.play();
      h.fade(h.volume(), this.ambientTarget(k), 1400);
    }
  }

  private ambientTarget(k: AmbientKey): number {
    if (this.muted || this.pausedByVisibility) return 0;
    const base = k === "forest" ? 0.55 : 0.4;
    return base * this.ambientVol;
  }

  private fadeAmbient(mult: number, ms: number): void {
    for (const k of Object.keys(this.ambient) as AmbientKey[]) {
      const h = this.ambient[k];
      if (!h) continue;
      const target = this.ambientTarget(k) * mult;
      h.fade(h.volume(), target, ms);
    }
  }

  private scheduleOccasional(): void {
    if (this.occasionalTimer) clearTimeout(this.occasionalTimer);
    const next = 8000 + Math.random() * 18000;
    this.occasionalTimer = setTimeout(() => {
      if (!this.muted && !this.pausedByVisibility) this.playRustle(0.7);
      this.scheduleOccasional();
    }, next);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.fadeAmbient(1, 400);
  }
  setAmbientVolume(v: number): void { this.ambientVol = v; this.fadeAmbient(1, 200); }
  setEffectsVolume(v: number): void { this.effectsVol = v; }

  /** Called from the walk controller with current planar speed (units/sec). */
  onMotion(speed: number, delta: number): void {
    if (this.muted || speed < 0.3 || this.steps.length === 0) return;
    // Cadence proportional to walk speed. Roughly one step per 0.55m at 2 u/s.
    const interval = Math.max(0.35, 1.1 / Math.max(speed, 0.6));
    this.lastStepAt += delta;
    if (this.lastStepAt >= interval) {
      this.lastStepAt = 0;
      const h = this.steps[Math.floor(Math.random() * this.steps.length)];
      // Slight pitch variation for naturalism.
      const rate = 0.9 + Math.random() * 0.25;
      try { h.rate(rate); } catch { /* noop */ }
      h.volume(0.35 * this.effectsVol);
      h.play();
    }
    // Occasional foliage rustle when moving.
    this.lastRustleAt += delta;
    if (speed > 0.8 && this.lastRustleAt > 4 + Math.random() * 6) {
      this.lastRustleAt = 0;
      this.playRustle(0.35);
    }
  }

  playRustle(volumeMult = 0.5): void {
    if (this.muted || this.rustles.length === 0) return;
    const h = this.rustles[Math.floor(Math.random() * this.rustles.length)];
    try { h.stereo((Math.random() - 0.5) * 0.9); } catch { /* noop */ }
    h.volume(volumeMult * this.effectsVol);
    h.play();
  }

  /** Soft tend chime — deliberately restrained, not a game reward. */
  playTendBell(): void {
    // Bell should play on tend regardless of walk-mode mute; only silence if
    // the user disabled sound globally.
    if (!this.bell) {
      // Lazy-mount just the bell without booting ambient layers.
      this.bell = new Howl({
        src: [`${AUDIO_BASE}/bell.ogg`, `${AUDIO_BASE}/bell.mp3`],
        loop: false, volume: 0.55, preload: true,
      });
    }
    try {
      // Unlock audio context if it's suspended (first user gesture).
      const ctx = (Howler as unknown as { ctx?: AudioContext }).ctx;
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    } catch { /* noop */ }
    this.bell.volume(0.55);
    this.bell.play();
  }

  /** Full teardown — call on unmount from the immersive route. */
  dispose(): void {
    if (this.occasionalTimer) clearTimeout(this.occasionalTimer);
    this.occasionalTimer = null;
    if (this.visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    const all: Howl[] = [
      ...(Object.values(this.ambient).filter(Boolean) as Howl[]),
      ...this.steps,
      ...this.rustles,
    ];
    for (const h of all) {
      try { h.stop(); h.unload(); } catch { /* noop */ }
    }
    this.ambient = {};
    this.steps = [];
    this.rustles = [];
    // Keep bell alive for tend feedback outside the forest.
    this.started = false;
    this.muted = true;
  }
}

export const forestAudio = new AudioManager();
