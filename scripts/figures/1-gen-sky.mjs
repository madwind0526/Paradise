// SKY PICTURE: Krea 2 Turbo anime skies, 896x1600. Run from a working folder with a "sky2" subfolder:  node 1-gen-sky.mjs   (or name some scenes). Names day_*, night_*, aurora_* go to public/sky/day, night (001..) and aurora.
// Palm-beach panoramas with Krea 2 Turbo (ComfyUI core nodes: CLIPLoader type "krea2", Qwen3-VL 4B text encoder, Qwen Image VAE).
import fs from "node:fs";
const API = "http://127.0.0.1:8188";
const BS = String.fromCharCode(92);
const STYLE = "Makoto Shinkai style anime sky illustration, vertical composition, only the sky filling the whole picture, no ground, no mountains, no trees, no buildings, no sun disc, no moon, no text, extremely detailed and beautiful painterly";
const SCENES = {
  day_a: "a vivid blue sky with many scattered fluffy white cumulus clouds with grey-blue shaded undersides, more clouds crowding toward the bottom",
  day_b: "a deep cobalt blue sky with big billowing white clouds heaped together, strong contrast, bright sunlit cloud edges",
  day_c: "a deep blue sky crossed by long feathery white cirrus streaks swept diagonally, a few tiny clouds, the bottom fades to pale blue",
  day_d: "one giant towering white cumulus cloud column filling the picture, soft grey-blue shading inside, a pale blue sky around it",
  day_e: "a pale blue sky with large glowing peach and salmon-pink sunset cumulus clouds with orange lit edges and dusky undersides",
  day_f: "a lavender and violet dusk sky full of pink and magenta clouds with dark purple undersides, the bottom glows orange-pink",
  day_g: "a smooth twilight gradient sky from deep indigo purple at the top through magenta pink to a glowing orange at the bottom, with a few thin streaky clouds",
  night_a: "a deep blue night sky full of tiny stars with a glowing blue and white milky way band and a warm orange-brown dust lane",
  night_b: "a night sky crossed diagonally by a glowing purple and magenta nebula band with pink luminous edges and bright star clusters",
  night_c: "a dark night sky full of stars with a swirling teal and cyan wispy nebula cloud in the middle",
  night_d: "a dark teal night sky filled with huge glowing turquoise nebula tendrils and a scatter of stars",
  night_e: "a black night sky with a crimson red nebula ridge along the left side and one bright blue sparkling star at the upper right",
  night_f: "a dark night sky with scattered stars and a glowing yellow star cluster surrounded by faint golden mist",
  night_g: "a dark blue night sky with sparkling stars and soft white clouds lit by moonlight at the top and the bottom",
  aurora_a: "a purple night sky with stars and a blue, cyan, violet and pink aurora curtain of vertical rays arching across the lower half",
  aurora_b: "a dark night sky with a swirling emerald green aurora ribbon twisting in the middle, stars all around",
  aurora_c: "tall flowing green and turquoise aurora ribbons rising across a deep blue night sky full of stars",
  aurora_d: "a purple starry night sky with a pink and green aurora ribbon twisting upward in the center",
  aurora_e: "a dark blue night sky with sweeping teal and green aurora arcs and faint stars",
  aurora_f: "a night sky with huge sweeping green, cyan and pink aurora bands crossing the whole picture, a pink glow at the bottom",
  aurora_g: "an indigo violet night sky with a faint violet and lime-green aurora curtain and a few stars",
};
const only = process.argv.slice(2);
const wf = (prompt, prefix, seed) => ({
  1: { class_type: "UNETLoader", inputs: { unet_name: `Krea${BS}krea2_turbo_nvfp4.safetensors`, weight_dtype: "default" } },
  2: { class_type: "CLIPLoader", inputs: { clip_name: `Qwen${BS}qwen3vl_4b_fp8_scaled.safetensors`, type: "krea2", device: "default" } },
  3: { class_type: "VAELoader", inputs: { vae_name: `qwen${BS}qwen_image_vae.safetensors` } },
  4: { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["2", 0] } },
  5: { class_type: "ConditioningZeroOut", inputs: { conditioning: ["4", 0] } },
  7: { class_type: "EmptyLatentImage", inputs: { width: 896, height: 1600, batch_size: 1 } },
  8: { class_type: "KSampler", inputs: { model: ["1", 0], seed, steps: 8, cfg: 1, sampler_name: "euler", scheduler: "simple", positive: ["4", 0], negative: ["5", 0], latent_image: ["7", 0], denoise: 1 } },
  9: { class_type: "VAEDecode", inputs: { samples: ["8", 0], vae: ["3", 0] } },
  10: { class_type: "SaveImage", inputs: { images: ["9", 0], filename_prefix: prefix } },
});
const ids = {};
for (const [k, v] of Object.entries(SCENES)) {
  if (only.length && !only.includes(k.replace(/_.*/, "")) && !only.includes(k)) continue;
  const r = await (await fetch(API + "/prompt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: wf(`${v}, ${STYLE}`, "paradise_ksky2_" + k, Math.floor(Math.random() * 1e9)) }) })).json();
  if (!r.prompt_id) { console.log(k, "ERR", JSON.stringify(r).slice(0, 500)); continue; }
  ids[k] = r.prompt_id;
}
for (const [k, id] of Object.entries(ids)) {
  for (let i = 0; i < 300; i++) {
    const h = (await (await fetch(`${API}/history/${id}`)).json())[id];
    if (h?.status?.status_str === "error") { console.log(k, "FAILED", JSON.stringify(h.status).slice(0, 400)); break; }
    const img = h?.outputs?.[10]?.images?.[0];
    if (img) {
      fs.writeFileSync(`sky2/${k}${process.env.SUF ?? ""}.png`, Buffer.from(await (await fetch(`${API}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${img.subfolder}&type=${img.type}`)).arrayBuffer()));
      console.log(k, "ok");
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
