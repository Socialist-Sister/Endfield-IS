import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { OPERATORS, getActiveSkill } from "../src/operatorData.js";
import { prepareCandidate } from "../src/assignmentOptimizer.js";
import { MANUFACTURING_RECIPES, DEFAULT_MANUFACTURING_RECIPES, productionFactor } from "../src/scheduleModel.js";
import { encodeSharedConfiguration, decodeSharedConfiguration } from "../src/shareTools.js";

const purrchena = OPERATORS.find(({ id }) => id === "purrchena");

test("Purrchena unlocks the correct reception and manufacturing effects at E0–E4", () => {
  assert.equal(purrchena.name, "噗切娜");
  assert.equal(purrchena.rarity, 5);
  assert.ok(existsSync(new URL(`../public${purrchena.avatar}`, import.meta.url)));
  assert.deepEqual(purrchena.skills.map(({ name }) => name), ["形象代言人", "任务后的点心"]);
  for (const [promotion, clueLevel, exp] of [[0, 0, 0], [1, 1, 0], [2, 1, 20], [3, 2, 20], [4, 2, 30]]) {
    const clue = getActiveSkill(purrchena.skills[0], promotion);
    assert.equal(clue?.biasLevel ?? 0, clueLevel);
    assert.equal(purrchena.skills[0].clue, 2);
    const candidate = prepareCandidate(purrchena, { id: "manufacture-a", type: "制造舱" }, promotion, DEFAULT_MANUFACTURING_RECIPES);
    assert.ok(Math.abs(productionFactor([candidate], "operator-exp") - 1.4 * (1 + exp / 100)) < 1e-10);
  }
});

test("Purrchena boosts both operator EXP recipes but never weapon materials or clue totals", () => {
  for (const [recipe, data] of Object.entries(MANUFACTURING_RECIPES)) {
    const recipes = { ...DEFAULT_MANUFACTURING_RECIPES, "manufacture-a": recipe };
    const candidate = prepareCandidate(purrchena, { id: "manufacture-a", type: "制造舱" }, 4, recipes);
    assert.ok(Math.abs(productionFactor([candidate], data.skillCategory) - (recipe === "weapon-inspection-kit" ? 1.4 : 1.82)) < 1e-10);
  }
  const team = [purrchena, OPERATORS.find(({ id }) => id === "avywenna")].map((op) =>
    prepareCandidate(op, { id: "reception", type: "会客室" }, 4, DEFAULT_MANUFACTURING_RECIPES));
  assert.equal(productionFactor(team, "clue-rate"), 1.8);
  assert.equal(productionFactor([team[0]], "clue-rate"), 1.4);
});

test("Purrchena ownership and promotion survive configuration sharing", () => {
  const input = { mode: "afk", selected: ["purrchena", "typhoeus"], promotions: { purrchena: 2 }, manufacturingRecipes: DEFAULT_MANUFACTURING_RECIPES, growthCategory: "rare-mineral", axisScope: "shared", loginTimes: ["08:00", "20:00"] };
  const output = decodeSharedConfiguration(encodeSharedConfiguration(input));
  assert.deepEqual(output.selected, ["purrchena", "typhoeus"]);
  assert.equal(output.promotions.purrchena, 2);
});
