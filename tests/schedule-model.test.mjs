import test from "node:test";
import assert from "node:assert/strict";
import { AXIS_SCOPES, CLUE_BASE_HOURS, GROWTH_BOX_COUNT, GROWTH_PRODUCT_HOURS, MFG_PRODUCT_HOURS, buildDailySummary, evaluateStartupOffsets, optimizeStartupAxis, productionFactor } from "../src/scheduleModel.js";
import { OPERATORS, sortSkillsForDisplay } from "../src/operatorData.js";
import { optimizeAfkAssignments, optimizeShiftAssignments, prepareCandidate } from "../src/assignmentOptimizer.js";

const skill = (category, value) => ({ category, activeTier: { value } });
const operator = (id, skills) => ({ id, activeSkills: skills });

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

test("roster remains 29 unique two-skill operators and Avywenna targets clue 2", () => {
  assert.equal(OPERATORS.length, 29);
  assert.equal(new Set(OPERATORS.map((item) => item.id)).size, 29);
  assert.ok(OPERATORS.every((item) => item.skills.length === 2));
  const avywenna = OPERATORS.find((item) => item.id === "avywenna");
  assert.equal(avywenna.skills[1].category, "clue-special");
  assert.equal(avywenna.skills[1].clue, 2);
});

test("AFK startup solver returns a normalized half-hour axis", () => {
  const rooms = [{ id: "control", type: "总控中枢" }];
  const controlTeam = [1, 2, 3].map((id) => operator(`c${id}`, [skill("mood-regen", 16)]));
  const result = optimizeStartupAxis({
    rooms,
    assignments: { control: controlTeam },
    priority: "balanced",
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
  const optimized = optimizeStartupAxis({ rooms, assignments, priority: "weapon-exp", axisScope: "shared" });
  const evaluate = (axis) => evaluateStartupOffsets({
    rooms,
    assignments,
    priority: "weapon-exp",
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
  const optimized = optimizeStartupAxis({ rooms, assignments, priority: "weapon-exp", axisScope: "shared" });
  const evaluate = (axis) => evaluateStartupOffsets({
    rooms,
    assignments,
    priority: "weapon-exp",
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
    priority: "weapon-exp",
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
    priority: "weapon-exp",
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
    priority: "weapon-exp",
    growthCategory: "vitrified",
    loginTimes,
  });
  const signature = (value) => rooms.map((room) => value[room.id].map((team) => team.map((item) => item.id).join(",")).join("/")).join("|");
  assert.notEqual(signature(build(["08:00", "22:30"])), signature(build(["08:00", "13:00"])));
});

test("operators without unlocked room skills remain valid 40% assignment fillers", () => {
  const raw = { id: "filler", name: "填充", rarity: 4, skills: [] };
  const candidate = prepareCandidate(raw, { id: "manufacture-a", type: "制造舱" }, 0, "weapon-exp", "vitrified");
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
    priority: "weapon-exp",
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
    priority: "weapon-exp",
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
    priority: "balanced",
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
    priority: "balanced",
  });
  assert.ok(Math.abs(result.clues - ((24 * 1.4) / CLUE_BASE_HOURS)) < 1e-9);
});

test("manufacturing priority routes both cabins into only the selected output", () => {
  const rooms = [{ id: "manufacture-a", type: "制造舱" }, { id: "manufacture-b", type: "制造舱" }, { id: "reception", type: "会客室" }, { id: "control", type: "总控中枢" }];
  const dualTeam = [1, 2, 3].map((id) => operator(`d${id}`, [skill("weapon-exp", 20), skill("operator-exp", 20)]));
  const baseInput = {
    mode: "shift",
    rooms,
    assignments: {},
    shiftAssignments: {
      "manufacture-a": [dualTeam],
      "manufacture-b": [dualTeam],
      reception: [[]],
      control: [[]],
    },
    loginTimes: ["00:00"],
  };
  const weapon = buildDailySummary({ ...baseInput, priority: "weapon-exp" });
  const operatorExp = buildDailySummary({ ...baseInput, priority: "operator-exp" });
  const totalWeaponHours = weapon.rooms["manufacture-a"].effectiveHoursPerDay + weapon.rooms["manufacture-b"].effectiveHoursPerDay;
  assert.equal(weapon.operator, 0);
  assert.ok(Math.abs(weapon.weapon - (totalWeaponHours / MFG_PRODUCT_HOURS)) < 1e-9);
  assert.equal(operatorExp.weapon, 0);
  assert.ok(operatorExp.operator > 0);
});
