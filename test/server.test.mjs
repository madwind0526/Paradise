import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// A throwaway server on its own port, so the tests never touch the running app.
const PORT = 4399;
const base = `http://127.0.0.1:${PORT}`;
let server;

before(async () => {
  server = spawn(process.execPath, [fileURLToPath(new URL("../server/index.mjs", import.meta.url))], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 40; i++) {
    try { await fetch(base + "/api/figures"); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error("server did not start");
});
after(() => server?.kill());

const post = (path, body, headers = { "content-type": "application/json" }) => fetch(base + path, { method: "POST", headers, body });

test("writes need JSON from this app's own pages", async () => {
  const map = JSON.stringify({ schema: "paradise.map/1", name: "T" });
  assert.equal((await post("/api/maps/save", JSON.stringify({ spec: JSON.parse(map) }), { "content-type": "text/plain" })).status, 403); // a cross-site form can send this
  assert.equal((await post("/api/maps/save", JSON.stringify({ spec: JSON.parse(map) }), { "content-type": "application/json", "sec-fetch-site": "cross-site" })).status, 403);
  assert.equal((await post("/api/maps/save", JSON.stringify({ spec: { schema: "x" } }), { "content-type": "text/plain" })).status, 403);
  assert.equal((await fetch(base + "/api/settings", { method: "PUT", headers: { "content-type": "text/plain" }, body: "{}" })).status, 403);
});

test("a bad map is refused before anything is written", async () => {
  assert.equal((await post("/api/maps/save", JSON.stringify({ spec: { schema: "x" } }))).status, 400);
});

test("paths outside the app are not served", async () => {
  assert.equal((await fetch(base + "/..%2fserver%2findex.mjs")).status, 404);
  assert.equal((await fetch(base + "/%2e%2e/package.json")).status, 404);
});

test("images are served with an image type", async () => {
  const r = await fetch(base + "/resorts/maldives-card.jpg");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/jpeg");
});
