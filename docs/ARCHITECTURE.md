# Architecture

## Overview

Paradise is a single-page app (`index.html` + `src/main.ts`) with a PC authoring page (`studio.html` + `src/studio.ts`) and a small Node server. There is no UI framework: the HUD is plain DOM built with `h()` helpers in `src/ui.ts`, icons come from `lucide`.

```
browser                                   server (server/index.mjs)
 main.ts    HUD, modals, clock loop  ---> /api/settings      saved settings (data/settings.json)
 world.ts   three.js scene           ---> /api/maps/*        maps added in the app -> public/maps/added
 figures.ts the pictures to choose   ---> /api/figures       list of public/figures
 audio.ts   music + ambience         ---> /api/sky/<folder>  list of sky pictures (day, night, aurora)
 shared/spec.mjs  map validator      ---> /api/fs/*          local music explorer (loopback only)
```

Desktop (`desktop/main.cjs`, Electron) and Android (`android/`, Capacitor) wrap the same web build; the phone app has no server, so `scripts/make-index.mjs` writes `public/app-index.json` (figures and sky pictures) at build time.

## The scene (`src/world.ts`)

Everything is in front of one fixed camera (55 degrees, 6 m from the figure). The view cannot be turned sideways; dragging up and down only **tilts** it (`tilt`, from about 7 degrees down to 6 degrees up, so the figure never leaves the screen) to see a little more sky or ground, the camera itself and everything in the world stay put. Draw order, back to front:

- **Sky**: three.js `Sky` (physical, with clouds) by day. A day picture (anime sky) replaces it until the sun is well below the horizon. A sky picture covers 55 degrees above the horizon; above that it is mirrored, so looking far up shows more sky instead of a stretched last row. At night a dome shader draws NASA's star map, the moon, moonlit clouds and meteors, or a night/aurora picture. A haze dome softens the horizon.
- **Moon**: an anime picture of a full moon (`public/sky/moon.jpg`, a disc filling the picture). It is round **on the screen**: the shader measures it in the camera's screen plane (right, up and forward vectors, `uCamR/U/F`), so the wide-angle projection does not stretch it into an oval. It crosses the view once a night: rises on the right at 18:00, about 15 degrees high at midnight, sets on the left at 06:00. Its disc stays below the bloom threshold and its glow only starts at the rim, so it stays crisp. One night in four it is red (`setMoonRed`).
- **Cloud deck** (`deckMat`): a huge plane with a drifting noise shader that fades into the horizon haze. Shown only on a map without a panorama.
- **Panorama wall** (`photoMat`): a 160 degree cylinder 150 m away carrying the map's picture. The picture has its sky cut out (alpha), so the real sky shows above the scenery. The wall reaches 80 m below the picture and stretches the last row there, so the scenery fills the bottom of the screen; the stretch is computed **per pixel** (per vertex it would be interpolated and the whole picture would be stretched). The wall is placed so that the picture row `scenery.stand` (the sand) is at the figure's feet, computed for the figure before it is lowered (`FIGURE_DROP`), so the figure never stands in the sea and the scenery does not move when the figure does.
- **Figure** (`figureMat`): a plane that always faces the camera and carries the chosen picture. `figures.ts` gives, per picture, where the person's head is; the world puts that head where the head of the sun lounger sits (scaling 0.8 to 1.5 times) and never lets the drawing go below the lounger's sand line. Everything except the lounger floats: it hovers 10 cm above the line and bobs and sways. It is tinted warm at dusk and a cool moonlit tone at night.
- Rendering goes through `EffectComposer` (bloom only at night, then `OutputPass` tone mapping). The domes are pre-multiplied because the output pass tone-maps them.
- Shaders must not use `sin()`-based hashes (GPU precision); use the sine-free `hash()`.

Night brightness: the panorama and the figure are multiplied by a cool tone (about 0.6 to 0.8) instead of being darkened to black.

## Audio (`src/audio.ts`)

Two `<audio>` elements (one through a 10-band EQ graph, one direct), a YouTube IFrame player, recorded ambience layers (wind, crickets, forest), shuffle and repeat. Gain nodes start at 0 to avoid a start-up click.

## Maps, figures and content

`shared/spec.mjs` validates map JSON. The `+` card in settings imports a map file, keeps it in `localStorage` and in the server's `public/maps/added/`, and takes a card picture with `World.snapshot()`. See `docs/spec.md`. Figures, panoramas, skies and the moon are generated with local AI tools and cut out with scripts: see `docs/ASSETS.md`.

## Server

Plain `node:http`. Binds to loopback by default (`HOST=0.0.0.0` for a phone). Settings, saved maps and the local file explorer only answer requests from the computer itself, the Host header is checked against DNS rebinding, and writes must be same-origin JSON.

## Web analytics

`index.html` carries the Cloudflare Web Analytics beacon, inherited from Voyager. It is added only when the page is served from `github.io` (the public web version), never in the phone app, the desktop app or a local run. It uses the same Cloudflare token as Voyager, so visits to both apps land in the same Cloudflare site; create a separate site and replace the token in `index.html` if Paradise should be counted on its own.

## Deployment

`.github/workflows/pages.yml` builds the web version (`PARADISE_BASE=/Paradise/`) and publishes it to GitHub Pages on every push to `main`; the studio page is removed from that build.
