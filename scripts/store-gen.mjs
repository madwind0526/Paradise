// STORE BACKDROPS: Krea 2 Turbo anime pictures (ComfyUI core nodes) used behind the phone mockups. Run: node scripts/store-gen.mjs  -> store/gen/bg-*.png
import fs from "node:fs";
const API = "http://127.0.0.1:8188";
const BS = String.fromCharCode(92);
const STYLE = "Makoto Shinkai style anime illustration, soft dreamy painterly, calm relaxing mood, no people, no text, no logo, extremely detailed and beautiful";
const SCENES = {
  "sunset": [896, 1600, "a tropical beach at sunset seen from the sand, glowing orange and pink sky with soft clouds, calm turquoise sea, silhouettes of palm leaves framing the corners, the middle of the picture is open and calm"],
  "lagoon": [896, 1600, "a bright turquoise lagoon under a blue sky with big white cumulus clouds, white sand in the foreground, palm leaves at the edges, hibiscus flowers, the middle of the picture is open and calm"],
  "moon": [896, 1600, "a calm tropical sea at twilight under a deep indigo and violet sky full of stars with a large round glowing moon, soft clouds, a few palm leaves at the corners, the middle is open and calm"],
  "aurora": [896, 1600, "a quiet tropical beach at night with a green and violet aurora curtain across a starry sky, glowing sea with sparkles, palm silhouettes at the edges, the middle is open and calm"],
  "wide": [1792, 768, "a wide panorama of a tropical beach at golden hour, turquoise water, palms on the far left, soft pink and orange clouds, the right two thirds are calm open sky and sea"],
};
const wf = (prompt, w, h, prefix, seed) => ({
  1: { class_type: "UNETLoader", inputs: { unet_name: `Krea${BS}krea2_turbo_nvfp4.safetensors`, weight_dtype: "default" } },
  2: { class_type: "CLIPLoader", inputs: { clip_name: `Qwen${BS}qwen3vl_4b_fp8_scaled.safetensors`, type: "krea2", device: "default" } },
  3: { class_type: "VAELoader", inputs: { vae_name: `qwen${BS}qwen_image_vae.safetensors` } },
  4: { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["2", 0] } },
  5: { class_type: "ConditioningZeroOut", inputs: { conditioning: ["4", 0] } },
  7: { class_type: "EmptyLatentImage", inputs: { width: w, height: h, batch_size: 1 } },
  8: { class_type: "KSampler", inputs: { model: ["1", 0], seed, steps: 8, cfg: 1, sampler_name: "euler", scheduler: "simple", positive: ["4", 0], negative: ["5", 0], latent_image: ["7", 0], denoise: 1 } },
  9: { class_type: "VAEDecode", inputs: { samples: ["8", 0], vae: ["3", 0] } },
  10: { class_type: "SaveImage", inputs: { images: ["9", 0], filename_prefix: prefix } },
});
fs.mkdirSync("store/gen", { recursive: true });
const ids = {};
for (const [k, [w, h, p]] of Object.entries(SCENES)) {
  const r = await (await fetch(API + "/prompt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: wf(`${p}, ${STYLE}`, w, h, "paradise_store_" + k, Math.floor(Math.random() * 1e9)) }) })).json();
  if (!r.prompt_id) { console.log(k, "ERR", JSON.stringify(r).slice(0, 400)); continue; }
  ids[k] = r.prompt_id;
}
for (const [k, id] of Object.entries(ids)) {
  for (let i = 0; i < 300; i++) {
    const hst = (await (await fetch(`${API}/history/${id}`)).json())[id];
    if (hst?.status?.status_str === "error") { console.log(k, "FAILED"); break; }
    const img = hst?.outputs?.[10]?.images?.[0];
    if (img) { fs.writeFileSync(`store/gen/bg-${k}.png`, Buffer.from(await (await fetch(`${API}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${img.subfolder}&type=${img.type}`)).arrayBuffer())); console.log(k, "ok"); break; }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
