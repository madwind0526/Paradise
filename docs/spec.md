# Paradise content standard

Two kinds of content, both plain files: **maps** (the scenery) and **figures** (the picture of the person).

## Map — `paradise.map/1`

A JSON file validated by `shared/spec.mjs` (the same code runs in the app, the studio, the server and the tests). Only `schema` and `name` are required; everything else has a default (values are 0..1 unless noted).

```json
{
  "schema": "paradise.map/1", "name": "하와이", "author": "Paradise",
  "thumb": "/resorts/hawaii-card.jpg",
  "sky": { "clouds": 0.4, "haze": 0.15, "blue": 0.75, "stars": 1, "nightPhotos": "night" },
  "scenery": { "photo": "/resorts/hawaii.webp", "stand": 0.85, "cloud": "#f6f9ff" },
  "ambience": { "wind": 0.4, "birds": 0.45, "insects": 0.35 }
}
```

| field | meaning |
|---|---|
| `sky.clouds` `sky.haze` `sky.blue` | cloud cover, milky haze, blueness of the daytime sky |
| `sky.stars` | star brightness at night |
| `sky.hour` | 0-24: keeps this time of day for ever (for example 17.9 = sunset); without it the map follows the clock |
| `sky.picture` | a sky picture of your own, a path like `/sky/maps/name.jpg`; it replaces the random day pictures |
| `sky.nightPhotos` | folder under `public/sky` that the night pictures come from: `night` (default) or `aurora` (the Ha Long Bay map) |
| `scenery.photo` | the panorama behind the figure: a path under `/resorts/` (`.webp`, `.png` or `.jpg`) |
| `scenery.stand` | the row of the picture, as a fraction of its height from the top (0 top .. 1 bottom), where the figure stands: put it on the sand, not in the sea (default 0.85; measure where the sand starts in the middle of the picture and add a little). The picture is shifted so that this row is at the feet of the figure |
| `scenery.cloud` | color of the sea of clouds, `#rrggbb`; it only shows on a map without a panorama (with one, the scenery reaches the bottom of the screen and the figure sits on it) |
| `ambience.wind` `birds` `insects` | wind level (also moves the clouds), birds (day), insects (night) |

`thumb` (the card picture) is honored for built-in maps only; maps added in the app get a card taken from their own scene. At most 9 maps are kept in the app (built-ins included). Maps added in the app are also saved as files in `public/maps/added/` (with a card `.jpg`); deleting a map in the app only removes it from the list.

### The panorama picture

A wide picture (about 7:3, for example 1792x768) with the sky **cut out**: a WebP or PNG whose sky is transparent, so the real sky, sun, moon and stars show behind the scenery and change with the time. The scenery reaches the bottom of the screen (the app stretches the last row of the picture below it). Keep buildings tiny and far away, and give it trees, sea and sand in front. `scripts/figures/` has the scripts that make such a picture (see `docs/ASSETS.md`).

## Figure — a picture in `public/figures`

A figure is one square anime picture (WebP or PNG with a transparent background) of a person seen from behind on a seat of the sky: a sun lounger, a cloud, a flying carpet, a drone, ... The profile pop-up lists every `.png`/`.webp` in `public/figures`, so a new figure is just a new file. Only the back of the head should show. The app places the person where the person of the sun lounger sits and makes everything except the lounger bob and sway; for a new picture add its `head` (x, y, diameter) and `bottom` to `LOOK` in `src/figures.ts` (a picture without them is simply put on the ground line). Bake no shadows into it: the app tints the picture by the time of day (warm at dusk, a cool moonlit tone at night) and the figure floats, so there is no ground to cast a shadow on.

## Maps from an LLM

Give a language model the guide `map 제작.md` (in Korean, with the rules, the field table, the list of panoramas with their `stand` values, recipes and samples) and ask for a map; the "+" card in the settings imports the `.json` file. Only the keys above are accepted. `npm test` checks that every JSON block in the guide is valid and that its `stand` values match the built-in maps.
