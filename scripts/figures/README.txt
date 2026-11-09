Picture-making scripts (run on the author's PC with a local ComfyUI at http://127.0.0.1:8188).
Run them from a working folder outside the project; every script writes next to where it is run. See docs/ASSETS.md.

MAP PICTURE (anime panorama with the sky cut out)
  1-gen-panorama.mjs     Krea 2 Turbo draws the panorama                    -> anime/<name>.png
  2-sky-to-magenta.mjs   Qwen Image Edit paints the sky flat magenta        -> anime_m/<name>.png
  3-cut-sky.py           magenta -> transparency (soft matte)               -> anime_out/<name>.webp  (copy to public/resorts)

FIGURE (anime person on a seat of the sky)
  1-gen-figure.mjs       Krea 2 Turbo draws it on a flat green background   -> anime_fig/fig_<name>.png
  2-remove-shadow.mjs    Qwen Image Edit removes the cast shadow            -> anime_fig_qe/fig_<name>.png
  3-cut-figure.mjs       BiRefNet matting gives a real alpha                -> anime_fig_bi/<name>.png
                         then crop to the subject, make it square, save a 768 px WebP in public/figures
                         and add the person's head position to LOOK in src/figures.ts

SKY PICTURE AND MOON
  1-gen-sky.mjs           Krea 2 Turbo anime skies (day, night, aurora; 896x1600)
  describe.mjs           optional: VideoStudioOM QwenVL "describe image" for a reference picture (node describe.mjs out.json files...)

MOON: public/sky/moon.jpg is a Krea 2 Turbo anime full moon on black (1024x1024, prompt: the moon seen straight on as a round disc filling the frame); crop the disc to its bounding box.
