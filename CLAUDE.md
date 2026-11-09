# Paradise

> Working directory: `E:\Claude\Paradise`

## Project Overview

A stationary scene: a small anime picture of a person seen from behind (a figure on a sun lounger, a cloud, a flying carpet, a drone, ...) rests on an anime beach panorama with its sky cut out, under a sky that follows the time of day (anime sky pictures, a large round anime moon that crosses the view, stars, aurora). Voyager's UI, time cycle, music, settings, maps, persistence and authoring flow are retained; the 3D character and the walking are gone, and the view cannot be turned sideways (dragging up and down only tilts it).

## Tech Stack

TypeScript, Vite, Three.js, Capacitor, Electron, and Node.js.

## Commands

```bash
npm run dev
npm run build
npm test
start.bat      # build + start the server on :4317; stop.bat stops it
```

`start.bat` and `stop.bat` kill whatever is listening on the project ports first, so a restart is always clean.

## Where things are

See `AGENTS.md` (map of the code) and `docs/ARCHITECTURE.md` (how the scene is built). Content formats are in `docs/spec.md`; how the pictures are made is in `docs/ASSETS.md`.

## Global requirements

- Code comments must be English.
- User-facing UI strings must be Korean.
- Input dialogs must remain scrollable with keyboard and large text.
- UI changes must preserve existing open/save/cancel interactions.
- Read `memory-bank/active-context.md` and `memory-bank/STATE.md` at session start.
- Pictures (figures, panoramas, skies, moon) are made with the local ComfyUI (Krea 2, Qwen Image Edit, BiRefNet) in anime style; the user prefers AI tools (Qwen Image Edit, BiRefNet) over hand-made heuristics for cutting pictures out.
