# Architecture

## Overview

Paradise is a single-page app (`index.html` + `src/main.ts`) with a PC authoring page (`studio.html` + `src/studio.ts`) and a small Node server. There is no UI framework: the HUD is plain DOM built with `h()` helpers in `src/ui.ts`, icons come from `lucide`.

```
browser                                   server (server/index.mjs)
 main.ts    HUD, modals, clock loop  ---> /api/settings      saved settings (data/settings.json)
 world.ts   three.js scene           ---> /api/maps/*        maps added in the app -> public/maps/added
 figures.ts the pictures to choose   ---> /api/figures       list of public/figures
 audio.ts   music + ambience         ---> /api/sky/<folder>  list of sky pictures
 shared/spec.mjs  map validator      ---> /api/fs/*          local music explorer (loopback only)
```

## The scene (`src/world.ts`)

Everything is in front of one fixed camera: the view cannot be dragged or moved.

- **Sky**: three.js `Sky` (physical, with clouds) by day; a dome shader at night with NASA's star map, an anime moon picture, moonlit clouds and meteors. The moon is large and crosses the view once a night (rises on the right at 18:00, about 15 degrees high at midnight, sets on the left at 06:00), so it always stays on the screen. Optional sky photos replace both (mirrored sideways so there is no seam). A haze dome softens the horizon.
- **Cloud deck**: a huge plane with a drifting noise shader (`deckMat`) that fades into the horizon haze. It is shown only on a map without a panorama.
- **Panorama wall** (`photoMat`): a 160 degree cylinder 150 m away carrying the map's picture. The picture has its sky cut out (alpha), so the real sky shows above the scenery; light and night tint it. Its sea line is aligned to the camera height (`scenery.horizon`).
- **Mountains** (`mountainMat`): optional hazy strips (far, middle, near) behind the panorama, standing on its sea line.
- **Figure** (`figureMat`): a plane that always faces the camera and carries the chosen figure picture; it bobs a little, is tinted warm at dusk and dark at night.
- Rendering goes through `EffectComposer` (bloom only at night, then `OutputPass` tone mapping). The domes are pre-multiplied because the output pass tone-maps them.
- Shaders must not use `sin()`-based hashes (GPU precision); use the sine-free `hash()`.

## Audio (`src/audio.ts`)

Two `<audio>` elements (one through a 10-band EQ graph, one direct), a YouTube IFrame player, recorded ambience layers (wind, crickets, forest), shuffle and repeat. Gain nodes start at 0 to avoid a start-up click.

## Maps, figures and content

`shared/spec.mjs` validates map JSON. The `+` card in settings imports a map file, keeps it in `localStorage` and in the server's `public/maps/added/`, and takes a card picture with `World.snapshot()`. See `docs/spec.md`. Figures and panoramas are generated with local AI tools and cut out with scripts: see `docs/ASSETS.md`.

## Server

Plain `node:http`. Binds to loopback by default (`HOST=0.0.0.0` for a phone). Settings, saved maps and the local file explorer only answer requests from the computer itself, the Host header is checked against DNS rebinding, and writes must be same-origin JSON.
