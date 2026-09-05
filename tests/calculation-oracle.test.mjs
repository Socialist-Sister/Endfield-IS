import test from "node:test";
import assert from "node:assert/strict";
import { evaluateStartupOffsets, evaluateShiftAssignments } from "../src/scheduleModel.js";

// Independent closed-form expectations: do not reuse productionFactor or model constants.
const worker = (id, values = {}) => ({ id, activeSkills: Object.entries(values).map(([category, value]) => ({ category, activeTier: { value } })) });
const manufacturing = { id: "manufacture-a", type: "制造舱" };
const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
const afk = (team, options = {}) => evaluateStartupOffsets({ rooms: [manufacturing], assignments: { "manufacture-a": team }, offsetsByRoom: { "manufacture-a": [0, 0, 0] }, ...options });
const shift = (teams, options = {}) => evaluateShiftAssignments({ rooms: [manufacturing], shiftAssignments: { "manufacture-a": teams }, loginTimes: ["00:00", "12:00"], ...options });

test("one full AFK cycle matches the analytic 12/19 work fraction", () => {
  const cycle = 100 / 7 + 100 / 12;
  const result = afk([worker("a")], { warmupDays: 0, sampleDays: cycle * 20 / 24 });
  close(result.rooms[manufacturing.id].coverageRate, 12 / 19);
  close(result.rooms[manufacturing.id].averageFactor, 1.4 * 12 / 19);
  close(result.cognitive, (24 * 1.4 * 12 / 19) / (220 / 9));
});

test("synchronized reduction team adds reductions before multiplying production", () => {
  const cycle = 100 / (7 * 0.7) + 100 / 12;
  const result = afk([1, 2, 3].map((id) => worker(id, { "mood-drop": 10, "operator-exp": 20, "weapon-exp": 90 })), { warmupDays: 0, sampleDays: cycle * 20 / 24 });
  const coverage = (100 / 4.9) / cycle;
  close(result.rooms[manufacturing.id].coverageRate, coverage);
  close(result.rooms[manufacturing.id].averageFactor, 2.2 * 1.6 * coverage);
});

test("staggered AFK matches integration of independently constructed periodic intervals", () => {
  const offsets = [0, 2.5, 7];
  const bonuses = [0.1, 0.2, 0.3];
  const begin = 60 * 24;
  const end = 90 * 24;
  const period = 100 / 7 + 100 / 12;
  const intervals = offsets.map((offset) => {
    const periods = [];
    for (let k = 0; offset + k * period < end; k += 1) {
      const start = offset + k * period;
      periods.push([start, start + 100 / 7]);
    }
    return periods;
  });
  const edges = [...new Set([begin, end, ...intervals.flat(2).filter((edge) => edge > begin && edge < end)])].sort((a, b) => a - b);
  let produced = 0;
  let covered = 0;
  let staffed = 0;
  for (let i = 1; i < edges.length; i += 1) {
    const midpoint = (edges[i - 1] + edges[i]) / 2;
    const active = intervals.map((periods) => periods.some(([a, b]) => a < midpoint && midpoint < b));
    const n = active.filter(Boolean).length;
    const dt = edges[i] - edges[i - 1];
    produced += n ? dt * (1 + n * 0.4) * (1 + bonuses.reduce((sum, bonus, j) => sum + (active[j] ? bonus : 0), 0)) : 0;
    covered += n ? dt : 0;
    staffed += n * dt;
  }
  const result = afk(bonuses.map((bonus, id) => worker(id, { "operator-exp": bonus * 100 })), { offsetsByRoom: { "manufacture-a": offsets }, warmupDays: 60, sampleDays: 30 });
  close(result.rooms[manufacturing.id].averageFactor, produced / (end - begin));
  close(result.rooms[manufacturing.id].coverageRate, covered / (end - begin));
  close(result.rooms[manufacturing.id].averageActive, staffed / (end - begin));
});

test("Control Nexus recovery bonuses disappear when its synchronized staff rests", () => {
  const period = 100 / 7 + 100 / 12;
  const result = afk([worker("a")], {
    rooms: [manufacturing, { id: "control", type: "总控中枢" }],
    assignments: { "manufacture-a": [worker("a")], control: [worker("c", { "mood-regen": 50 })] },
    warmupDays: 0, sampleDays: period * 20 / 24,
  });
  close(result.rooms[manufacturing.id].averageFactor, 1.4 * 12 / 19);
  close(result.moodRecovery, 12 + 6 * 12 / 19);
});

test("two distinct twelve-hour teams are fully recovered and sustain the exact staffed factor", () => {
  const teams = [0, 1].map((group) => [0, 1, 2].map((id) => worker(`${group}-${id}`, { "operator-exp": 10 })));
  const result = shift(teams);
  close(result.rooms[manufacturing.id].averageFactor, 2.86);
  close(result.rooms[manufacturing.id].coverageRate, 1);
  close(result.cognitive, 24 * 2.86 / (220 / 9));
});

test("empty replacement shift stops production and lets the outgoing operator recover", () => {
  const result = shift([[worker("a")], []]);
  close(result.rooms[manufacturing.id].averageFactor, 0.7);
  close(result.rooms[manufacturing.id].coverageRate, 0.5);
  close(result.rooms[manufacturing.id].downtimeHours, 12);
});

test("special-clue levels do not change total clues", () => {
  const rooms = [{ id: "reception", type: "会客室" }];
  const calculate = (values) => evaluateShiftAssignments({ rooms, loginTimes: ["00:00", "12:00"], shiftAssignments: { reception: [[worker("a", values)], [worker("b", values)]] } });
  const plain = calculate({});
  const specific = calculate({ "clue-special": 2 });
  close(specific.clues, plain.clues);
  close(specific.clues, 24 * 1.4 / 72);
});

test("an entirely unstaffed model has zero output and base recovery", () => {
  const result = afk([]);
  for (const key of ["cognitive", "operator", "weapon", "growth", "clues", "averageEfficiency", "averageCoverage"]) assert.equal(result[key], 0);
  assert.equal(result.moodRecovery, 12);
});
