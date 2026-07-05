import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trees as TreesIcon, Sparkle, List } from "lucide-react";
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
import { TreeList } from "./ui/TreeList";
import { Fallback2D } from "./Fallback2D";

type Props = {
  /** When omitted, shows the signed-in user's own forest. */
  ownerId?: string;
  /** Label shown while visiting a friend's forest. */
  ownerLabel?: string;
  /** When true, hides the "Enter forest" button and walk mode. */
  previewOnly?: boolean;
  /** When true, mount directly in immersive walk mode. */
  startInWalkMode?: boolean;
  /** Called when the user exits walk mode; overrides in-app overview return. */
  onExit?: () => void;
};

export function ForestExperience({ ownerId, ownerLabel, previewOnly, startInWalkMode, onExit }: Props = {}) {
  const { user } = useAuth();
  const profile = useProfile();
  const targetOwner = ownerId ?? user?.id;
  const isVisitor = !!ownerId && ownerId !== user?.id;
  const forest = useForestData(targetOwner);

  const userReduced = !!profile.data?.reduced_motion;
  const userSound = profile.data?.sound_enabled ?? true;
  const reducedMotion = userReduced || prefersReducedMotion();
  const webglOk = useMemo(() => hasWebGL(), []);
  const [showList, setShowList] = useState(false);

  const mode = useForestStore((s) => s.mode);
  const setMode = useForestStore((s) => s.setMode);
  const selected = useForestStore((s) => s.selected);
  const setSelected = useForestStore((s) => s.setSelected);
  const soundOn = useForestStore((s) => s.soundOn);
  const qualityMode = useForestStore((s) => s.quality);
  const quality = useMemo(() => resolveQuality(qualityMode), [qualityMode]);
  const dpr = dprCap(quality);

  useEffect(() => {
    if (!userSound) { forestAudio.setMuted(true); return; }
    forestAudio.setMuted(!soundOn);
  }, [soundOn, userSound]);

  useEffect(() => {
    return () => { forestAudio.dispose(); useForestStore.getState().setMode("overview"); };
  }, []);

  // Reset selection & mode when switching owners
  useEffect(() => {
    useForestStore.getState().setMode(startInWalkMode ? "walk" : "overview");
    useForestStore.getState().setSelected(null);
    if (startInWalkMode) {
      // Best-effort start of ambient audio when explicitly launched into walk.
      if (userSound) { useForestStore.getState().setSoundOn(true); forestAudio.start().catch(() => {}); }
    }
  }, [targetOwner, startInWalkMode, userSound]);

  const recentTree = useMemo(() => {
    const list = forest.data?.trees ?? [];
    return list.length ? list[list.length - 1] : null;
  }, [forest.data]);

  if (forest.isLoading || profile.isLoading) {
    return (
      <div className="grid h-[360px] place-items-center rounded-3xl border border-border bg-mist">
        <div className="text-center">
          <div className="mx-auto h-2 w-24 animate-pulse rounded-full bg-sage/60" />
          {ownerLabel && (
            <p className="mt-3 text-xs text-muted-foreground">Wandering into {ownerLabel}'s forest…</p>
          )}
        </div>
      </div>
    );
  }

  if (forest.error) {
    const code = (forest.error as Error & { code?: string }).code;
    if (code === "forest_not_visible") {
      return (
        <div className="grove-card grid min-h-[240px] place-items-center p-8 text-center">
          <div>
            <p className="font-display text-lg text-forest">A quiet clearing</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {ownerLabel ? `${ownerLabel} keeps this forest private.` : "This forest is private."}
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="grove-card grid min-h-[240px] place-items-center p-8 text-center">
        <p className="text-sm text-muted-foreground">Couldn't reach this forest right now.</p>
      </div>
    );
  }

  const trees = forest.data?.trees ?? [];
  const tooManyTrees = trees.length > 4000;
  const use3D = webglOk && !tooManyTrees && !showList;

  if (!use3D) {
    return (
      <div>
        <Fallback2D
          trees={trees}
          reason={
            showList
              ? undefined
              : !webglOk
                ? "3D is unavailable on this device — showing the grove view."
                : "Forest is large — showing the grove view."
          }
        />
        {showList && <TreeList trees={trees} ownerLabel={ownerLabel} />}
        <div className="mt-3 flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => setShowList((v) => !v)} className="text-moss">
            <List className="mr-1.5 h-4 w-4" />
            {showList ? "Hide tree list" : "Show tree list"}
          </Button>
        </div>
      </div>
    );
  }

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
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
            {isVisitor && ownerLabel && (
              <div className="pointer-events-auto rounded-full bg-[color-mix(in_oklch,var(--color-parchment)_88%,transparent)] px-3 py-1.5 text-xs text-forest shadow-soft backdrop-blur-md">
                Visiting <span className="font-medium">{ownerLabel}</span>
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
            <div className="pointer-events-auto rounded-full bg-[color-mix(in_oklch,var(--color-parchment)_88%,transparent)] px-3 py-1.5 text-xs text-forest shadow-soft backdrop-blur-md">
              <span className="font-medium">{trees.length}</span> trees
              {recentTree && (
                <span className="ml-2 inline-flex items-center gap-1 text-moss">
                  <Sparkle className="h-3 w-3" />
                  newest {new Date(recentTree.planted_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
            {!previewOnly && trees.length > 0 && (
              <Button
                size="sm"
                onClick={async () => {
                  if (userSound) { useForestStore.getState().setSoundOn(true); await forestAudio.start(); }
                  setMode("walk");
                }}
                className="pointer-events-auto rounded-full bg-forest text-parchment hover:bg-forest/90"
                aria-label={ownerLabel ? `Walk into ${ownerLabel}'s forest` : "Enter your forest"}
              >
                <TreesIcon className="mr-1.5 h-4 w-4" />
                {ownerLabel ? "Wander in" : "Enter forest"}
              </Button>
            )}
          </div>
        </div>
        {trees.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {isVisitor
              ? `${ownerLabel ?? "This friend"} hasn't planted a tree yet.`
              : "Your forest is a clearing — tend a habit to plant your first tree."}
          </p>
        )}
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => setShowList(true)} className="text-moss">
            <List className="mr-1.5 h-4 w-4" /> Show tree list
          </Button>
        </div>
      </div>
    );
  }

  return (
    <WalkOverlay
      quality={quality}
      dpr={dpr}
      reducedMotion={reducedMotion}
      forest={forest.data!}
      selected={selected}
      setSelected={setSelected}
      ownerLabel={ownerLabel}
      onExit={() => (onExit ? onExit() : setMode("overview"))}
    />
  );
}

function WalkOverlay({
  quality, dpr, reducedMotion, forest, selected, setSelected, ownerLabel, onExit,
}: {
  quality: "low" | "high";
  dpr: [number, number];
  reducedMotion: boolean;
  forest: NonNullable<ReturnType<typeof useForestData>["data"]>;
  selected: ReturnType<typeof useForestStore.getState>["selected"];
  setSelected: ReturnType<typeof useForestStore.getState>["setSelected"];
  ownerLabel?: string;
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
      role="application"
      aria-label={ownerLabel ? `Walking in ${ownerLabel}'s forest` : "Walking in your forest"}
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

      {ownerLabel && uiVisible && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
          <div className="rounded-full bg-[color-mix(in_oklch,var(--color-parchment)_88%,transparent)] px-4 py-1.5 text-sm text-forest shadow-soft backdrop-blur-md">
            Visiting <span className="font-medium">{ownerLabel}</span>
          </div>
        </div>
      )}

      <WalkControls
        visible={uiVisible}
        onExit={() => { forestAudio.dispose(); onExit(); }}
        onRecenter={() => { useForestStore.getState().setWalkProgress(0); }}
      />

      {selected && <Plaque tree={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
