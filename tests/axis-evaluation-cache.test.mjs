import test from "node:test";
import assert from "node:assert/strict";
import { cacheEquivalentAxes } from "../src/axisEvaluationCache.js";

const profile = (changes = {}) => ({ moodDrop: 0, moodRegen: 0, outputBonus: 30, ...changes });
const model = (...operators) => [{ operators }];

test("equivalent axis permutations reuse evaluations without changing the candidate", () => {
  let calls = 0;
  const evaluate = cacheEquivalentAxes(model(profile(), profile(), profile()), () => ({ score: ++calls }));
  const axis = Object.freeze([0, 2, 5]);
  const value = evaluate(axis);
  assert.strictEqual(evaluate([5, 0, 2]), value);
  assert.strictEqual(evaluate([2, 5, 0]), value);
  assert.deepEqual(axis, [0, 2, 5]);
  assert.equal(evaluate([0, 2, 6]).score, 2);
  assert.equal(calls, 2);
});

for (const effect of ["moodDrop", "moodRegen", "outputBonus"]) {
  test(`different ${effect} values never share swapped-axis evaluations`, () => {
    let calls = 0;
    const evaluate = cacheEquivalentAxes(model(profile(), profile(), profile({ [effect]: 16 })), () => ++calls);
    assert.notEqual(evaluate([0, 2, 5]), evaluate([5, 2, 0]));
    assert.equal(calls, 2);
  });
}

test("shared-axis equivalence checks every room including Control Nexus", () => {
  let calls = 0;
  const evaluate = cacheEquivalentAxes([
    ...model(profile(), profile(), profile()),
    ...model(profile({ moodRegen: 16 }), profile(), profile()),
  ], () => ++calls);
  assert.notEqual(evaluate([0, 2, 5]), evaluate([5, 2, 0]));
});

test("warmup and verification evaluators keep independent caches", () => {
  const identical = model(profile(), profile(), profile());
  const warmup = cacheEquivalentAxes(identical, () => 1);
  const verification = cacheEquivalentAxes(identical, () => 2);
  assert.equal(warmup([0, 2, 5]), 1);
  assert.equal(verification([0, 2, 5]), 2);
});

test("extra operators using the final offset prevent false slot equivalence", () => {
  let calls = 0;
  const evaluate = cacheEquivalentAxes(model(profile(), profile(), profile(), profile()), () => ++calls);
  assert.notEqual(evaluate([0, 2, 5]), evaluate([5, 2, 0]));
});
