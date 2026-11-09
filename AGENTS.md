# Paradise

> Working directory: `E:\Claude\Paradise`

## Project Overview

A stationary, relaxing scene. A picture of a person seen from behind (a "figure": on a sun lounger, a cloud, a flying carpet, a drone, ...) floats in front of a misty resort panorama, over a sea of clouds, under a sky that follows the time of day. Music, menus, settings, persistence and the authoring flow follow Voyager. There is no 3D character and no walking.

## Tech Stack

TypeScript + Vite, Three.js, Capacitor Android, Electron desktop, and a plain Node HTTP server. No UI framework.

## Commands

```bash
npm run dev
npm run build
npm test
start.bat
```

## Rules

- Code comments are English; visible UI text is Korean.
- Figures are transparent pictures without baked shadows; map pictures have their sky cut out and show mostly nature (buildings tiny and far away).
- Pictures are made locally with ComfyUI; the scripts are in `scripts/figures/` (see `docs/ASSETS.md`). Do not add third-party photographs or 3D models.
- Keep `memory-bank/active-context.md` lean and flush CACHE after each completed wave.
- Do not copy machine-specific build caches or local paths into releases.
