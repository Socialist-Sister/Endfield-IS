import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRoomPlans } from "../src/planningModel.js";
import {
  buildConfigurationShareUrl,
  decodeSharedConfiguration,
  encodeSharedConfiguration,
} from "../src/shareTools.js";

const configuration = {
  mode: "manual",
  selected: ["akekuri", "chen", "perlica"],
  promotions: { akekuri: 2, chen: 4, perlica: 3 },
  manufacturingRecipes: {
    "manufacture-a": "advanced-cognitive-carrier",
    "manufacture-b": "weapon-inspection-kit",
  },
  growthCategory: "fungal",
  roomPlans: normalizeRoomPlans({control:{kind:"single",offsets:[0,2,7]},"manufacture-a":{kind:"dual",start:20,duration:8}}),
};

test("round-trips a compact shared configuration", () => {
  const encoded = encodeSharedConfiguration(configuration);
  const decoded = decodeSharedConfiguration(encoded);
  assert.deepEqual(decoded, {
    ...configuration,
    promotions: { akekuri: 2, perlica: 3 },
  });
});

test("builds a canonical hash URL without exposing query parameters", () => {
  const url = new URL(buildConfigurationShareUrl(configuration));
  assert.equal(url.origin, "https://www.endfieldis.dpdns.org");
  assert.equal(url.pathname, "/");
  assert.equal(url.search, "");
  assert.ok(url.hash.startsWith("#config="));
  assert.equal(decodeSharedConfiguration(url.hash)?.selected.length, 3);
});

test("rejects malformed or unsupported payloads", () => {
  assert.equal(decodeSharedConfiguration("#config=not-base64"), null);
  const unsupported = btoa(JSON.stringify({ v: 99, o: [] }));
  assert.equal(decodeSharedConfiguration(unsupported), null);
});

test("Clipboard API denial falls back and restores keyboard focus", async (t) => {
  const { copyText } = await import("../src/shareTools.js");
  const originals = Object.fromEntries(["navigator", "document"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => { for (const [key, descriptor] of Object.entries(originals)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  const calls = [];
  const input = { style: {}, setAttribute() {}, select() { calls.push("select"); }, remove() { calls.push("remove"); } };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText: async () => { throw new Error("denied"); } } } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    activeElement: { focus() { calls.push("focus"); } },
    createElement() { return input; }, body: { append() {} },
    execCommand() { calls.push("copy"); return true; },
  } });
  await copyText("configuration");
  assert.equal(input.value, "configuration");
  assert.deepEqual(calls, ["select", "copy", "remove", "focus"]);
  calls.length = 0;
  document.execCommand = () => false;
  await assert.rejects(copyText("configuration"), /复制/u);
  assert.deepEqual(calls, ["select", "remove", "focus"]);
});

test("oversized sharing payloads are rejected before decoding", () => {
  assert.equal(decodeSharedConfiguration("a".repeat(65537)), null);
});


test("legacy two-login links migrate to manual AB schedules", () => {
  const legacy = btoa(JSON.stringify({v:1,m:"s",o:["purrchena"],t:["08:00","22:30"]}));
  const result = decodeSharedConfiguration(legacy);
  assert.equal(result.mode, "manual");
  assert.deepEqual(result.roomPlans.control, {kind:"dual",start:8,duration:15,offsets:[0,5,10]});
  assert.match(result.migrationNotice, /AB/);
});
test("v2 half-hour AB links round endpoints visibly without changing single entry offsets", () => {
  const result = decodeSharedConfiguration(btoa(JSON.stringify({v:2,m:"m",o:["si"],p:[["si",2]],b:{
    reception:{kind:"dual",start:22.5,duration:1.5},control:{kind:"single",offsets:[0,2.5,7.5]}
  }})));
  assert.equal(result.roomPlans.reception.start,23);
  assert.equal(result.roomPlans.reception.duration,1);
  assert.deepEqual(result.roomPlans.control.offsets,[0,2.5,7.5]);
  assert.deepEqual(result.selected,["si"]);
  assert.equal(result.promotions.si,2);
  assert.match(result.migrationNotice,/整点/);
  assert.equal(decodeSharedConfiguration(encodeSharedConfiguration(result)).migrationNotice,undefined);
});
test("legacy three-login and AFK links retain inputs but migrate visibly to automatic planning", () => {
  for (const m of ["s", "a"]) {
    const result = decodeSharedConfiguration(btoa(JSON.stringify({v:1,m,o:["purrchena"],p:[["purrchena",2]],t:["00:00","08:00","16:00"],r:["advanced-cognitive-carrier","weapon-inspection-kit"]})));
    assert.equal(result.mode,"auto");assert.deepEqual(result.selected,["purrchena"]);assert.equal(result.promotions.purrchena,2);assert.ok(result.migrationNotice);
  }
});
