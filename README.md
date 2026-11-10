# Paradise

Paradise is a quiet escape. A small anime picture of someone seen from behind (on a sun lounger, a cloud, a flying carpet, a drone, a hot air balloon, a swing, a boat, a whale, a swan float or a surfboard) rests on an anime beach, under a sky that follows the time of day: clouds by day, a large round moon that crosses the sky at night, stars and sometimes an aurora. Music and ambient sound play along.

The settings, music player, audio controls, time zone and day-length settings, map importer, authoring page, persistence, web build, Android shell and desktop app follow the Voyager project, minus the walking and the 3D character.

## Development

```bash
npm install
npm run dev      # Vite on http://127.0.0.1:5187, proxying /api to the local server
npm run build    # type check + production build into dist/
npm test         # map validator and server tests
```

`start.bat` / `stop.bat` build and start (or stop) the local server on port 4317 (`start.bat dev` runs Vite with auto-restart).

Other build scripts: `npm run app:build` (Android web copy) and `npm run desktop:build` (Electron installer).

## What is in the box

- **Six maps** (Maldives, Hawaii, Bali, Bora Bora, Thai beach, Ha Long Bay): an anime panorama with its sky cut out, so the real sky, sun, moon and stars show behind the scenery. Add your own with the "+" card in the settings, or author them on the PC in `/studio.html`. Map JSON is `paradise.map/1`.
- **Ten figures** in `public/figures`: pictures with a transparent background. Pick one in the profile pop-up; drop a new picture in the folder to offer it. All of them sway; all but the sun lounger also float. The right-hand button toggles sway (waves: swaying, anchor: still); swaying uses up the hearts (stamina) at the top left, an empty heart freezes the figure until it has recovered.
- **Skies**: 7 day, 7 night and 7 aurora pictures (anime), picked at random at every dusk and dawn; an anime moon that rises on the right, climbs and sets on the left.
- The view is fixed: it cannot be moved in any direction. The UI is Korean.
- **Making a map**: hand `map 제작.md` to an LLM ("make a ... map") and import the JSON with the "+" card; `docs/spec.md` has the format.

## Pictures

Every picture is made on the author's PC with a local ComfyUI (Krea 2, Qwen Image Edit, BiRefNet). The scripts are in `scripts/figures/`; the recipe is in [docs/ASSETS.md](docs/ASSETS.md), the file formats in [docs/spec.md](docs/spec.md), and how the scene is built in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
