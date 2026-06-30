import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trees as TreesIcon, Sparkle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { useForestData } from "./data";
import { useForestStore, lookRef } from "./store";
import { hasWebGL, prefersReducedMotion, resolveQuality, dprCap } from "./performance";
import { forestAudio } from "./audio";
import { CanopyOverview } from "./scene/CanopyOverview";
import { ForestWalk } from "./scene/ForestWalk";
import { WalkControls } from "./ui/Controls";
import { Plaque } from "./ui/Plaque";
import { Fallback2D } from "./Fallback2D";

export function ForestExperience() {
  const { user } = useAuth();
  const profile = useProfile();
  const forest = useForestData(user?.id, profile.data?.forest_seed ?? undefined);

  const userReduced = !!profile.data?.reduced_motion;
  const userSound = profile.data?.sound_enabled ?? true;
  const reducedMotion = userReduced || prefersReducedMotion();
  const webglOk = useMemo(() => hasWebGL(), []);

  const mode = useForestStore((s) => s.mode);
  const setMode = useForestStore((s) => s.setMode);
  const selected = useForestStore((s) => s.selected);
  const setSelected = useForestStore((s) => s.setSelected);
  const soundOn = useForestStore((s) => s.soundOn);
  const qualityMode = useForestStore((s) => s.quality);
  const quality = useMemo(() => resolveQuality(qualityMode), [qualityMode]);
  const dpr = dprCap(quality);

  // Drive Howler from store + profile preferences.
  useEffect(() => {
    if (!userSound) { forestAudio.setMuted(true); return; }
    forestAudio.setMuted(!soundOn);
  }, [soundOn, userSound]);

  useEffect(() => {
    return () => { forestAudio.dispose(); useForestStore.getState().setMode("overview"); };
  }, []);

  const recentTree = useMemo(() => {
    const list = forest.data?.trees ?? [];
    return list.length ? list[list.length - 1] : null;
  }, [forest.data]);

  // Decide whether to use 3D at all
  const tooManyTrees = (forest.data?.trees.length ?? 0) > 4000;
  const use3D = webglOk && !tooManyTrees;

  if (forest.isLoading || profile.isLoading) {
    return <div className="grid h-[360px] place-items-center"><div className="h-2 w-24 animate-pulse rounded-full bg-sage/40" /></div>;
  }

  if (!use3D) {
    return (
      <Fallback2D
        trees={forest.data?.trees ?? []}
        reason={!webglOk ? "3D is unavailable on this device — showing the grove view." : "Forest is large — showing the grove view."}
      />
    );
  }

  // Overview embedded card
  if (mode === "overview") {
    return (
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-mist shadow-soft">
          <div className="h-[360px] w-full">
            <Canvas
              dpr={dpr}
              shadows={quality === "high"}
              gl={{ antialias: quality === "high", powerPreference: "high-performance", alpha: false, stencil: false, depth: true }}
              camera={{ position: [20, 16, 20], fov: 45, near: 0.5, far: 120 }}
              onCreated={({ gl }) => { gl.setClearColor("#dde3da"); }}
              frameloop="always"
            >
              {forest.data && <CanopyOverview data={forest.data} quality={quality} reducedMotion={reducedMotion} />}
            </Canvas>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
            <div className="pointer-events-auto rounded-full bg-[color-mix(in_oklch,var(--color-parchment)_88%,transparent)] px-3 py-1.5 text-xs text-forest shadow-soft backdrop-blur-md">
              <span className="font-medium">{forest.data?.trees.length ?? 0}</span> trees
              {recentTree && (
                <span className="ml-2 inline-flex items-center gap-1 text-moss">
                  <Sparkle className="h-3 w-3" />
                  newest {new Date(recentTree.planted_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
            <Button
              size="sm"
              onClick={async () => {
                if (userSound) { useForestStore.getState().setSoundOn(true); await forestAudio.start(); }
                setMode("walk");
              }}
              className="pointer-events-auto rounded-full bg-forest text-parchment hover:bg-forest/90"
            >
              <TreesIcon className="mr-1.5 h-4 w-4" />
              Enter forest
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Walk mode — fullscreen overlay
  return <WalkOverlay quality={quality} dpr={dpr} reducedMotion={reducedMotion} forest={forest.data!} selected={selected} setSelected={setSelected} onExit={() => setMode("overview")} />;
}

function WalkOverlay({
  quality, dpr, reducedMotion, forest, selected, setSelected, onExit,
}: {
  quality: "low" | "high";
  dpr: [number, number];
  reducedMotion: boolean;
  forest: NonNullable<ReturnType<typeof useForestData>["data"]>;
  selected: ReturnType<typeof useForestStore.getState>["selected"];
  setSelected: ReturnType<typeof useForestStore.getState>["setSelected"];
  onExit: () => void;
}) {
  const [uiVisible, setUiVisible] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);

  const armIdle = () => {
    setUiVisible(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setUiVisible(false), 3500);
  };

  useEffect(() => {
    armIdle();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock body scroll while walking
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = { x: e.clientX, y: e.clientY };
    armIdle();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.x;
    const dy = e.clientY - dragging.current.y;
    dragging.current = { x: e.clientX, y: e.clientY };
    lookRef.yaw += -dx * 0.005;
    lookRef.pitch = Math.max(-0.5, Math.min(0.5, lookRef.pitch + -dy * 0.003));
  };
  const onPointerUp = () => { dragging.current = null; };

  return (
    <div
      className="fixed inset-0 z-40 bg-[#dde3da]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
      onClick={armIdle}
    >
      <Canvas
        dpr={dpr}
        shadows={quality === "high"}
        gl={{ antialias: quality === "high", powerPreference: "high-performance", alpha: false, stencil: false, depth: true }}
        camera={{ position: [0, 1.6, 0], fov: 60, near: 0.1, far: 100 }}
        frameloop="always"
      >
        <ForestWalk data={forest} quality={quality} reducedMotion={reducedMotion} />
      </Canvas>

      <WalkControls
        visible={uiVisible}
        onExit={() => { forestAudio.dispose(); onExit(); }}
        onRecenter={() => { useForestStore.getState().setWalkProgress(0); }}
      />

      {selected && <Plaque tree={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
