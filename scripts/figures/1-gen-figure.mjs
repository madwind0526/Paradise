// Palm-beach panoramas with Krea 2 Turbo (ComfyUI core nodes: CLIPLoader type "krea2", Qwen3-VL 4B text encoder, Qwen Image VAE).
import fs from "node:fs";
const API = "http://127.0.0.1:8188";
const BS = String.fromCharCode(92);
const STYLE = "cute anime illustration, clean thin line art, soft cel shading, pastel colors, chibi proportions, seen from directly behind so only the back of the head and the back are visible, relaxed and calm, the whole subject centered and fully visible with some margin, floating on a perfectly uniform flat pure green (#00ff00) background, no ground, no text";
const SCENES = {
  sunbed: "a girl with a black hair bun relaxing on a wooden sun lounger with a cream cushion, only her head and shoulders show above the backrest, a small round side table with an orange drink and a book beside it",
  cloud: "a boy with short messy brown hair wearing a light blue hoodie, sitting on a small fluffy white cloud, hugging his knees",
  carpet: "a girl with a long ponytail wearing a cream blouse, sitting cross-legged on a flying magic carpet with red and gold patterns and tassels",
  drone: "a girl with a bob haircut wearing an orange top, sitting on a big white quadcopter drone with four spinning rotors",
  balloon: "a person with a beanie hat standing in a wicker hot air balloon basket under a large colorful striped balloon, holding the rim",
  swing: "a child with curly hair wearing a yellow t-shirt, sitting on a wooden swing hung by two ropes from a small fluffy cloud above, legs dangling",
  boat: "a person with a straw hat sitting in a small wooden sailing boat with a white sail, the boat resting on a puff of cloud",
  whale: "a girl with a long braid wearing a white shirt, sitting on the back of a big friendly blue flying whale with small clouds around",
  swan: "a girl with twin tails wearing a swimsuit, sitting on a giant white inflatable swan float, holding a fruit drink",
  surfboard: "a boy with spiky black hair wearing swim shorts, sitting on a colorful surfboard that floats in the air, hugging his knees",
};
const only = process.argv.slice(2);
const wf = (prompt, prefix, seed) => ({
  1: { class_type: "UNETLoader", inputs: { unet_name: `Krea${BS}krea2_turbo_nvfp4.safetensors`, weight_dtype: "default" } },
  2: { class_type: "CLIPLoader", inputs: { clip_name: `Qwen${BS}qwen3vl_4b_fp8_scaled.safetensors`, type: "krea2", device: "default" } },
  3: { class_type: "VAELoader", inputs: { vae_name: `qwen${BS}qwen_image_vae.safetensors` } },
  4: { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["2", 0] } },
  5: { class_type: "ConditioningZeroOut", inputs: { conditioning: ["4", 0] } },
  7: { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
  8: { class_type: "KSampler", inputs: { model: ["1", 0], seed, steps: 8, cfg: 1, sampler_name: "euler", scheduler: "simple", positive: ["4", 0], negative: ["5", 0], latent_image: ["7", 0], denoise: 1 } },
  9: { class_type: "VAEDecode", inputs: { samples: ["8", 0], vae: ["3", 0] } },
  10: { class_type: "SaveImage", inputs: { images: ["9", 0], filename_prefix: prefix } },
});
const ids = {};
for (const [k, v] of Object.entries(SCENES)) {
  if (only.length && !only.includes(k.replace(/_.*/, "")) && !only.includes(k)) continue;
  const r = await (await fetch(API + "/prompt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: wf(`${v}, ${STYLE}`, "paradise_kfig_" + k, Math.floor(Math.random() * 1e9)) }) })).json();
  if (!r.prompt_id) { console.log(k, "ERR", JSON.stringify(r).slice(0, 500)); continue; }
  ids[k] = r.prompt_id;
}
for (const [k, id] of Object.entries(ids)) {
  for (let i = 0; i < 300; i++) {
    const h = (await (await fetch(`${API}/history/${id}`)).json())[id];
    if (h?.status?.status_str === "error") { console.log(k, "FAILED", JSON.stringify(h.status).slice(0, 400)); break; }
    const img = h?.outputs?.[10]?.images?.[0];
    if (img) {
      fs.writeFileSync(`anime_fig/fig_${k}${process.env.SUF ?? ""}.png`, Buffer.from(await (await fetch(`${API}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${img.subfolder}&type=${img.type}`)).arrayBuffer()));
      console.log(k, "ok");
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
