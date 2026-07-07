import { useEffect, useRef } from "react";
import { X, Volume2, VolumeX, Compass, Route as RouteIcon } from "lucide-react";
import { useForestStore, lookRef, moveRef } from "../store";

export function WalkControls({ onExit, onRecenter, visible }: { onExit: () => void; onRecenter: () => void; visible: boolean }) {
  const wander = useForestStore((s) => s.walkPlaying);
  const setWander = useForestStore((s) => s.setWalkPlaying);
  const sound = useForestStore((s) => s.soundOn);
  const setSound = useForestStore((s) => s.setSoundOn);

  // Keyboard WASD / arrows.
  useEffect(() => {
    const pressed = new Set<string>();
    const update = () => {
      let x = 0, z = 0;
      if (pressed.has("w") || pressed.has("arrowup")) z += 1;
      if (pressed.has("s") || pressed.has("arrowdown")) z -= 1;
      if (pressed.has("d") || pressed.has("arrowright")) x += 1;
      if (pressed.has("a") || pressed.has("arrowleft")) x -= 1;
      const m = Math.hypot(x, z) || 1;
      moveRef.x = x / m;
      moveRef.z = z / m;
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k)) {
        pressed.add(k); update(); e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => { pressed.delete(e.key.toLowerCase()); update(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      moveRef.x = 0; moveRef.z = 0;
    };
  }, []);

  return (
    <>
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-between p-4 transition-opacity duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        <button
          type="button"
          onClick={onExit}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklch,var(--color-parchment)_85%,transparent)] px-3 py-2 text-sm text-forest shadow-soft backdrop-blur-md min-h-[44px] min-w-[44px]"
          aria-label="Exit forest"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-[color-mix(in_oklch,var(--color-parchment)_85%,transparent)] px-2 py-1 shadow-soft backdrop-blur-md">
          <IconBtn onClick={() => setWander(!wander)} label={wander ? "Stop auto wander" : "Auto wander"} active={wander}>
            <RouteIcon className="h-4 w-4" />
          </IconBtn>
          <IconBtn onClick={() => { lookRef.yaw = 0; lookRef.pitch = 0; onRecenter(); }} label="Recenter">
            <Compass className="h-4 w-4" />
          </IconBtn>
          <IconBtn onClick={() => setSound(!sound)} label={sound ? "Mute" : "Sound on"}>
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </IconBtn>
        </div>
      </div>

      <Joystick visible={visible} />
    </>
  );
}

function IconBtn({ children, onClick, label, active }: { children: React.ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`grid h-11 w-11 place-items-center rounded-full ${active ? "bg-sage text-forest" : "text-forest hover:bg-mist"}`}
    >
      {children}
    </button>
  );
}

function Joystick({ visible }: { visible: boolean }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const active = useRef<{ id: number; cx: number; cy: number } | null>(null);

  const setStick = (dx: number, dy: number) => {
    if (stickRef.current) stickRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    const R = 44;
    const nx = Math.max(-1, Math.min(1, dx / R));
    const nz = Math.max(-1, Math.min(1, -dy / R));
    moveRef.x = nx;
    moveRef.z = nz;
  };

  const onDown = (e: React.PointerEvent) => {
    const rect = baseRef.current!.getBoundingClientRect();
    active.current = { id: e.pointerId, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setStick(e.clientX - active.current.cx, e.clientY - active.current.cy);
    e.stopPropagation();
  };
  const onMove = (e: React.PointerEvent) => {
    if (!active.current || active.current.id !== e.pointerId) return;
    let dx = e.clientX - active.current.cx;
    let dy = e.clientY - active.current.cy;
    const R = 44;
    const d = Math.hypot(dx, dz(dy)); // helper below
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    setStick(dx, dy);
    e.stopPropagation();
  };
  const onUp = (e: React.PointerEvent) => {
    if (!active.current) return;
    active.current = null;
    setStick(0, 0);
    moveRef.x = 0; moveRef.z = 0;
    e.stopPropagation();
  };

  return (
    <div
      className={`pointer-events-none absolute bottom-6 left-6 z-10 transition-opacity duration-500 ${visible ? "opacity-100" : "opacity-60"}`}
    >
      <div
        ref={baseRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="pointer-events-auto relative h-28 w-28 rounded-full bg-[color-mix(in_oklch,var(--color-parchment)_60%,transparent)] shadow-soft backdrop-blur-md touch-none"
        role="application"
        aria-label="Move joystick"
      >
        <div
          ref={stickRef}
          className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-forest/70"
        />
      </div>
    </div>
  );
}

function dz(y: number) { return y; }
