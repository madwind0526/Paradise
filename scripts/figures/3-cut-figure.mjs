// AI background removal (ComfyUI-RMBG BiRefNet) on pictures from <dir>: node birefnet.mjs <indir> <outdir> <prefix> name1 name2 ...
import fs from "node:fs";
const API = "http://127.0.0.1:8188";
const [indir, outdir, prefix, ...names] = process.argv.slice(2);
const MODEL = process.env.MODEL ?? "BiRefNet-matting";
const wf = (img, tag) => ({
  1: { class_type: "LoadImage", inputs: { image: img } },
  2: { class_type: "BiRefNetRMBG", inputs: { image: ["1", 0], model: MODEL, sensitivity: 1.0, mask_blur: 0, mask_offset: 0, invert_output: false, refine_foreground: true, unload_model: false, background: "Alpha", background_color: "#222222" } },
  3: { class_type: "SaveImage", inputs: { images: ["2", 0], filename_prefix: tag } },
});
const ids = {};
for (const k of names) {
  const form = new FormData();
  form.append("image", new Blob([fs.readFileSync(`${indir}/${prefix}${k}.png`)], { type: "image/png" }), `paradise_bi_${k}.png`);
  form.append("overwrite", "true");
  const up = await (await fetch(API + "/upload/image", { method: "POST", body: form })).json();
  const r = await (await fetch(API + "/prompt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: wf(up.name, "paradise_bi_" + k) }) })).json();
  if (!r.prompt_id) { console.log(k, "ERR", JSON.stringify(r).slice(0, 700)); continue; }
  ids[k] = r.prompt_id;
}
for (const [k, id] of Object.entries(ids)) {
  for (let i = 0; i < 300; i++) {
    const h = (await (await fetch(`${API}/history/${id}`)).json())[id];
    if (h?.status?.status_str === "error") { console.log(k, "FAILED", JSON.stringify(h.status).slice(0, 500)); break; }
    const img = h?.outputs?.[3]?.images?.[0];
    if (img) {
      fs.writeFileSync(`${outdir}/${k}.png`, Buffer.from(await (await fetch(`${API}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${img.subfolder}&type=${img.type}`)).arrayBuffer()));
      console.log(k, "ok");
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
