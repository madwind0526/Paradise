# Paradise

> Working directory: `E:\Claude\Paradise`

## Project Overview

A stationary, relaxing scene. A small anime picture of a person seen from behind (a "figure": on a sun lounger, a cloud, a flying carpet, a drone, ...) rests on an anime beach panorama whose sky is cut out, under a sky that follows the time of day (anime sky pictures, an anime moon that crosses the view, stars, aurora). Music, menus, settings, persistence and the authoring flow follow Voyager. There is no 3D character and no walking; the view cannot be turned sideways, and dragging up and down only tilts it.

## Tech Stack

TypeScript + Vite, Three.js, Capacitor Android, Electron desktop, and a plain Node HTTP server. No UI framework.

## Commands

```bash
npm run dev      # Vite on :5187 (proxies /api to :4317)
npm run build    # tsc --noEmit + vite build
npm test         # node --test test/*.test.mjs
start.bat        # build and start the server on :4317 (stop.bat stops it)
```

## Map of the code

| Path | What |
|---|---|
| `src/main.ts` | HUD, pop-ups, clock loop, music, map and figure selection |
| `src/world.ts` | the three.js scene: sky, moon, panorama wall, figure |
| `src/figures.ts` | the figure list and, per figure, where the person's head is (`LOOK`) |
| `shared/spec.mjs` | map validator (app, studio, server, tests) |
| `server/index.mjs` | local server: settings, added maps, music explorer, lists of figures and skies |
| `public/` | figures, resort panoramas, maps, sky pictures, sounds |
| `scripts/figures/` | the ComfyUI scripts that make the pictures |
| `docs/` | `ARCHITECTURE.md`, `ASSETS.md`, `spec.md` |
| `map 제작.md` | the guide to hand to an LLM to make a map (tested against the validator) |

## Rules

- Code comments are English; visible UI text is Korean.
- All pictures are anime illustrations made locally with ComfyUI (Krea 2, Qwen Image Edit, BiRefNet); scripts are in `scripts/figures/` (see `docs/ASSETS.md`). Do not add third-party photographs or 3D models.
- Figures are transparent pictures without baked shadows. A new figure needs its `head` and `bottom` entries in `src/figures.ts`.
- Map panoramas have their sky cut out, show mostly nature (buildings tiny and far away) and need a `scenery.stand` row on the sand, so the figure never stands in the sea.
- Keep `memory-bank/active-context.md` lean and flush CACHE after each completed wave.
- Do not copy machine-specific build caches or local paths into releases.
