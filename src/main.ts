import "@fontsource/orbitron/600.css";
import "./style.css";
import { Anchor, Waves, Heart, Coffee, PersonStanding, ArrowUp, Check, Folder, Info, Music, SlidersVertical, Clock, FolderOpen, Bird, Pause, Plus, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Globe, ListMusic, Mountain, Play, Settings as Cog, Trash2, User, Volume2, VolumeX, Wind, X } from "lucide";
import { validateMap } from "../shared/spec.mjs";
import { DEFAULT_TRACK, SUPPORT_URL, asset } from "./config";
import { EQ_LABELS, EQ_PRESETS, Sound } from "./audio";
import { load, normalize, restore, save } from "./state";
import { dayHour } from "./time";
import type { MapSpec } from "./types";
import type { IconNode } from "lucide";
import { btn, h, ic } from "./ui";
import { FIGURES, defaultFigure, registerFigures } from "./figures";
import { World } from "./world";
import { Capacitor, registerPlugin } from "@capacitor/core";

// Android app only (android/.../FolderMusicPlugin.java): pick a folder of the phone and list every audio file below it.
const FolderMusic = registerPlugin<{ pickFolder(): Promise<{ path: string }>; listAudio(o: { path: string }): Promise<{ files: string[] }> }>("FolderMusic");
const isApp = Capacitor.isNativePlatform();
const fileUrl = (path: string) => Capacitor.convertFileSrc("file://" + path.split("/").map(encodeURIComponent).join("/"));

const DRAIN_SECONDS = 360, REFILL_SECONDS = 30; // swaying time until exhausted, and time to rest back to full
const CYCLES = [3, 6, 9, 12, 24];
const s = load();
if (!CYCLES.includes(s.cycle)) s.cycle = 24;
const world = new World(document.getElementById("view") as HTMLCanvasElement);
const sound = new Sound();
const hud = document.getElementById("hud")!;
if (import.meta.env.DEV) Object.assign(window, { __sound: sound, __world: world }); // dev-only debugging hooks

let bMaps: MapSpec[] = [];
const allMaps = () => [...bMaps, ...Object.values(s.maps)];
const curMap = () => allMaps().find((x) => x.id === s.mapId) ?? bMaps[0];

const BUILTIN_MAPS = ["maldives", "hawaii", "bali", "borabora", "thai", "halong"];

async function loadBuiltins() {
  const get = async (p: string) => (await fetch(asset(p))).json();
  // Run built-ins through the validators so defaults are filled in, keeping their ids.
  const norm = async (p: string, v: (x: unknown) => any) => {
    const raw = await get(p), r = v(raw);
    if (!r.ok) throw new Error(`${p}: ${r.error}`);
    return { ...r.value, id: raw.id, ...(raw.thumb ? { thumb: asset(raw.thumb) } : {}) };
  };
  // One missing or broken file must not stop the app: skip it, and fall back to a plain salt map if none loads.
  const done = await Promise.allSettled(BUILTIN_MAPS.map(async (id) => ({ ...(await norm(`/maps/${id}.json`, validateMap)), id })));
  bMaps = done.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (!bMaps.length) bMaps = [{ ...(validateMap({ schema: "paradise.map/1", name: "몰디브" }) as any).value, id: "maldives" }];
}

function apply() {
  const m = allMaps().find((x) => x.id === s.mapId) ?? bMaps[0];
  { const fig = FIGURES.find((f) => f.id === s.figure) ?? FIGURES[0]; world.setFigure(fig.file, fig); }
  world.setMap(m);
  sound.setAmbience(m.ambience);
  applyVolumes();
  sound.setEq(s.eq, true);
  sound.setCritters(s.critters);
}

// Local picks (folder/m3u) last for this session only: browsers cannot keep file handles in localStorage.
let local: string[] = [];
let localLabel = "";
// Source priority: files picked on this device (session only) > folder/list picked in the explorer > URLs > default.
async function applyMusic() {
  if (local.length) return sound.setPlaylist(local, DEFAULT_TRACK);
  if (s.musicPath.startsWith("phone:")) {
    try {
      const { files } = await FolderMusic.listAudio({ path: s.musicPath.slice(6) });
      const sorted = files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (sorted.length) return sound.setPlaylist(sorted.map(fileUrl), DEFAULT_TRACK);
    } catch { /* permission refused or folder gone: fall through to the URL list */ }
  } else if (s.musicPath) {
    try {
      const urls: string[] = await (await fetch(`/api/fs/${s.musicKind === "dir" ? "tracks" : "m3u"}?path=${encodeURIComponent(s.musicPath)}`)).json();
      if (Array.isArray(urls) && urls.length) return sound.setPlaylist(urls, DEFAULT_TRACK);
    } catch { /* server unreachable or folder gone: fall through to the URL list */ }
  }
  sound.setPlaylist(s.playlist, DEFAULT_TRACK);
}
const AUDIO = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i;

// ---------- HUD (all overlaid on the canvas) ----------
const clockLocal = h("div", "", "--:--"), clockApp = h("div", "", "--:--");
const clock = h("div", "clock", clockApp, clockLocal); // line 1 (small): the time in the app's world, line 2 (large): this device's time
const musicBtn = btn(Play, "재생 / 일시정지", () => sound.setMusic(!sound.musicOn), "main");
const vol = h("input");
vol.type = "range"; vol.min = "0"; vol.max = "1"; vol.step = "0.05"; vol.value = String(s.musicVol);
vol.setAttribute("aria-label", "음악 음량");
vol.oninput = () => { s.musicVol = Number(vol.value); muted = false; save(s); applyVolumes(); };
// Shuffle toggles on/off; repeat cycles off -> one track -> all tracks.
const shuffleBtn = btn(Shuffle, "무작위 재생", () => { s.shuffle = !s.shuffle; save(s); sound.setShuffle(s.shuffle); refreshModes(); });
const repeatBtn = btn(Repeat, "반복 재생", () => { s.repeat = s.repeat === "off" ? "one" : s.repeat === "one" ? "all" : "off"; save(s); sound.setRepeat(s.repeat); refreshModes(); });
function refreshModes() {
  shuffleBtn.classList.toggle("dim", !s.shuffle);
  repeatBtn.classList.toggle("dim", s.repeat === "off");
  repeatBtn.replaceChildren(ic(s.repeat === "one" ? Repeat1 : Repeat));
  repeatBtn.title = repeatBtn.ariaLabel = s.repeat === "off" ? "반복 끄기" : s.repeat === "one" ? "한 곡 반복" : "전체 반복";
  shuffleBtn.title = shuffleBtn.ariaLabel = s.shuffle ? "무작위 재생 켜짐" : "무작위 재생 꺼짐";
}
refreshModes();
sound.shuffle = s.shuffle;
sound.repeat = s.repeat;
const player = h("div", "player", btn(Folder, "음악 선택", () => openMusicSource()), shuffleBtn, btn(SkipBack, "이전 곡", () => sound.prev()), musicBtn, btn(SkipForward, "다음 곡", () => sound.next()), repeatBtn);
let muted = false;
const muteBtn = btn(Volume2, "음소거", () => { muted = !muted; applyVolumes(); });
function applyVolumes() {
  sound.setVolumes(muted ? 0 : s.musicVol, muted ? 0 : s.ambientVol);
  muteBtn.replaceChildren(ic(muted ? VolumeX : Volume2));
  muteBtn.title = muteBtn.ariaLabel = muted ? "소리 켜기" : "소리 끄기";
  vol.classList.toggle("dim", muted);
}
const volBox = h("div", "vol", muteBtn, h("div", "vslide", vol));
// Like Voyager: a heart with the stamina number, and a button that toggles between still (anchor) and swaying (waves).
// Swaying drains stamina; when it is used up the figure holds still until the stamina is full again.
let started = false, wantSway = true, forced = false, stamina = 100;
const stamNum = h("span", "", "100");
const stam = h("div", "stam", ic(Heart), stamNum);
const swayBtn = btn(Anchor, "흔들림 / 고정", () => { if (!forced && sound.musicOn) wantSway = !wantSway; });
const isStill = () => !started || !sound.musicOn || forced || !wantSway;
let swayKey = "";
function refreshSway() {
  const still = isStill(), key = `${still}${forced}${sound.musicOn}`;
  if (key === swayKey) return;
  swayKey = key;
  swayBtn.replaceChildren(ic(still ? Anchor : Waves));
  swayBtn.classList.toggle("off", forced || !sound.musicOn);
  musicBtn.replaceChildren(ic(sound.musicOn ? Pause : Play)); // the centre button shows what a press will do
}
hud.append(
  clock,
  stam,
  player,
  h("div", "corner tr", btn(User, "프로필", () => openProfile())),
  h("div", "corner bl", btn(Cog, "설정", () => openSettings())),
  h("div", "corner br", volBox, swayBtn),
);

const startLayer = h("div", "start", btn(Play, "시작", async () => {
  // Web version in a desktop browser tab: open the player in a phone-shaped window first (a script can only size a window it opens).
  if (location.hostname.endsWith("github.io") && window.name !== "paradise" && !matchMedia("(pointer: coarse)").matches) {
    const hh = Math.min(1200, screen.availHeight - 40);
    if (window.open(location.href, "paradise", `popup,width=650,height=${hh}`)) return;
  }
  startLayer.remove();
  started = true;
  sound.start();
  sound.setMusic(true);
  if (matchMedia("(pointer: coarse)").matches) {
    try {
      await document.documentElement.requestFullscreen();
      await (screen.orientation as any).lock("portrait");
    } catch {
      /* not supported or refused: the manifest and CSS keep the portrait layout */
    }
  }
}));
hud.append(startLayer);

// ---------- pop-ups ----------
function openModal(build: (render: () => void) => (Node | string)[]) {
  const back = h("div", "modal");
  const close = () => { back.remove(); removeEventListener("keydown", onKey); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && hud.lastElementChild === back) close(); }; // only the top pop-up closes
  back.onclick = (e) => { if (e.target === back) close(); };
  back.setAttribute("role", "dialog");
  back.setAttribute("aria-modal", "true");
  addEventListener("keydown", onKey);
  const render = () => back.replaceChildren(h("div", "pop", h("div", "row end", btn(X, "닫기", close)), ...build(render)));
  hud.append(back);
  render();
}

// Up to 9 maps in total (the built-in ones included); the "+" card disappears when the list is full.
const MAX_MAPS = 9;

/** Give a map without its own picture a card picture: a photo of the map itself, taken once after it is applied. */
/** A stable key for a map's content (name, look and sound; not its id, author or picture). */
function mapKey(m: MapSpec): string {
  const text = JSON.stringify([m.name, m.sky, m.scenery, m.ambience]);
  let x = 2166136261;
  for (let i = 0; i < text.length; i++) x = Math.imul(x ^ text.charCodeAt(i), 16777619);
  return (x >>> 0).toString(36) + text.length.toString(36);
}
const MAX_PICTURES = 30; // old pictures of deleted maps; the oldest go first

const mapFiles = new Map<string, string>(); // map id -> its file name in public/maps/added (this session)
let onPicture: () => void = () => {}; // set by the open settings pop-up so its cards refresh when a picture is ready
function capturePicture(id: string) {
  const m = s.maps[id];
  if (!m || m.thumb) return;
  const kept = s.pictures[mapKey(m)];
  if (kept) { m.thumb = kept; save(s); onPicture(); return; } // this map had a picture before: use it as it is
  // Two frames later the map's sky and ground are drawn; the sky picture may still be loading, which is fine for a card.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      if (s.mapId !== id) return; // another map is on screen now
      m.thumb = world.snapshot();
      const pics = Object.keys(s.pictures);
      if (pics.length >= MAX_PICTURES) delete s.pictures[pics[0]];
      s.pictures[mapKey(m)] = m.thumb;
      save(s);
      const file = mapFiles.get(id);
      if (file) void fetch("/api/maps/picture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ file, thumb: m.thumb }) }).catch(() => {});
      onPicture();
    } catch { /* keep the color card */ }
  }));
}

/** Add a map from JSON text (a pasted LLM answer may be wrapped in a ``` fence). Returns an error message, or "" on success. */
function addMap(text: string): string {
  if (allMaps().length >= MAX_MAPS) return `지도를 ${MAX_MAPS}개까지 저장할 수 있습니다. 기존 지도를 삭제해 주세요.`;
  let spec: any;
  try { spec = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "")); } catch { return "올바른 JSON 형식이 아닙니다."; }
  if (JSON.stringify(spec).length > 20000) return "지도 파일이 너무 큽니다.";
  const r: any = validateMap(spec);
  if (!r.ok) return `이 지도를 사용할 수 없습니다: ${r.error}`;
  const id = "u-" + Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("");
  const fileBody = JSON.stringify({ spec: { ...r.value } }); // the file keeps the map exactly as given, without the name added below
  if (!r.value.author && s.name) r.value.author = s.name;
  s.maps[id] = { ...r.value, id };
  // Keep the map as a file too: deleting it from the list later leaves the file in public/maps/added.
  void fetch("/api/maps/save", { method: "POST", headers: { "content-type": "application/json" }, body: fileBody })
    .then((res) => res.json()).then((x) => { if (x.file) { mapFiles.set(id, x.file); const th = s.maps[id]?.thumb; if (th) void fetch("/api/maps/picture", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ file: x.file, thumb: th }) }).catch(() => {}); } }).catch(() => {});
  s.mapId = id;
  save(s);
  apply();
  void pickSky();
  capturePicture(id);
  return "";
}

/** The "+" card opens the system file dialog; the chosen .json file is added as a map. */
function pickMapFile(done: () => void) {
  const f = h("input") as HTMLInputElement;
  f.type = "file";
  f.accept = ".json,application/json";
  f.onchange = async () => {
    if (!f.files?.[0]) return;
    const e = addMap(await f.files[0].text());
    if (e) alert(e); else { onPicture = done; done(); }
  };
  f.click();
}

function mapGrid(render: () => void) {
  const grid = h("div", "grid");
  for (const m of allMaps()) {
    // A square picture card: the map name sits on a soft shade at the bottom, a tick marks the chosen one.
    const card = h("div", "card square mapcard", h("div", "nm", m.name));
    card.style.backgroundImage = m.thumb ? `url(${m.thumb})` : `linear-gradient(#a9c8ee 0 55%, ${m.scenery.cloud} 55%)`; // no picture: sky and cloud deck in the map's own colors
    card.style.backgroundSize = "cover"; // inline: the generic .card.on rules use the background shorthand
    card.style.backgroundPosition = "center";
    card.classList.toggle("on", m.id === s.mapId);
    if (m.id === s.mapId) card.append(h("div", "tick", ic(Check)));
    card.onclick = () => { s.mapId = m.id!; save(s); apply(); void pickSky(); render(); };
    if (s.maps[m.id!]) card.append(btn(Trash2, "삭제", () => { if (m.thumb) s.pictures[mapKey(m)] = m.thumb; /* keep the picture */ delete s.maps[m.id!]; if (s.mapId === m.id) s.mapId = "maldives"; save(s); apply(); render(); }, "x"));
    grid.append(card);
  }
  if (allMaps().length < MAX_MAPS) {
    const add = h("div", "card square mapcard add", ic(Plus));
    add.title = add.ariaLabel = "지도 추가";
    add.onclick = () => pickMapFile(render);
    grid.append(add);
  }
  return grid;
}

function coffeeBtn() {
  const b = h("button", "coffee", ic(Coffee), "커피 한 잔 후원하기");
  b.onclick = () => window.open(SUPPORT_URL, "_blank", "noopener");
  return b;
}

// The figures to pick from: each card is the picture itself.
function openProfile() {
  openModal((render) => {
    const name = h("input");
    name.type = "text";
    name.placeholder = "이름";
    name.maxLength = 20;
    name.value = s.name;
    name.oninput = () => { s.name = name.value; save(s); };
    const row = h("div", "opts");
    for (const b of FIGURES) {
      const o = h("div", "opt" + (b.id === s.figure ? " on" : ""));
      o.title = b.name;
      o.onclick = () => { s.figure = b.id; save(s); apply(); render(); };
      o.style.backgroundImage = `url(${b.file})`;
      row.append(o);
    }
    return [
      h("div", "row", ic(User), name),
      h("div", "pick", ic(PersonStanding), row),
      coffeeBtn(),
        h("div", "credit", "Paradise by Madwind"),
    ];
  });
}

// Built-in file explorer backed by the local server (/api/fs): pick a folder (all subfolders play) or a playlist file.
interface FsList { path: string; parent: string; dirs: { name: string; path: string }[]; files: { name: string; path: string; kind: "audio" | "list" }[] }
function openExplorer(kind: "dir" | "list", first: FsList, onPick: (path: string) => void) {
  let data = first;
  let rerender = () => {};
  const go = async (path: string) => {
    try { data = await (await fetch(`/api/fs/list?path=${encodeURIComponent(path)}`)).json(); } catch { /* keep the current folder */ }
    rerender();
  };
  openModal((render) => {
    rerender = render;
    const rows = h("div", "list");
    const row = (icon: typeof Folder, name: string, cls: string, onClick?: () => void) => {
      const r = h("div", "item " + cls, ic(icon), h("div", "t", h("span", "", name)));
      if (onClick) r.onclick = onClick;
      rows.append(r);
    };
    for (const d of data.dirs) row(Folder, d.name, "click", () => void go(d.path));
    for (const f of data.files) {
      if (kind === "list" && f.kind === "list") row(ListMusic, f.name, "click", () => { onPick(f.path); closeTop(); });
      else if (kind === "dir" && f.kind === "audio") row(Music, f.name, "dim"); // shown for context only
    }
    const bar = h("div", "row", btn(ArrowUp, "위로", () => void go(data.parent), "icon"), h("div", "pathbar", data.path === "@roots" ? "컴퓨터" : data.path));
    if (kind === "dir" && data.path !== "@roots") bar.append(btn(Check, "이 폴더 선택", () => { onPick(data.path); closeTop(); }, "icon ok"));
    return [bar, rows.children.length ? rows : h("div", "empty", "—")];
  });
}
const closeTop = () => [...hud.querySelectorAll(".modal")].pop()?.remove();

const ZONES = ["Asia/Seoul", "Asia/Tokyo", "Asia/Shanghai", "Asia/Kolkata", "Europe/London", "Europe/Paris", "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney", "UTC"];

const CUSTOM = "Custom";
const eqMatch = () => Object.entries(EQ_PRESETS).find(([, v]) => v.every((x, i) => x === s.eq[i]))?.[0] ?? CUSTOM;

// 10-band equalizer, same bands and presets as the SongYUE2 studio.
function eqSection() {
  const sel = h("select");
  const bars: HTMLInputElement[] = [];
    const presetNames: Record<string, string> = { Flat: "균형", "Bass Boost": "저음 강조", "Vocal Boost": "보컬 강조", "Treble Boost": "고음 강조", Loudness: "음량 보정", Acoustic: "어쿠스틱" };
  const names = () => sel.replaceChildren(...(eqMatch() === CUSTOM ? [new Option("직접 설정", CUSTOM)] : []), ...Object.keys(EQ_PRESETS).map((n) => new Option(presetNames[n] ?? n, n)));
  const refresh = () => { names(); sel.value = eqMatch(); };
  const commit = () => { s.eqPreset = eqMatch(); save(s); sound.setEq(s.eq, true); };
  sel.onchange = () => {
    const p = EQ_PRESETS[sel.value];
    if (!p) return;
    s.eq = [...p];
    commit();
    bars.forEach((r, i) => (r.value = String(s.eq[i])));
    refresh();
  };
  const row = h("div", "eq");
  EQ_LABELS.forEach((lab, i) => {
    const r = h("input");
    r.type = "range"; r.min = "-100"; r.max = "100"; r.step = "1";
    r.value = String(s.eq[i]);
    r.setAttribute("aria-label", lab + " Hz");
    r.oninput = () => { s.eq[i] = Number(r.value); commit(); refresh(); };
    bars.push(r);
    row.append(h("div", "eqbar", h("div", "vslide", r), h("small", "", lab)));
  });
  refresh();
  const note = sound.eqAvailable ? [] : [h("div", "note", ic(Info), "유튜브나 웹 주소로 재생하는 음악에는 적용되지 않습니다")];
  return [h("div", "row", ic(SlidersVertical), sel), row, ...note];
}

function openSettings() {
  openModal((render) => {
    const tz = h("select");
      tz.append(new Option("자동", "auto"), ...ZONES.map((z) => new Option(z, z)));
    tz.value = s.tz;
    tz.onchange = () => { s.tz = tz.value; save(s); syncClock(); };
    const cyc = h("div", "seg");
    for (const c of CYCLES) {
      const b = h("button", "chip", String(c));
      b.setAttribute("aria-label", `하루 ${c}시간`);
      b.classList.toggle("on", s.cycle === c);
      b.onclick = () => { s.cycle = c; save(s); syncClock(); render(); };
      cyc.append(b);
    }
    const range = (v: number, set: (n: number) => void) => {
      const r = h("input"); r.type = "range"; r.min = "0"; r.max = "1"; r.step = "0.05"; r.value = String(v);
      r.oninput = () => { set(Number(r.value)); save(s); applyVolumes(); };
      return r;
    };
    return [
      h("div", "row", ic(Globe), tz),
      h("div", "row", ic(Clock), cyc),
      h("div", "row", ic(Mountain)),
      mapGrid(render),
      h("div", "row", ic(Wind), range(s.ambientVol, (n) => (s.ambientVol = n)), (() => {
        const b = btn(Bird, "새와 벌레 소리", () => { s.critters = !s.critters; save(s); sound.setCritters(s.critters); b.classList.toggle("on", s.critters); }, "icon");
        b.classList.toggle("on", s.critters);
        return b;
      })()),
      ...eqSection(),
    ];
  });
}

// Music source pop-up (folder button at the left of the player): one line for URLs, then folder and playlist-file buttons.
function openMusicSource() {
  openModal(() => {
    const src = h("input");
    src.type = "text";
    src.placeholder = "https://";
    src.spellcheck = false;
    const shown = () => (local.length ? localLabel : s.musicPath ? s.musicPath.replace(/^phone:/, "Phone: ") || "Phone" : s.playlist.join(" "));
    src.value = shown();
    const picked = () => local.length > 0 || !!s.musicPath;
    src.classList.toggle("picked", picked());
    const setUrls = () => {
      if (picked() && src.value === shown()) return; // label of a picked folder, untouched
      const urls = src.value.split(/[\s,;]+/).map((x) => x.trim()).filter((x) => /^https?:/i.test(x));
      local.forEach(URL.revokeObjectURL);
      local = [];
      s.musicPath = "";
      s.playlist = urls; // empty: back to the default playlist
      save(s);
      void applyMusic();
      src.classList.remove("picked");
    };
    src.onchange = setUrls;
    src.onkeydown = (e) => { if (e.key === "Enter") src.blur(); };
    src.onpaste = () => setTimeout(() => { setUrls(); src.blur(); }, 0);
    src.onfocus = () => { if (picked()) src.select(); };
    const chosen = () => { src.value = shown(); src.classList.toggle("picked", picked()); void applyMusic(); };
    // Native chooser, used on touch devices and wherever the built-in explorer is not available.
    const nativePick = (kind: "dir" | "list") => {
      const f = h("input"); f.type = "file";
      if (kind === "dir") { (f as any).webkitdirectory = true; f.multiple = true; f.accept = "audio/*"; } else f.accept = ".m3u,.m3u8,.pls";
      f.onchange = async () => {
        if (!f.files?.length) return;
        if (kind === "dir") {
          const rel = (x: File) => x.webkitRelativePath || x.name; // phone file choosers give several files, not a folder
          const files = [...f.files].filter((x) => AUDIO.test(x.name) || x.type.startsWith("audio/")).sort((a, b) => rel(a).localeCompare(rel(b), undefined, { numeric: true }));
          if (!files.length) return alert("음악 파일을 찾을 수 없습니다.");
          local.forEach(URL.revokeObjectURL);
          local = files.map((x) => URL.createObjectURL(x));
          localLabel = `${files[0].webkitRelativePath ? files[0].webkitRelativePath.split("/")[0] : files[0].name} · ${files.length}`;
        } else {
          const urls = (await f.files[0].text()).split(/\r?\n/).map((x) => x.trim()).filter((x) => /^https?:\/\//i.test(x));
          if (!urls.length) return alert("재생목록에 웹 주소가 없습니다. 폴더를 선택해 주세요.");
          local.forEach(URL.revokeObjectURL);
          local = [];
          s.musicPath = "";
          s.playlist = urls;
          save(s);
        }
        chosen();
      };
      f.click();
    };
    const choose = async (kind: "dir" | "list") => {
      if (isApp && kind === "dir") {
        // The whole folder, sub-folders included, stays chosen after the app is closed.
        try {
          const { path } = await FolderMusic.pickFolder();
          local.forEach(URL.revokeObjectURL);
          local = [];
          s.musicPath = "phone:" + path;
          s.musicKind = "phone";
          save(s);
          chosen();
        } catch { /* cancelled */ }
        return;
      }
      if (!matchMedia("(pointer: coarse)").matches) {
        try {
          const r = await fetch(`/api/fs/list?path=${encodeURIComponent(kind === "dir" && s.musicKind === "dir" ? s.musicPath : "")}`);
          if (r.ok) {
            return openExplorer(kind, await r.json(), (path) => {
              local.forEach(URL.revokeObjectURL);
              local = [];
              s.musicPath = path;
              s.musicKind = kind;
              save(s);
              chosen();
            });
          }
        } catch { /* no local server: use the native chooser */ }
      }
      nativePick(kind);
    };
    const pickBtn = (label: string, icon: any, kind: "dir" | "list") => {
      const b = h("button", "srcbtn", label, ic(icon));
      b.onclick = () => void choose(kind);
      return b;
    };
    return [h("div", "poptitle", "음악 선택"), h("div", "row", src), h("div", "srcbtns", pickBtn("폴더", FolderOpen, "dir"), pickBtn("재생목록", ListMusic, "list"))];
  });
}

// ---------- clock + loop ----------
let hourBase = 12, tBase = performance.now();
function syncClock() { hourBase = dayHour(s.tz, s.cycle); tBase = performance.now(); }
// In-app hour (0..24): real time in the chosen zone, compressed when the day is shorter than 24h.
const hourNow = () => (hourBase + ((performance.now() - tBase) / 3600000) * (24 / s.cycle)) % 24;

let last = performance.now(), lastSync = 0, clockText = "";
function tick(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (now - lastSync > 60000) { syncClock(); lastSync = now; }

  const hr = (curMap().sky.hour ?? -1) >= 0 ? curMap().sky.hour : hourNow();
  const still = isStill();
  stamina = Math.min(100, Math.max(0, stamina + (still ? 100 / REFILL_SECONDS : -100 / DRAIN_SECONDS) * dt));
  if (stamina <= 0) forced = true; else if (forced && stamina >= 100) forced = false;
  world.swaying = !isStill();
  const sn = String(Math.round(stamina));
  if (stamNum.textContent !== sn) stamNum.textContent = sn;
  stam.classList.toggle("empty", forced);
  refreshSway();
  world.update(dt, hr);
  if (world.sunUp !== lastSunUp) { lastSunUp = world.sunUp; void pickSky(); } // dusk or dawn: a new random picture
  sound.setNight(world.night);
  const text = `${String(Math.floor(hr)).padStart(2, "0")}:${String(Math.floor((hr % 1) * 60)).padStart(2, "0")}`;
  const d = new Date(), local = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (text + local !== clockText) { clockApp.textContent = text; clockLocal.textContent = local; clockText = text + local; }
  requestAnimationFrame(tick);
}

// Sky pictures: every evening (and morning) one picture is drawn at random from a folder under public/sky: "day", and
// "night" or the folder named by the map.
const skyLists = new Map<string, string[]>();

// The server lists characters and sky pictures. The stand-alone phone app has no server, so those lists come from
// app-index.json (written at build time) and the server-only controls (PC folders) are hidden.
let appIndex: Promise<any> | undefined;
async function listing<T>(api: string, fromIndex: (index: any) => T): Promise<T> {
  try {
    const r = await fetch(api);
    if (r.ok && /json/.test(r.headers.get("content-type") ?? "")) return await r.json();
  } catch { /* no server */ }
  document.documentElement.classList.add("standalone");
  appIndex ??= fetch(asset("/app-index.json")).then((r) => r.json());
  return fromIndex(await appIndex);
}
async function skyList(folder: string) {
  if (!skyLists.has(folder)) {
    try { skyLists.set(folder, await listing(`/api/sky/${encodeURIComponent(folder)}`, (i) => i.sky[folder] ?? [])); } catch { skyLists.set(folder, []); } // nothing listed: built-in sky
  }
  return skyLists.get(folder)!;
}
let lastSunUp: boolean | null = null;
// Uniform random integer below n from the browser's cryptographic generator (no fixed or guessable seed).
const rnd = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
async function pickSky() {
  const kind = world.sunUp ? "day" : "night";
  if (kind === "night") world.setMoonRed(rnd(4) === 0); // one night in four has a red moon
  const map = curMap();
  if (map.sky.picture) return; // the map brings its own sky picture
  const folder = kind === "day" ? "day" : map.sky.nightPhotos;
  const list = await skyList(folder);
  let i = list.length ? rnd(list.length) : -1;
  // Never the same picture twice in a row, not even across visits.
  if (list.length > 1 && list[i] === s.lastSky[folder]) i = (i + 1 + rnd(list.length - 1)) % list.length;
  s.lastSky[folder] = list[i] ?? "";
  save(s);
  world.setSkyPhoto(kind, i >= 0 ? list[i] : null);
}

loadBuiltins().then(async () => {
  await restore(s);
  normalize(s);
  if (!CYCLES.includes(s.cycle)) s.cycle = 24;
  if (!allMaps().some((m) => m.id === s.mapId)) s.mapId = "maldives";
  try { registerFigures(await listing("/api/figures", (i) => i.figures)); } catch { /* no server: built-in figures only */ }
  if (!FIGURES.some((f) => f.id === s.figure)) { s.figure = defaultFigure(); save(s); }
  syncClock();
  apply();
  applyMusic();
  requestAnimationFrame(tick);
});
