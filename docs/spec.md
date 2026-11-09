# Paradise content standard

Two kinds of content, both plain files: **maps** (the scenery) and **figures** (the picture of the person).

## Map — `paradise.map/1`

A JSON file validated by `shared/spec.mjs` (the same code runs in the app, the studio, the server and the tests). Only `schema` and `name` are required; everything else has a default (values are 0..1 unless noted).

```json
{
  "schema": "paradise.map/1", "name": "하와이", "author": "Paradise",
  "thumb": "/resorts/hawaii-card.jpg",
  "sky": { "clouds": 0.3, "haze": 0.2, "blue": 0.7, "stars": 1, "nightPhotos": "night" },
  "scenery": { "photo": "/resorts/hawaii.webp", "mountains": "", "horizon": 0.44, "cloud": "#f3f8ff" },
  "ambience": { "wind": 0.4, "birds": 0.35, "insects": 0.3 }
}
```

| field | meaning |
|---|---|
| `sky.clouds` `sky.haze` `sky.blue` | cloud cover, milky haze, blueness of the daytime sky |
| `sky.stars` | star brightness at night |
| `sky.hour` | 0-24: keeps this time of day for ever (for example 17.9 = sunset); without it the map follows the clock |
| `sky.picture` | a sky picture of your own, a path like `/sky/maps/name.jpg`; it replaces the random day pictures |
| `sky.nightPhotos` | folder under `public/sky` that the night pictures come from (default `night`) |
| `scenery.photo` | the panorama behind the figure: a path under `/resorts/` (`.webp`, `.png` or `.jpg`) |
| `scenery.mountains` | optional far mountains behind the panorama, three hazy strips peeking over the sea line. Use them for land views only: over open sea they look like they float on the water, so no built-in map uses them: `blue` (the blue ridges of the old salt desert), `snow`, `rock`, `forest` or `green`; empty = none |
| `scenery.horizon` | where the picture's sea line sits, as a fraction of its height from the top (default 0.45) |
| `scenery.cloud` | color of the sea of clouds, `#rrggbb`; it only shows on a map without a panorama (with one, the scenery reaches the bottom of the screen and the figure sits on it) |
| `ambience.wind` `birds` `insects` | wind level (also moves the clouds), birds (day), insects (night) |

`thumb` (the card picture) is honored for built-in maps only; maps added in the app get a card taken from their own scene. At most 9 maps are kept in the app (built-ins included). Maps added in the app are also saved as files in `public/maps/added/` (with a card `.jpg`); deleting a map in the app only removes it from the list.

### The panorama picture

A wide picture (about 7:3, for example 1792x768) with the sky **cut out**: a WebP or PNG whose sky is transparent, so the real sky, sun, moon and stars show behind the scenery and change with the time. The bottom edge fades into the clouds, so mist there looks natural. `scripts/figures/` has the scripts that make such a picture (see `docs/ASSETS.md`).

## Figure — a picture in `public/figures`

A figure is one square anime picture (WebP or PNG with a transparent background) of a person seen from behind on a seat of the sky: a sun lounger, a cloud, a flying carpet, a drone, ... The profile pop-up lists every `.png`/`.webp` in `public/figures`, so a new figure is just a new file. Only the back of the head should show. Bake no shadows into it: the app tints the picture by the time of day (warm at dusk, dark at night) and the figure floats, so there is no ground to cast a shadow on.

## Maps from an LLM

Give a language model the table above and ask for a map JSON; the "+" card in the settings imports a `.json` file. Only the keys above are accepted.
