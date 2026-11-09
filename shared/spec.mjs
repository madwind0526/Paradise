// Shared map validator (used by the app, the studio, the server and the tests).
// It returns { ok: true, value } with a normalized copy, or { ok: false, error }.

export const MAP_SCHEMA = "paradise.map/1";

const HEX = /^#[0-9a-fA-F]{6}$/;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const unit = (v, d) => (isNum(v) ? clamp(v, 0, 1) : d);
const fail = (error) => ({ ok: false, error });

export function validateMap(input) {
  if (!input || typeof input !== "object") return fail("not an object");
  if (input.schema !== MAP_SCHEMA) return fail("bad schema");
  const name = text(input.name, 40);
  if (!name) return fail("name required");
  const s = input.sky ?? {};
  const a = input.ambience ?? {};
  const sc = input.scenery ?? {};
  if (sc.cloud !== undefined && !HEX.test(sc.cloud)) return fail("scenery.cloud must be #rrggbb");
  if (sc.photo !== undefined && sc.photo !== "" && !/^\/resorts\/[a-z0-9_-]{1,40}\.(jpe?g|png|webp)$/i.test(sc.photo)) return fail("scenery.photo is invalid");
  if (s.picture !== undefined && s.picture !== "" && !/^\/sky\/[a-z0-9_\-/]{1,60}\.(jpe?g|png|webp)$/i.test(s.picture)) return fail("sky.picture is invalid");
  if (s.nightPhotos !== undefined && !/^[a-z0-9_-]{1,24}$/.test(s.nightPhotos)) return fail("sky.nightPhotos is invalid");
  return {
    ok: true,
    value: {
      schema: MAP_SCHEMA,
      name,
      author: text(input.author, 30),
      sky: { clouds: unit(s.clouds, 0.5), stars: unit(s.stars, 1), haze: unit(s.haze, 0.2), blue: unit(s.blue, 0.5), nightPhotos: s.nightPhotos ?? "night", picture: s.picture ?? "", hour: isNum(s.hour) ? clamp(s.hour, 0, 24) : -1 },
      scenery: { photo: sc.photo ?? "", stand: unit(sc.stand, 0.85), cloud: sc.cloud ?? "#f3f8ff" },
      ambience: { wind: unit(a.wind, 0.4), birds: unit(a.birds, 0.4), insects: unit(a.insects, 0.4) },
    },
  };
}
