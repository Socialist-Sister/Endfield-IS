import { maximizeAssignment, prepareCandidate, optimizeAfkAssignments, summaryObjective } from "./assignmentOptimizer.js";
import { optimizeStartupAxis, sumSkillValue, manufacturingSkillCategory } from "./scheduleModel.js";
import { normalizeRoomPlans, compilePlan, simulatePlan, evaluatePlan } from "./planningModel.js";

const SEARCH = { warmupDays: 20, sampleDays: 10 };
const VERIFY = { warmupDays: 180, sampleDays: 90 };
const clone = (value) => structuredClone(value);
function categoryFor(room, input) {
  return room.type === "制造舱" ? manufacturingSkillCategory(room.id, input.manufacturingRecipes) : room.id === "growth" ? input.growthCategory : room.id === "reception" ? "clue-rate" : null;
}
function allocate(input, plans, moodWeight, singlePolicy = "plain") {
  const prepared = input.rooms.map((room) => input.operators.map((op) => prepareCandidate(op, room, input.promotions[op.id] ?? 4, input.manufacturingRecipes, input.growthCategory)));
  const slots = input.rooms.flatMap((room, ri) => Array.from({ length: plans[room.id].kind === "single" ? 3 : 6 }, (_, i) => ({ room, ri, gi: Math.floor(i / 3), index: i % 3 })));
  const weights = slots.map(({ room, ri, gi, index }) => [...prepared[ri].map((op) => {
    const plan = plans[room.id];
    const output = sumSkillValue([op], categoryFor(room, input));
    const drop = sumSkillValue([op], "mood-drop");
    if (plan.kind === "single" && room.id !== "control" && ((singlePolicy === "plain" && drop > 0) || (singlePolicy === "mood" && drop === 0))) return -1e6;
    const duration = plan.kind === "single" ? 24 : gi === 0 ? plan.duration : 24 - plan.duration;
    const drain = 7 * (1 - drop / 100);
    const fraction = plan.kind === "single" ? 12 / (12 + drain) : Math.min(duration, 100 / drain, 24 * 12 / (12 + drain)) / 24;
    if (room.id === "control") return sumSkillValue([op], "mood-regen") * 2.6 * fraction + 1e-4 * op.rarity;
    return ((index === 0 ? 100 : 0) + 40 + 2.2 * output + moodWeight * drop) * fraction + 1e-4 * op.rarity;
  }), ...slots.map(() => 0)]);
  const matched = maximizeAssignment(weights);
  const teams = Object.fromEntries(input.rooms.map((room) => [room.id, [[], []]]));
  slots.forEach(({ room, ri, gi }, index) => {
    const column = matched[index];
    if (column >= 0 && column < input.operators.length && weights[index][column] > 0) teams[room.id][gi].push(prepared[ri][column]);
  });
  return teams;
}
function score(summary, rooms) {
  return rooms.filter((room) => room.id !== "control").reduce((sum, room) => sum + summary.rooms[room.id].averageFactor, 0);
}
function legalSingle(teams, plans, rooms) {
  return rooms.every((room) => room.id === "control" || plans[room.id].kind !== "single" || teams[room.id][0].every((op) => sumSkillValue([op], "mood-drop") > 0) || teams[room.id][0].every((op) => sumSkillValue([op], "mood-drop") === 0));
}
function signature(teams, plans, rooms) {
  return JSON.stringify(rooms.map((room) => [plans[room.id], teams[room.id].map((team) => team.map((op) => op.id))]));
}
export function optimizePlan(input, onProgress = () => {}) {
  const manual = input.mode === "manual";
  const ids = input.rooms.map((room) => room.id);
  const initial = normalizeRoomPlans(input.roomPlans, ids);
  const prepared = new Map(input.rooms.flatMap((room) => input.operators.map((op) => [`${room.id}:${op.id}`, prepareCandidate(op, room, input.promotions[op.id] ?? 4, input.manufacturingRecipes, input.growthCategory)])));
  const seen = new Map();
  const evaluate = (teams, plans, options = SEARCH) => {
    const key = JSON.stringify(options) + signature(teams, plans, input.rooms);
    if (seen.has(key)) return seen.get(key);
    const summary = simulatePlan(compilePlan({ ...input, teams }), plans, options);
    const candidate = { teams, plans, score: score(summary, input.rooms), coverage: input.rooms.reduce((sum, room) => sum + summary.rooms[room.id].coverageRate, 0) };
    seen.set(key, candidate);
    return candidate;
  };
  const better = (a, b) => !b || a.score > b.score + 1e-7 || (Math.abs(a.score - b.score) < 1e-7 && a.coverage > b.coverage + 1e-7);
  const seeds = [];
  const add = (teams, plans) => seeds.push(evaluate(teams, plans));
  const maskCount = manual ? 1 : 2 ** ids.length;
  for (let mask = 0; mask < maskCount; mask++) {
    for (const hours of manual ? [12] : [12, 16]) {
      const plans = manual ? initial : Object.fromEntries(ids.map((id, i) => [id, { ...initial[id], kind: mask & (1 << i) ? "dual" : "single", start: 0, duration: hours, offsets: [0, 5, 10] }]));
      for (const weight of [0.5, 1.5]) for (const policy of ["plain", "mood"]) add(allocate(input, plans, weight, policy), plans);
    }
    onProgress(8 + 22 * (mask + 1) / maskCount);
  }
  // Keep the former single-team recommendation as a verified baseline. The new
  // engine, including mixed schedules, must not quietly discard this candidate.
  let legacy = null;
  if (!manual) {
    const assignments = optimizeAfkAssignments(input);
    const axis = optimizeStartupAxis({ ...input, assignments, axisScope: "shared" });
    const plans = Object.fromEntries(ids.map((id) => [id, { ...initial[id], kind: "single", offsets: axis.offsetsByRoom[id] }]));
    legacy = evaluate(Object.fromEntries(ids.map((id) => [id, [assignments[id], []]])), plans, VERIFY);
    seeds.push(legacy);
  }
  onProgress(40);
  seeds.sort((a, b) => b.score - a.score);
  const uniqueSeeds = [...new Map(seeds.map((seed) => [signature(seed.teams, seed.plans, input.rooms), seed])).values()].slice(0, manual ? 2 : 3);
  const finalists = [...uniqueSeeds];
  if (legacy) finalists.push(legacy);
  const tuneTimes = (seed) => {
    let best = seed;
    for (const room of input.rooms) {
      const current = best.plans[room.id];
      const changes = current.kind === "dual"
        ? ["duration", "start"] : ["offset1", "offset2"];
      for (const field of changes) {
        let fieldBest = best;
        const count = current.kind === "single" ? best.teams[room.id][0].length : best.teams[room.id].flat().length;
        if (!count || (field === "offset2" && count < 3) || (field === "offset1" && count < 2)) continue;
        for (let value = field === "duration" ? 0.5 : 0; value < 24; value += field === "start" ? 2 : 0.5) {
          const plans = clone(best.plans);
          if (field.startsWith("offset")) plans[room.id].offsets[Number(field.slice(-1))] = value;
          else plans[room.id][field] = value;
          const candidate = evaluate(best.teams, plans);
          if (better(candidate, fieldBest)) fieldBest = candidate;
        }
        best = fieldBest;
        if (field === "start") for (const delta of [-1, -0.5, 0.5, 1]) {
          const plans = clone(fieldBest.plans);
          plans[room.id].start = (plans[room.id].start + delta + 24) % 24;
          const candidate = evaluate(best.teams, plans);
          if (better(candidate, best)) best = candidate;
        }
      }
    }
    return best;
  };
  for (let index = 0; index < uniqueSeeds.length; index++) {
    let best = uniqueSeeds[index];
    if (!manual) best = tuneTimes(best);
    // Local moves and swaps evaluate the complete coupled simulation, including
    // empty groups and the value of freeing an operator for another facility.
    const slots = input.rooms.flatMap((room) => [0, ...(best.plans[room.id].kind === "dual" ? [1] : [])].map((gi) => ({ id: room.id, gi })));
    const baseline = best;
    const assigned = new Set(Object.values(best.teams).flat(2).map((op) => op.id));
    for (let from = 0; from < slots.length; from++) {
      const a = slots[from];
      for (let ai = 0; ai < baseline.teams[a.id][a.gi].length; ai++) {
        for (let to = 0; to < slots.length; to++) {
          if (to === from) continue;
          const b = slots[to];
          for (let bi = -1; bi < baseline.teams[b.id][b.gi].length; bi++) {
            if (bi >= 0 && to < from) continue; // swaps are symmetric; moves are not
            if (bi < 0 && baseline.teams[b.id][b.gi].length >= 3) continue;
            const teams = clone(baseline.teams), opA = teams[a.id][a.gi][ai];
            if (bi < 0) { teams[a.id][a.gi].splice(ai, 1); teams[b.id][b.gi].push(prepared.get(`${b.id}:${opA.id}`)); }
            else { const opB = teams[b.id][b.gi][bi]; teams[a.id][a.gi][ai] = prepared.get(`${a.id}:${opB.id}`); teams[b.id][b.gi][bi] = prepared.get(`${b.id}:${opA.id}`); }
            if (!legalSingle(teams, best.plans, input.rooms)) continue;
            const candidate = evaluate(teams, best.plans);
            if (better(candidate, best)) best = candidate;
          }
        }
        for (const op of input.operators.filter((op) => !assigned.has(op.id))) {
          const teams = clone(baseline.teams); teams[a.id][a.gi][ai] = prepared.get(`${a.id}:${op.id}`);
          if (legalSingle(teams, best.plans, input.rooms)) { const candidate = evaluate(teams, best.plans); if (better(candidate, best)) best = candidate; }
        }
      }
    }
    finalists.push(best);
    if (!manual) finalists.push(tuneTimes(best));
    onProgress(45 + 40 * (index + 1) / uniqueSeeds.length);
  }
  let winner = null;
  for (const seed of finalists) {
    const verified = evaluate(seed.teams, seed.plans, VERIFY);
    if (better(verified, winner)) winner = verified;
  }
  // Only numerical ties favor fewer setup actions (AB ahead of staggered starts).
  const complexity = (candidate) => ids.reduce((sum, id) => sum + (candidate.plans[id].kind === "dual" ? 1 : new Set(candidate.plans[id].offsets.slice(0, candidate.teams[id][0].length)).size), 0);
  for (const seed of finalists) {
    const verified = evaluate(seed.teams, seed.plans, VERIFY);
    if (Math.abs(verified.score - winner.score) <= 1e-7 && complexity(verified) < complexity(winner)) winner = verified;
  }
  const summary = evaluatePlan({ ...input, teams: winner.teams, roomPlans: winner.plans, ...VERIFY });
  summary.planning.evaluatedCandidates = seen.size;
  summary.planning.singleBaselineScore = legacy?.score ?? null;
  summary.planning.score = summaryObjective(summary, input.rooms);
  onProgress(98);
  return { teams: winner.teams, roomPlans: winner.plans, summary };
}
