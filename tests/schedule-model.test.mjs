import test from "node:test";
import assert from "node:assert/strict";
import { AXIS_SCOPES, CLUE_BASE_HOURS, DEFAULT_MANUFACTURING_RECIPES, GROWTH_BOX_COUNT, GROWTH_PRODUCT_HOURS, MANUFACTURING_RECIPES, buildDailySummary, evaluateStartupOffsets, optimizeStartupAxis, productionFactor } from "../src/scheduleModel.js";
import { OPERATORS, sortSkillsForDisplay } from "../src/operatorData.js";
import { optimizeAfkAssignments, optimizeShiftAssignments, prepareCandidate } from "../src/assignmentOptimizer.js";

const skill = (category, value) => ({ category, activeTier: { value } });
const operator = (id, skills) => ({ id, activeSkills: skills });
const DEFAULT_RECIPES = { ...DEFAULT_MANUFACTURING_RECIPES };
const WEAPON_RECIPES = { ...DEFAULT_RECIPES, "manufacture-a": "weapon-inspection-kit" };

test("default manufacturing recipes match the configuration defaults", () => {
  assert.deepEqual(DEFAULT_RECIPES, {
    "manufacture-a": "advanced-cognitive-carrier",
    "manufacture-b": "advanced-battle-record",
  });
});

test("three 10% operators produce the documented 286% factor", () => {
  const team = [1, 2, 3].map((id) => operator(String(id), [skill("weapon-exp", 10)]));
  assert.ok(Math.abs(productionFactor(team, "weapon-exp") - 2.86) < 1e-9);
});

test("skill display order keeps output effects before mood effects", () => {
  const ordered = sortSkillsForDisplay([
    { category: "mood-drop", name: "mood" },
    { category: "weapon-exp", name: "output" },
    { category: "mood-regen", name: "recovery" },
  ]);
  assert.deepEqual(ordered.map((item) => item.name), ["output", "recovery", "mood"]);
});

test("roster remains 30 unique two-skill operators with verified clue and growth data", () => {
  assert.equal(OPERATORS.length, 30);
  assert.equal(new Set(OPERATORS.map((item) => item.id)).size, 30);
  assert.ok(OPERATORS.every((item) => item.skills.length === 2));
  const avywenna = OPERATORS.find((item) => item.id === "avywenna");
  assert.equal(avywenna.skills[1].category, "clue-special");
  assert.equal(avywenna.skills[1].clue, 2);
  const typhoeus = OPERATORS.find((item) => item.id === "typhoeus");
  assert.deepEqual(typhoeus.skills.map((item) => item.category), ["rare-mineral", "fungal"]);
  assert.deepEqual(typhoeus.skills[0].tiers.map((item) => [item.promotion, item.value]), [[1, 20], [3, 30]]);
  assert.deepEqual(typhoeus.skills[1].tiers.map((item) => [item.promotion, item.value]), [[2, 20], [4, 30]]);
});

test("AFK startup solver returns a normalized half-hour axis", () => {
  const rooms = [{ id: "control", type: "总控中枢" }];
  const controlTeam = [1, 2, 3].map((id) => operator(`c${id}`, [skill("mood-regen", 16)]));
  const result = optimizeStartupAxis({
    rooms,
    assignments: { control: controlTeam },
    manufacturingRecipes: DEFAULT_RECIPES,
    axisScope: "shared",
  });
  assert.equal(AXIS_SCOPES.shared.label, "统一启动轴");
  assert.equal(Math.min(...result.sharedOffsets), 0);
  assert.ok(result.sharedOffsets.every((offset) => Number.isInteger(offset * 2)));
  assert.ok(result.evaluatedCandidates > 2);
});

test("automatic shared axis is not worse than either former reference pattern", () => {
  const rooms = [{ id: "manufacture-a", type: "制造舱" }, { id: "control", type: "总控中枢" }];
  const manufacturingTeam = [1, 2, 3].map((id) => operator(`w${id}`, [skill("weapon-exp", 30)]));
  const controlTeam = [1, 2, 3].map((id) => operator(`c${id}`, [skill("mood-regen", 16)]));
  const assignments = { "manufacture-a": manufacturingTeam, control: controlTeam };
  const optimized = optimizeStartupAxis({ rooms, assignments, manufacturingRecipes: WEAPON_RECIPES, axisScope: "shared" });
  const evaluate = (axis) => evaluateStartupOffsets({
    rooms,
    assignments,
    manufacturingRecipes: WEAPON_RECIPES,
    offsetsByRoom: Object.fromEntries(rooms.map((room) => [room.id, axis])),
    warmupDays: optimized.warmupDays,
    sampleDays: optimized.sampleDays,
  }).rooms["manufacture-a"].effectiveHoursPerDay;
  const optimizedOutput = evaluate(optimized.sharedOffsets);
  assert.ok(optimizedOutput >= evaluate([0, 5, 10]) - 1e-7);
  assert.ok(optimizedOutput >= evaluate([0, 0, 8]) - 1e-7);
});

test("long-window verification catches the tight-stagger mood-cycle pattern", () => {
  const rooms = [{ id: "manufacture-a", type: "制造舱" }, { id: "control", type: "总控中枢" }];
  const manufacturingTeam = [1, 2, 3].map((id) => operator(`mr${id}`, [skill("weapon-exp", 30), skill("mood-drop", 18)]));
  const controlTeam = [1, 2, 3].map((id) => operator(`cr${id}`, [skill("mood-regen", 16)]));
  const assignments = { "manufacture-a": manufacturingTeam, control: controlTeam };
  const optimized = optimizeStartupAxis({ rooms, assignments, manufacturingRecipes: WEAPON_RECIPES, axisScope: "shared" });
  const evaluate = (axis) => evaluateStartupOffsets({
    rooms,
    assignments,
    manufacturingRecipes: WEAPON_RECIPES,
    offsetsByRoom: Object.fromEntries(rooms.map((room) => [room.id, axis])),
    warmupDays: optimized.warmupDays,
    sampleDays: optimized.sampleDays,
  }).rooms["manufacture-a"].effectiveHoursPerDay;
  assert.ok(evaluate(optimized.sharedOffsets) >= evaluate([0, 0.5, 13]) - 1e-7);
  assert.ok(evaluate(optimized.sharedOffsets) >= evaluate([0, 2, 4]) - 1e-7);
});

test("three rested groups retain the full multiplicative factor during eight-hour shifts", () => {
  const rooms = [{ id: "manufacture-a", type: "制造舱" }, { id: "manufacture-b", type: "制造舱" }, { id: "reception", type: "会客室" }, { id: "control", type: "总控中枢" }];
  const weaponTeams = [0, 1, 2].map((group) => [1, 2, 3].map((id) => operator(`w${group}-${id}`, [skill("weapon-exp", 10)])));
  const emptyShifts = [[], [], []];
  const result = buildDailySummary({
    mode: "shift",
    rooms,
    assignments: {},
    shiftAssignments: {
      "manufacture-a": weaponTeams,
      "manufacture-b": emptyShifts,
      reception: emptyShifts,
      control: emptyShifts,
    },
    loginTimes: ["00:00", "08:00", "16:00"],
    manufacturingRecipes: WEAPON_RECIPES,
  });
  assert.ok(Math.abs(result.rooms["manufacture-a"].averageFactor - 2.86) < 1e-9);
  assert.equal(result.rooms["manufacture-a"].coverageRate, 1);
});

test("fixed shifts inherit mood instead of resetting a reused team to full", () => {
  const rooms = [{ id: "manufacture-a", type: "制造舱" }, { id: "control", type: "总控中枢" }];
  const reusedTeam = [1, 2, 3].map((id) => operator(`r${id}`, [skill("weapon-exp", 10)]));
  const result = buildDailySummary({
    mode: "shift",
    rooms,
    assignments: {},
    shiftAssignments: { "manufacture-a": [reusedTeam, reusedTeam], control: [[], []] },
    loginTimes: ["08:00", "20:00"],
    manufacturingRecipes: WEAPON_RECIPES,
  });
  assert.ok(result.rooms["manufacture-a"].coverageRate < 1);
  assert.ok(result.rooms["manufacture-a"].averageFactor < 2.86);
});

test("fixed-shift optimizer changes teams when login intervals change", () => {
  const rooms = [
    { id: "manufacture-a", type: "制造舱" },
    { id: "manufacture-b", type: "制造舱" },
    { id: "growth", type: "培养舱" },
    { id: "reception", type: "会客室" },
    { id: "control", type: "总控中枢" },
  ];
  const promotions = Object.fromEntries(OPERATORS.map((item) => [item.id, 4]));
  const build = (loginTimes) => optimizeShiftAssignments({
    operators: OPERATORS,
    promotions,
    rooms,
    manufacturingRecipes: DEFAULT_RECIPES,
    growthCategory: "vitrified",
    loginTimes,
  });
  const signature = (value) => rooms.map((room) => value[room.id].map((team) => team.map((item) => item.id).join(",")).join("/")).join("|");
  assert.notEqual(signature(build(["08:00", "22:30"])), signature(build(["08:00", "13:00"])));
});

test("operators without unlocked room skills remain valid 40% assignment fillers", () => {
  const raw = { id: "filler", name: "填充", rarity: 4, skills: [] };
  const candidate = prepareCandidate(raw, { id: "manufacture-a", type: "制造舱" }, 0, DEFAULT_RECIPES, "vitrified");
  assert.deepEqual(candidate.activeSkills, []);
  assert.equal(productionFactor([candidate], "weapon-exp"), 1.4);
});

test("AFK joint allocation is unique across rooms and never mixes mood groups", () => {
  const rooms = [
    { id: "manufacture-a", type: "制造舱" },
    { id: "manufacture-b", type: "制造舱" },
    { id: "growth", type: "培养舱" },
    { id: "reception", type: "会客室" },
    { id: "control", type: "总控中枢" },
  ];
  const promotions = Object.fromEntries(OPERATORS.map((item) => [item.id, 4]));
  const assignments = optimizeAfkAssignments({
    operators: OPERATORS,
    promotions,
    rooms,
    manufacturingRecipes: DEFAULT_RECIPES,
    growthCategory: "vitrified",
  });
  const ids = rooms.flatMap((room) => assignments[room.id].map((item) => item.id));
  assert.equal(ids.length, new Set(ids).size);
  rooms.filter((room) => room.id !== "control").forEach((room) => {
    const moodCount = assignments[room.id].filter((item) => item.activeSkills.some((active) => active.category === "mood-drop")).length;
    assert.ok(moodCount === 0 || moodCount === assignments[room.id].length);
  });
  const e0Assignments = optimizeAfkAssignments({
    operators: OPERATORS,
    promotions: Object.fromEntries(OPERATORS.map((item) => [item.id, 0])),
    rooms,
    manufacturingRecipes: DEFAULT_RECIPES,
    growthCategory: "vitrified",
  });
  assert.equal(rooms.flatMap((room) => e0Assignments[room.id]).length, 15);
});

test("growth output uses only the selected recipe and nine max-level boxes", () => {
  const rooms = [{ id: "growth", type: "培养舱" }, { id: "control", type: "总控中枢" }];
  const growthTeams = [0, 1, 2].map((group) => [1, 2, 3].map((id) => operator(`g${group}-${id}`, [skill("rare-mineral", 30), skill("vitrified", 0)])));
  const result = buildDailySummary({
    mode: "shift",
    rooms,
    assignments: {},
    shiftAssignments: { growth: growthTeams, control: [[], [], []] },
    loginTimes: ["00:00", "08:00", "16:00"],
    manufacturingRecipes: DEFAULT_RECIPES,
    growthCategory: "vitrified",
  });
  const expected = ((24 * 2.2) / GROWTH_PRODUCT_HOURS) * GROWTH_BOX_COUNT;
  assert.ok(Math.abs(result.growth - expected) < 1e-9);
});

test("clue estimate has no unverified fixed daily clue", () => {
  const rooms = [{ id: "reception", type: "会客室" }, { id: "control", type: "总控中枢" }];
  const receptionists = [0, 1, 2].map((index) => [operator(`clue-${index}`, [])]);
  const result = buildDailySummary({
    mode: "shift",
    rooms,
    assignments: {},
    shiftAssignments: { reception: receptionists, control: [[], [], []] },
    loginTimes: ["00:00", "08:00", "16:00"],
    manufacturingRecipes: DEFAULT_RECIPES,
  });
  assert.ok(Math.abs(result.clues - ((24 * 1.4) / CLUE_BASE_HOURS)) < 1e-9);
});

test("manufacturing cabins route independently and use recipe-specific durations", () => {
  const rooms = [{ id: "manufacture-a", type: "制造舱" }, { id: "manufacture-b", type: "制造舱" }, { id: "reception", type: "会客室" }, { id: "control", type: "总控中枢" }];
  const dualTeam = [1, 2, 3].map((id) => operator(`d${id}`, [skill("weapon-exp", 20), skill("operator-exp", 20)]));
  const baseInput = {
    mode: "shift",
    rooms,
    assignments: {},
    shiftAssignments: {
      "manufacture-a": [dualTeam],
      "manufacture-b": [dualTeam.map((entry) => ({ ...entry, id: `${entry.id}-b` }))],
      reception: [[]],
      control: [[]],
    },
    loginTimes: ["00:00"],
  };
  const result = buildDailySummary({
    ...baseInput,
    manufacturingRecipes: {
      "manufacture-a": "advanced-cognitive-carrier",
      "manufacture-b": "weapon-inspection-kit",
    },
  });
  assert.equal(result.operator, 0);
  assert.ok(result.cognitive > 0 && result.weapon > 0);
  assert.ok(Math.abs(result.cognitive - (
    result.rooms["manufacture-a"].effectiveHoursPerDay / MANUFACTURING_RECIPES["advanced-cognitive-carrier"].hours
  )) < 1e-9);
  assert.ok(Math.abs(result.weapon - (
    result.rooms["manufacture-b"].effectiveHoursPerDay / MANUFACTURING_RECIPES["weapon-inspection-kit"].hours
  )) < 1e-9);
});

test("two cabins selecting the same manufacturing recipe aggregate their output", () => {
  const rooms = [{ id: "manufacture-a", type: "制造舱" }, { id: "manufacture-b", type: "制造舱" }, { id: "control", type: "总控中枢" }];
  const teamA = [1, 2, 3].map((id) => operator(`a${id}`, [skill("operator-exp", 10)]));
  const teamB = [1, 2, 3].map((id) => operator(`b${id}`, [skill("operator-exp", 10)]));
  const result = buildDailySummary({
    mode: "shift",
    rooms,
    assignments: {},
    shiftAssignments: {
      "manufacture-a": [teamA],
      "manufacture-b": [teamB],
      control: [[]],
    },
    loginTimes: ["00:00"],
    manufacturingRecipes: {
      "manufacture-a": "advanced-battle-record",
      "manufacture-b": "advanced-battle-record",
    },
  });
  const totalEffectiveHours = result.rooms["manufacture-a"].effectiveHoursPerDay
    + result.rooms["manufacture-b"].effectiveHoursPerDay;
  assert.equal(result.cognitive, 0);
  assert.equal(result.weapon, 0);
  assert.ok(Math.abs(result.operator - (
    totalEffectiveHours / MANUFACTURING_RECIPES["advanced-battle-record"].hours
  )) < 1e-9);
});

test("a rotating operator uses each room's prepared skills while retaining mood", () => {
  const rooms = [{ id: "manufacture-a", type: "制造舱" }, { id: "growth", type: "培养舱" }];
  const workerInManufacturing = operator("rotating", [skill("weapon-exp", 100)]);
  const workerInGrowth = operator("rotating", [skill("rare-mineral", 50)]);
  const result = buildDailySummary({
    mode: "shift", rooms, assignments: {},
    shiftAssignments: { "manufacture-a": [[workerInManufacturing], [], []], growth: [[], [workerInGrowth], []] },
    loginTimes: ["00:00", "08:00", "16:00"], manufacturingRecipes: WEAPON_RECIPES, growthCategory: "rare-mineral",
  });
  assert.ok(result.rooms.growth.coverageRate > 0);
  assert.ok(Math.abs(result.rooms.growth.averageFactor / result.rooms.growth.coverageRate - 2.1) < 1e-9);
  assert.ok(Math.abs(result.rooms["manufacture-a"].averageFactor / result.rooms["manufacture-a"].coverageRate - 2.8) < 1e-9);
});

test("sorting login clocks keeps assignments attached to their original clock", () => {
  const rooms = [{ id: "manufacture-a", type: "制造舱" }];
  const team = [operator("worker", [skill("weapon-exp", 30)])];
  const options = { mode: "shift", rooms, assignments: {}, manufacturingRecipes: WEAPON_RECIPES };
  const sorted = buildDailySummary({ ...options, loginTimes: ["00:00", "08:00", "20:00"], shiftAssignments: { "manufacture-a": [team, [], []] } });
  const unsorted = buildDailySummary({ ...options, loginTimes: ["20:00", "00:00", "08:00"], shiftAssignments: { "manufacture-a": [[], team, []] } });
  assert.deepEqual(unsorted, sorted);
});

test("a small E0 roster opens productive rooms instead of packing one cabin", () => {
  const rooms = [{ id: "manufacture-a", type: "制造舱" }, { id: "manufacture-b", type: "制造舱" }, { id: "growth", type: "培养舱" }, { id: "reception", type: "会客室" }, { id: "control", type: "总控中枢" }];
  const operators = OPERATORS.slice(0, 3);
  const promotions = Object.fromEntries(operators.map((entry) => [entry.id, 0]));
  const options = { rooms, operators, promotions, manufacturingRecipes: DEFAULT_RECIPES, growthCategory: "rare-mineral" };
  const assignments = optimizeAfkAssignments(options);
  assert.equal(rooms.filter((room) => room.id !== "control" && assignments[room.id].length).length, 3);
  const packed = Object.fromEntries(rooms.map((room) => [room.id, room.id === "manufacture-a" ? operators.map((entry) => prepareCandidate(entry, room, 0, DEFAULT_RECIPES, "rare-mineral")) : []]));
  const evaluate = (teams) => evaluateStartupOffsets({ ...options, assignments: teams, offsetsByRoom: Object.fromEntries(rooms.map((room) => [room.id, [0, 0, 0]])) }).averageEfficiency;
  assert.ok(evaluate(assignments) > evaluate(packed) * 1.5);
});

test("an empty login schedule produces finite zero outputs", () => {
  const result = buildDailySummary({ mode: "shift", rooms: [{ id: "growth", type: "培养舱" }], assignments: {}, shiftAssignments: { growth: [] }, loginTimes: [], growthCategory: "rare-mineral" });
  assert.equal(result.growth, 0);
  assert.equal(result.averageCoverage, 0);
  assert.equal(result.moodRecovery, 12);
});
