import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConfigurationShareUrl,
  decodeSharedConfiguration,
  encodeSharedConfiguration,
} from "../src/shareTools.js";

const configuration = {
  mode: "shift",
  selected: ["akekuri", "chen", "perlica"],
  promotions: { akekuri: 2, chen: 4, perlica: 3 },
  manufacturingRecipes: {
    "manufacture-a": "advanced-cognitive-carrier",
    "manufacture-b": "weapon-inspection-kit",
  },
  growthCategory: "fungal",
  axisScope: "facility",
  loginTimes: ["08:00", "22:30"],
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
