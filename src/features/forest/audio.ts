import { Howl, Howler } from "howler";

// Tiny silent placeholder WAV (44 bytes header + 0 samples). Keeps Howl happy
// without shipping audio assets yet — swap urls below when real audio lands.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

type Layer = "wind" | "roomTone" | "distantBirds" | "nearbyBirds" | "footsteps" | "leaves" | "chime";

const SOURCES: Record<Layer, { url: string; loop: boolean; vol: number; group: "ambient" | "effects" }> = {
  wind:         { url: SILENT_WAV, loop: true,  vol: 0.5, group: "ambient" },
  roomTone:     { url: SILENT_WAV, loop: true,  vol: 0.4, group: "ambient" },
  distantBirds: { url: SILENT_WAV, loop: true,  vol: 0.3, group: "ambient" },
  nearbyBirds:  { url: SILENT_WAV, loop: false, vol: 0.5, group: "effects" },
  footsteps:    { url: SILENT_WAV, loop: true,  vol: 0.4, group: "effects" },
  leaves:       { url: SILENT_WAV, loop: false, vol: 0.4, group: "effects" },
  chime:        { url: SILENT_WAV, loop: false, vol: 0.6, group: "effects" },
};

class AudioManager {
  private layers: Partial<Record<Layer, Howl>> = {};
  private started = false;
  private muted = true;
  private ambient = 0.5;
  private effects = 0.6;
  private occasionalTimer: ReturnType<typeof setTimeout> | null = null;

  /** Lazy-create Howls only after explicit user action. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    try {
      // Resume the underlying AudioContext if browser suspended it.
      const ctx = (Howler as unknown as { ctx?: AudioContext }).ctx;
      if (ctx && ctx.state === "suspended") await ctx.resume();
    } catch {
      // ignore
    }
    for (const key of Object.keys(SOURCES) as Layer[]) {
      const s = SOURCES[key];
      this.layers[key] = new Howl({ src: [s.url], loop: s.loop, volume: 0, html5: false, preload: true });
    }
    this.applyVolumes();
    this.playAmbient();
    this.scheduleOccasional();
  }

  private playAmbient(): void {
    (["wind", "roomTone", "distantBirds"] as Layer[]).forEach((l) => {
      const h = this.layers[l];
      if (!h) return;
      if (!h.playing()) h.play();
      h.fade(h.volume(), this.layerTarget(l), 1200);
    });
  }

  private layerTarget(layer: Layer): number {
    if (this.muted) return 0;
    const base = SOURCES[layer].vol;
    const group = SOURCES[layer].group === "ambient" ? this.ambient : this.effects;
    return base * group;
  }

  private applyVolumes(): void {
    for (const key of Object.keys(this.layers) as Layer[]) {
      const h = this.layers[key];
      if (h) h.volume(this.layerTarget(key));
    }
  }

  private scheduleOccasional(): void {
    if (this.occasionalTimer) clearTimeout(this.occasionalTimer);
    const next = 12000 + Math.random() * 24000;
    this.occasionalTimer = setTimeout(() => {
      if (!this.muted) this.play("nearbyBirds");
      this.scheduleOccasional();
    }, next);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolumes();
  }
  setAmbient(v: number): void { this.ambient = v; this.applyVolumes(); }
  setEffects(v: number): void { this.effects = v; this.applyVolumes(); }

  play(layer: Layer): void {
    const h = this.layers[layer];
    if (!h || this.muted) return;
    h.volume(this.layerTarget(layer));
    h.play();
  }

  setFootsteps(active: boolean): void {
    const h = this.layers.footsteps;
    if (!h) return;
    if (active && !h.playing() && !this.muted) h.play();
    h.fade(h.volume(), active ? this.layerTarget("footsteps") : 0, 600);
  }

  /** Tear down everything — call on unmount. */
  dispose(): void {
    if (this.occasionalTimer) clearTimeout(this.occasionalTimer);
    this.occasionalTimer = null;
    for (const key of Object.keys(this.layers) as Layer[]) {
      const h = this.layers[key];
      try { h?.stop(); h?.unload(); } catch { /* noop */ }
    }
    this.layers = {};
    this.started = false;
  }
}

export const forestAudio = new AudioManager();
