# Patterns

> 검증된 코드/제작 패턴. 복붙 바로 가능한 형태로 유지. (Voyager 시절의 3D 리깅, 눈 산, 소금사막, Mixamo 패턴은 기능이 사라져 삭제함.)

## 모바일 기준 화면을 넓은 브라우저에서 유지

**사용 시점:** 앱 자체가 세로 모바일 화면을 기준으로 하고 데스크톱에서 가로로 확장되면 안 될 때.

앱 컨테이너에 `width: 100%; max-width: 420px; margin-inline: auto`를 적용한다. 휴대폰에서는 가용 폭을 그대로 쓰고 넓은 화면에서는 가운데 정렬한다.

## Stable IDs for file-backed built-in entries

When a built-in entry is loaded from a file and its ID is used for selection or persistence, derive the ID from the stable filename during loading (`BUILTIN_MAPS` in `src/main.ts`). Do not assume the content file contains that ID; otherwise several entries can share `undefined` and the selection cannot be saved.

## A picture on a cylindrical wall (panorama)

- The wall is a cylinder (`CylinderGeometry`, open, double-sided, `scale.x = -1` to read left to right) 150 m away. Map the picture **per pixel** in the fragment shader. A vertex-shader remap (for example a `clamp` on `uv.y`) is interpolated between the two end vertices and silently stretches the whole picture.
- Extend the wall below the picture and stretch the picture's last row there (clamp the row in the fragment shader), so the scenery reaches the bottom of the screen.
- Place the wall from a row of the picture, not from its horizon: put the row `scenery.stand` (the sand) at the height where the figure's feet appear: `rowY = camY - R * tan(atan((camY - feetY) / dist))`, centre = `rowY - H/2 + stand*H - E/2`. Compute it for the figure's resting feet, **before** the figure is lowered, so moving the figure never moves the scenery.
- Measure the sand row of a new picture from its pixels (warm, bright, not blue, in the middle third) and add about 0.06: white foam looks like sand.

## A round disc under a wide-angle projection (moon)

An angular disc (`length(vec2(dot(d, right), dot(d, up)) / size)`) becomes an oval near the edges of a rectilinear picture. Measure it in the screen plane instead: `p(d) = vec2(dot(d, R), dot(d, U)) / dot(d, F)`, and compare `p(d)` with `p(moonDir)` (uniforms `uCamR/U/F`, set from the camera each frame). Keep the disc dimmer than the bloom threshold (about 0.5 before the dome's x1.9) and let the glow start at the rim; otherwise it turns into a hazy white blob.

## Aligning pictures of different shapes (figures)

Give each picture its person's head as `[x, y, diameter]` (fractions of the square picture) and its lowest drawn row. Scale by `refDiameter / diameter` (clamped 0.8 to 1.5), put the head at the reference head, then lift the picture if its bottom would fall below the reference ground line. Floating pictures hover 10 cm above that line and bob around it.

## Figure pictures: Krea 2, Qwen Edit shadow removal, BiRefNet matting

Krea 2 Turbo draws the anime figure on a flat green background (no negative prompt works with the Turbo models, so the model keeps drawing a cast shadow). Qwen Image Edit 2511 lightning (4 steps) "removes the cast shadow ... uniform flat pure green". The ComfyUI-RMBG node `BiRefNetRMBG` (BiRefNet-matting; pass every optional input, `background: "Alpha"`) gives a true alpha. Crop to the subject and save a square 768 px WebP.

## Panorama with the sky cut out (Qwen Edit + magenta matte)

Krea 2 draws the anime panorama (1792x768). Qwen Image Edit paints the whole sky flat **magenta** (not green: the scenery is full of green leaves), also between the leaves. `scripts/figures/3-cut-sky.py` turns the magenta into a soft matte: border-connected magenta is sky, magenta pieces next to the sky are sky, the rim is un-mixed and its colors come from the nearest solid pixel (no pink halo). Two per-picture switches exist because Qwen sometimes paints parts of the scenery too: `STRICT` (bali: a magenta-tinted far volcano stays) and `REPAIR` (hawaii: stray magenta on a peak is repaired from the nearest clean pixel). Check every new panorama with the count of opaque magenta pixels left in the output.

## Krea 2 Turbo in ComfyUI core nodes

`UNETLoader` (krea2_turbo_nvfp4) + `CLIPLoader` type `krea2` (qwen3vl_4b_fp8_scaled) + `VAELoader` (qwen_image_vae) + `ConditioningZeroOut` as the negative, `KSampler` 8 steps, cfg 1, euler/simple. Model names on Windows contain a single backslash: write `"Krea\\krea2_turbo_nvfp4.safetensors"` in a JS file, and never inside an unquoted shell heredoc (the shell eats the backslash).

## Tilting the view without moving the world

Keep the camera position fixed and move only the `lookAt` height: `lookAtY = camY - 0.575 + 11.94 * tan(tilt)` (the resting view looks 2.8 degrees down; 11.94 m is the horizontal distance to the look-at point). The panorama is placed for the resting view, so tilting never moves the scenery relative to the figure. The sky pictures cover 55 degrees; mirror the picture row above that (`v = 1 - abs(1 - elevation/55deg)`) instead of clamping it (a clamp stretches the last row into streaks). Tilt up to about 0.8 rad. Drag events: down means look up; ignore `clientX`.

## Testing the scene quickly

`npm run dev` exposes `window.__world` and `window.__sound`. In the page, `await import('/src/figures.ts')` gives the same module instance, so `__world.setFigure(f.file, f)` switches figures without a reload. To test a time of day, add a custom map with `sky.hour` to the settings (`PUT /api/settings`, same-origin JSON) and reload. Reset `data/settings.json` afterwards.
