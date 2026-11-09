# Paradise

Paradise is a quiet escape: a small picture of someone seen from behind (on a sun lounger, a cloud, a flying carpet, a drone, a hot air balloon, ...) floats in front of a misty resort view, under a sky that follows the time of day, with music and ambience.

The settings, music player, audio controls, time zone and day-length settings, map importer, authoring page, persistence, web build, Android shell and desktop app follow the Voyager project, minus the walking.

## Development

```bash
npm install
npm run dev
npm run build
npm test
```

`start.bat` / `stop.bat` start and stop the local server (port 4317).

## Maps and figures

- Six built-in maps (Maldives, Santorini, Amalfi, Bora Bora, Ha Long Bay, Bali): a panorama with its sky cut out, over a sea of clouds. Add your own with the "+" card in the settings, or author them in `/studio.html`. Map JSON is `paradise.map/1`.
- Figures: pictures with a transparent background in `public/figures`. Pick one in the profile pop-up; drop a new picture in the folder to offer it.
- All pictures were generated locally; see `docs/ASSETS.md` and `docs/spec.md`.
