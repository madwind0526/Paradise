// Qwen Image Edit (2511, lightning 4 steps): remove the cast shadow from each figure and keep everything else.
import fs from "node:fs";
const API = "http://127.0.0.1:8188";
const PROMPT = "Replace the entire sky and all the clouds with one perfectly uniform flat pure magenta color (#ff00ff). The magenta must also fill every gap between the palm leaves and branches. Keep the palm trees, flowers, mountains, sea, sand and everything below the sky exactly the same, with the same colors and the same details.";
const names = process.argv.slice(2);
const BS = String.fromCharCode(92);
const wf = (img, prefix, seed) => ({
  1: { class_type: "UNETLoader", inputs: { unet_name: `Qwen${BS}qwen_image_edit_2511_fp8_e4m3fn_scaled_lightning_comfyui_4steps_v1.0.safetensors`, weight_dtype: "default" } },
  2: { class_type: "CLIPLoader", inputs: { clip_name: `Qwen${BS}qwen_2.5_vl_7b_fp8_scaled.safetensors`, type: "qwen_image", device: "default" } },
  3: { class_type: "VAELoader", inputs: { vae_name: `qwen${BS}qwen_image_vae.safetensors` } },
  4: { class_type: "LoadImage", inputs: { image: img } },
  5: { class_type: "ImageScaleToTotalPixels", inputs: { image: ["4", 0], upscale_method: "lanczos", megapixels: 1.4, resolution_steps: 8 } },
  6: { class_type: "TextEncodeQwenImageEditPlus", inputs: { clip: ["2", 0], prompt: PROMPT, vae: ["3", 0], image1: ["5", 0] } },
  7: { class_type: "TextEncodeQwenImageEditPlus", inputs: { clip: ["2", 0], prompt: "", vae: ["3", 0], image1: ["5", 0] } },
  8: { class_type: "VAEEncode", inputs: { pixels: ["5", 0], vae: ["3", 0] } },
  9: { class_type: "ModelSamplingAuraFlow", inputs: { model: ["1", 0], shift: 3 } },
  10: { class_type: "CFGNorm", inputs: { model: ["9", 0], strength: 1 } },
  11: { class_type: "KSampler", inputs: { model: ["10", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["8", 0], seed, steps: 4, cfg: 1, sampler_name: "euler", scheduler: "simple", denoise: 1 } },
  12: { class_type: "VAEDecode", inputs: { samples: ["11", 0], vae: ["3", 0] } },
  13: { class_type: "SaveImage", inputs: { images: ["12", 0], filename_prefix: prefix } },
});
const ids = {};
for (const k of names) {
  const buf = fs.readFileSync(`anime/${k}.png`);
  const form = new FormData();
  form.append("image", new Blob([buf], { type: "image/png" }), `paradise_in_anime_${k}.png`);
  form.append("overwrite", "true");
  const up = await (await fetch(API + "/upload/image", { method: "POST", body: form })).json();
  const r = await (await fetch(API + "/prompt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: wf(up.name, "paradise_qs_" + k, Math.floor(Math.random() * 1e9)) }) })).json();
  if (!r.prompt_id) { console.log(k, "ERR", JSON.stringify(r).slice(0, 600)); continue; }
  ids[k] = r.prompt_id;
}
for (const [k, id] of Object.entries(ids)) {
  for (let i = 0; i < 300; i++) {
    const h = (await (await fetch(`${API}/history/${id}`)).json())[id];
    if (h?.status?.status_str === "error") { console.log(k, "FAILED", JSON.stringify(h.status).slice(0, 400)); break; }
    const img = h?.outputs?.[13]?.images?.[0];
    if (img) {
      fs.writeFileSync(`anime_m/${k}.png`, Buffer.from(await (await fetch(`${API}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${img.subfolder}&type=${img.type}`)).arrayBuffer()));
      console.log(k, "ok");
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
