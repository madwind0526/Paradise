// Palm-beach panoramas with Krea 2 Turbo (ComfyUI core nodes: CLIPLoader type "krea2", Qwen3-VL 4B text encoder, Qwen Image VAE).
import fs from "node:fs";
const API = "http://127.0.0.1:8188";
const BS = String.fromCharCode(92);
const STYLE = "Makoto Shinkai style anime background art, wide panoramic illustration, vibrant saturated colors, sparkling water, soft volumetric light, a simple clear sky at the top with a few soft clouds, extremely detailed and beautiful, a dreamy paradise you long to visit, no people, no text";
const SCENES = {
  maldives: "a dreamy Maldives lagoon with sparkling turquoise water and a white sand beach, tall coconut palm trees framing both sides, a hammock hanging between two palms, tropical flowers, a few cozy thatched overwater bungalows on a wooden pier far away",
  hawaii: "a Hawaiian beach with rolling turquoise waves, curved coconut palm trees on both sides, red hibiscus flowers, a striped beach umbrella and a surfboard stuck in the sand, green mountains far away",
  bali: "a Bali beach at golden hour with dense coconut palms and big banana leaves, a wooden swing hanging from a palm, pink frangipani flowers, gentle waves, a misty volcano far away",
  borabora: "a Bora Bora lagoon with a green volcanic peak across the water, coconut palms framing the beach, a small wooden canoe on the sand, hibiscus flowers, a few overwater bungalows very far away",
  thai: "a Thai island beach with limestone karst cliffs covered in jungle, a colorful longtail boat on turquoise water, coconut palm trees on both sides, a hammock and orchids",
  halong: "Ha Long Bay with emerald water and limestone karst islands covered in lush jungle, a traditional wooden junk boat with red sails, coconut palms and tropical flowers in the foreground",
};
const only = process.argv.slice(2);
const wf = (prompt, prefix, seed) => ({
  1: { class_type: "UNETLoader", inputs: { unet_name: `Krea${BS}krea2_turbo_nvfp4.safetensors`, weight_dtype: "default" } },
  2: { class_type: "CLIPLoader", inputs: { clip_name: `Qwen${BS}qwen3vl_4b_fp8_scaled.safetensors`, type: "krea2", device: "default" } },
  3: { class_type: "VAELoader", inputs: { vae_name: `qwen${BS}qwen_image_vae.safetensors` } },
  4: { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["2", 0] } },
  5: { class_type: "ConditioningZeroOut", inputs: { conditioning: ["4", 0] } },
  7: { class_type: "EmptyLatentImage", inputs: { width: 1792, height: 768, batch_size: 1 } },
  8: { class_type: "KSampler", inputs: { model: ["1", 0], seed, steps: 8, cfg: 1, sampler_name: "euler", scheduler: "simple", positive: ["4", 0], negative: ["5", 0], latent_image: ["7", 0], denoise: 1 } },
  9: { class_type: "VAEDecode", inputs: { samples: ["8", 0], vae: ["3", 0] } },
  10: { class_type: "SaveImage", inputs: { images: ["9", 0], filename_prefix: prefix } },
});
const ids = {};
for (const [k, v] of Object.entries(SCENES)) {
  if (only.length && !only.includes(k.replace(/_.*/, "")) && !only.includes(k)) continue;
  const r = await (await fetch(API + "/prompt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: wf(`${v}, ${STYLE}`, "paradise_krea_" + k, Math.floor(Math.random() * 1e9)) }) })).json();
  if (!r.prompt_id) { console.log(k, "ERR", JSON.stringify(r).slice(0, 500)); continue; }
  ids[k] = r.prompt_id;
}
for (const [k, id] of Object.entries(ids)) {
  for (let i = 0; i < 300; i++) {
    const h = (await (await fetch(`${API}/history/${id}`)).json())[id];
    if (h?.status?.status_str === "error") { console.log(k, "FAILED", JSON.stringify(h.status).slice(0, 400)); break; }
    const img = h?.outputs?.[10]?.images?.[0];
    if (img) {
      fs.writeFileSync(`anime/${k}${process.env.SUF ?? ""}.png`, Buffer.from(await (await fetch(`${API}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${img.subfolder}&type=${img.type}`)).arrayBuffer()));
      console.log(k, "ok");
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
