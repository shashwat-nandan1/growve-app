# Growve overhaul — proposed staging

Your brief spans ~10 phases across auth, routing, 3D, audio assets, controls, and testing. That is realistically several days of build-verify-iterate work, and a few items need decisions from you before I start writing code.

## Decisions I need from you

1. **3D tree assets.** You require real GLB tree models (oak, pine, birch, willow, Japanese maple, cherry blossom) with LOD variants, KTX2/Draco compression, and an attribution file. I cannot author or license production 3D models from inside the sandbox. Options:
   - (a) You upload a set of GLBs (with licences) and I wire them in.
   - (b) I use a specific CC0 pack you point me at (URL) and I download + commit them.
   - (c) I ship a stylised-but-real geometry upgrade (trunk + branch + foliage meshes, per-species silhouettes, PBR materials, wind shader, LOD/instancing) without external GLBs. This is genuinely 3D, mobile-safe, and not primitives — but not photoreal.
2. **Audio assets.** Same constraint — I need real files. Options:
   - (a) You upload OGG/MP3 loops + one-shots.
   - (b) Point me at a specific CC0 pack (Freesound collection, Kenney, etc.) and I download + attribute.
3. **Scope of this turn.** I recommend splitting delivery so each phase is verifiable rather than one giant unreviewable change. Proposed order:

## Execution plan

**Turn A (this next turn) — Phases 1, 2, 4**
- Rewrite `AuthProvider` as a status state machine (`initializing | authenticated | unauthenticated | recoverable_error | error`), single `onAuthStateChange`, `getUser()` validation with network-vs-invalid distinction, timeout, `finally`-guaranteed exit.
- Move all side effects (navigate, signOut, cache clear, forest store/audio reset) out of render into effects/handlers. Fix protected gate.
- Add `ensure_profile` migration (idempotent, preserves user-edited display_name/bio, sets defaults, authenticated-only EXECUTE).
- Restructure routes: `friends.tsx` becomes layout with `<Outlet/>`; move current page to `friends.index.tsx`; keep `friends.add.tsx`. Same treatment for forest if needed. Regenerate route tree.
- Remove Description field from New Habit (keep DB column).

**Turn B — Phase 3 + Phase 6 (geometry upgrade path 1c unless you pick 1a/1b) + Phase 9 perf**
- Extract `ForestOverview3D` shared component; mount on Today with reduced DPR, pause-on-hidden, no audio, Enter Forest CTA that unlocks audio + navigates.
- Rework tree rendering: per-species trunk/branch/foliage meshes, instanced, LOD by distance, vertex-shader wind (fix the "whole canopy rotates" bug), textured ground, ferns/stones/grass instances, fog, canopy shadows.
- Adaptive DPR, chunked culling, cleanup on unmount.

**Turn C — Phases 5, 7, 8, 10**
- Real audio integration (depends on your answer to #2): unlock on gesture, ambient/effects groups, fades, visibility pause, footsteps tied to actual velocity, Settings toggle wired through.
- Free-roam controller: pointer-events joystick (left), look drag (right), WASD/arrows, yaw-relative movement with accel/damping, trunk collision via spatial hash, bounds, tap-to-open-plaque preserved. Auto Wander becomes optional.
- Full-screen forest routes (owner + friend) share one engine, no AppShell, Exit/Sound/Auto-Wander controls.
- Manual QA pass against your checklist; `tsc --noEmit`, lint, build, 360px check.

## Please confirm

- Which asset option for **trees** (1a / 1b / 1c)?
- Which asset option for **audio** (2a / 2b)?
- OK to proceed Turn A immediately after you answer, then Turn B, then Turn C?

Once you answer, I'll start Turn A right away.
