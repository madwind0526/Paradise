import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateMap } from "../shared/spec.mjs";

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), "utf8"));
const BUILTIN = ["maldives", "hawaii", "bali", "borabora", "thai", "halong"];

test("every built-in map is valid and its photo exists", () => {
  for (const id of BUILTIN) {
    const m = read(`../public/maps/${id}.json`);
    const r = validateMap(m);
    assert.ok(r.ok, `${id}: ${r.error}`);
    assert.ok(fs.existsSync(new URL(`../public${r.value.scenery.photo}`, import.meta.url)), `${id}: photo file is missing`);
  }
});

test("defaults are filled in and values are clamped", () => {
  const m = validateMap({ schema: "paradise.map/1", name: "x", sky: { hour: 17.9, clouds: 4 }, scenery: { stand: -2 } }).value;
  assert.equal(m.sky.hour, 17.9);
  assert.equal(m.sky.clouds, 1);
  assert.equal(m.scenery.stand, 0);
  assert.equal(m.scenery.photo, "");
  assert.equal(validateMap({ schema: "paradise.map/1", name: "x" }).value.sky.hour, -1);
});

test("bad maps are rejected", () => {
  const ok = { schema: "paradise.map/1", name: "x" };
  assert.equal(validateMap(null).ok, false);
  assert.equal(validateMap({ ...ok, schema: "voyager.map/1" }).ok, false); // maps of the old walking app are not accepted
  assert.equal(validateMap({ ...ok, name: " " }).ok, false);
  assert.equal(validateMap({ ...ok, scenery: { cloud: "white" } }).ok, false);
  assert.equal(validateMap({ ...ok, scenery: { photo: "http://evil/x.jpg" } }).ok, false);
  assert.equal(validateMap({ ...ok, scenery: { photo: "/resorts/../x.jpg" } }).ok, false);
  assert.equal(validateMap({ ...ok, sky: { picture: "http://evil/x.jpg" } }).ok, false);
  assert.equal(validateMap({ ...ok, sky: { nightPhotos: "../etc" } }).ok, false);
});

test("the map guide's JSON blocks are valid and use only the documented keys", () => {
  const md = fs.readFileSync(new URL("../map 제작.md", import.meta.url), "utf8");
  const blocks = [...md.matchAll(/```json\r?\n([\s\S]*?)```/g)].map((x) => JSON.parse(x[1]));
  assert.ok(blocks.length >= 5);
  const known = { "": ["schema", "name", "author", "sky", "scenery", "ambience"], sky: ["clouds", "stars", "haze", "blue", "nightPhotos", "picture", "hour"], scenery: ["photo", "stand", "cloud"], ambience: ["wind", "birds", "insects"] };
  for (const m of blocks) {
    const r = validateMap(m);
    assert.ok(r.ok, `${m.name}: ${r.error}`);
    for (const k of Object.keys(m)) assert.ok(known[""].includes(k), `unknown key ${k}`);
    for (const g of ["sky", "scenery", "ambience"]) for (const k of Object.keys(m[g] ?? {})) assert.ok(known[g].includes(k), `unknown key ${g}.${k}`);
    if (m.scenery?.photo) assert.ok(fs.existsSync(new URL(`../public${m.scenery.photo}`, import.meta.url)), `${m.name}: missing ${m.scenery.photo}`);
  }
});

test("the stand values in the guide match the built-in maps", () => {
  const md = fs.readFileSync(new URL("../map 제작.md", import.meta.url), "utf8");
  for (const id of ["maldives", "hawaii", "bali", "borabora", "thai", "halong"]) {
    const m = read(`../public/maps/${id}.json`);
    const row = md.split(/\r?\n/).find((l) => l.includes(`/resorts/${id}.webp`) && l.startsWith("|"));
    assert.ok(row, `${id} is missing in the guide`);
    assert.ok(row.includes(String(m.scenery.stand)), `${id}: the guide's stand differs from ${m.scenery.stand}`);
  }
});
