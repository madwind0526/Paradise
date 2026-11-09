import "./style.css";
import { Download, FolderOpen, Monitor } from "lucide";
import { validateMap } from "../shared/spec.mjs";
import { dayHour } from "./time";
import { btn, h, ic } from "./ui";
import { World } from "./world";
import type { MapSpec } from "./types";

const root = document.getElementById("root")!;

// Authoring is PC-only: a phone just gets an icon.
if (matchMedia("(pointer: coarse)").matches) {
  root.append(h("div", "start", ic(Monitor)));
} else {
  void init();
}

async function init() {
  const template: MapSpec = (validateMap(await (await fetch("/maps/maldives.json")).json()) as any).value;
  const canvas = h("canvas");
  const ta = h("textarea");
  ta.spellcheck = false;
  const msg = h("div", "msg");
  const hour = h("input");
  hour.type = "range"; hour.min = "0"; hour.max = "24"; hour.step = "0.1";
  hour.value = String(dayHour("auto", 24));
  const side = h("div", "side", ta, msg, h("div", "row", hour), h("div", "row"));
  const stage = h("div", "stage", canvas);
  stage.style.aspectRatio = "9 / 16";
  root.append(h("div", "studio-wrap", side, stage));

  const world = new World(canvas);
  if (import.meta.env.DEV) (window as any).__world = world; // dev-only debugging hook
  world.setMap(template);
  ta.value = JSON.stringify(template, null, 2);

  // Live preview: valid JSON is applied at once, errors are shown without touching the scene.
  ta.oninput = () => {
    try {
      const r: any = validateMap(JSON.parse(ta.value));
      if (!r.ok) throw new Error(r.error);
      world.setMap(r.value);
      msg.className = "msg"; msg.textContent = "OK";
    } catch (e) {
      msg.className = "msg bad"; msg.textContent = (e as Error).message;
    }
  };

  const file = h("input");
  file.type = "file"; file.accept = ".json";
  file.onchange = async () => { ta.value = await file.files![0].text(); ta.oninput!(new InputEvent("input")); };
  const download = () => {
    const a = h("a");
    a.href = URL.createObjectURL(new Blob([ta.value], { type: "application/json" }));
    a.download = "map.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  side.lastElementChild!.append(btn(FolderOpen, "열기", () => file.click(), "chip"), btn(Download, "저장", download, "chip"));

  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    world.update(dt, Number(hour.value));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
