import { Pause, Play, X, Volume2, VolumeX, Compass } from "lucide-react";
import { useForestStore, lookRef } from "../store";

export function WalkControls({ onExit, onRecenter, visible }: { onExit: () => void; onRecenter: () => void; visible: boolean }) {
  const playing = useForestStore((s) => s.walkPlaying);
  const setPlaying = useForestStore((s) => s.setWalkPlaying);
  const sound = useForestStore((s) => s.soundOn);
  const setSound = useForestStore((s) => s.setSoundOn);

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-between p-4 transition-opacity duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <button
        type="button"
        onClick={onExit}
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklch,var(--color-parchment)_85%,transparent)] px-3 py-2 text-sm text-forest shadow-soft backdrop-blur-md"
        aria-label="Exit forest"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-[color-mix(in_oklch,var(--color-parchment)_85%,transparent)] px-2 py-1 shadow-soft backdrop-blur-md">
        <IconBtn onClick={() => setPlaying(!playing)} label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </IconBtn>
        <IconBtn
          onClick={() => { lookRef.yaw = 0; lookRef.pitch = 0; onRecenter(); }}
          label="Recenter"
        >
          <Compass className="h-4 w-4" />
        </IconBtn>
        <IconBtn onClick={() => setSound(!sound)} label={sound ? "Mute" : "Sound on"}>
          {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full text-forest hover:bg-mist"
    >
      {children}
    </button>
  );
}
