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
  const m = validateMap({ schema: "paradise.map/1", name: "x", sky: { hour: 17.9, clouds: 4 }, scenery: { horizon: -2 } }).value;
  assert.equal(m.sky.hour, 17.9);
  assert.equal(m.sky.clouds, 1);
  assert.equal(m.scenery.horizon, 0);
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
  assert.equal(validateMap({ ...ok, scenery: { mountains: "lava" } }).ok, false);
  assert.equal(validateMap({ ...ok, sky: { picture: "http://evil/x.jpg" } }).ok, false);
  assert.equal(validateMap({ ...ok, sky: { nightPhotos: "../etc" } }).ok, false);
});
