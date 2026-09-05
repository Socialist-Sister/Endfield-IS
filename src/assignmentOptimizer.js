import { getActiveSkill } from "./operatorData.js";
import {
  BASE_MOOD_DRAIN_PER_HOUR,
  BASE_MOOD_RECOVERY_PER_HOUR,
  MOOD_MAX,
  evaluateShiftAssignments,
  evaluateStartupOffsets,
  getShiftDurations,
  manufacturingSkillCategory,
} from "./scheduleModel.js";

const PRODUCTION_ROOMS = ["manufacture-a", "manufacture-b", "growth", "reception"];
const IMPOSSIBLE_WEIGHT = -1e6;

function roomCategory(room, manufacturingRecipes, growthCategory) {
  if (room.type === "制造舱") return manufacturingSkillCategory(room.id, manufacturingRecipes);
  if (room.id === "growth") return growthCategory;
  if (room.id === "reception") return "clue-rate";
  return null;
}

export function prepareCandidate(operator, room, promotion, manufacturingRecipes, growthCategory) {
  const category = roomCategory(room, manufacturingRecipes, growthCategory);
  const activeSkills = operator.skills
    .filter((skill) => skill.facility === room.type)
    .map((skill) => ({ ...skill, activeTier: getActiveSkill(skill, promotion) }))
    .filter((skill) => skill.activeTier);
  const activeSkill = [...activeSkills].sort((left, right) => {
    const value = (skill) => skill.category === category ? skill.activeTier.value : 0;
    return value(right) - value(left);
  })[0] ?? null;
  return { ...operator, promotion, activeSkills, activeSkill, boost: 0 };
}

function skillValue(candidate, category) {
  return candidate.activeSkills.reduce((sum, skill) => (
    sum + (skill.category === category ? (skill.activeTier?.value ?? 0) : 0)
  ), 0);
}

function hasMoodReduction(candidate) {
  return skillValue(candidate, "mood-drop") > 0;
}

function candidateWeight(candidate, room, manufacturingRecipes, growthCategory, moodWeight, duration = 24) {
  const category = roomCategory(room, manufacturingRecipes, growthCategory);
  if (room.id === "control") {
    return (skillValue(candidate, "mood-regen") * 2.6) + (candidate.rarity * 1e-4);
  }
  const output = skillValue(candidate, category);
  const mood = skillValue(candidate, "mood-drop");
  const individualDrain = BASE_MOOD_DRAIN_PER_HOUR * (1 - Math.min(0.95, mood / 100));
  const activeFraction = duration ? Math.min(1, (MOOD_MAX / individualDrain) / duration) : 1;
  const baseAndOutput = (40 + (output * 2.2)) * activeFraction;
  return baseAndOutput + (mood * moodWeight) + (candidate.rarity * 1e-4);
}

// Rectangular Hungarian assignment: each slot receives at most one unique operator or dummy.
function maximizeAssignment(weights) {
  const rowCount = weights.length;
  const columnCount = weights[0]?.length ?? 0;
  if (!rowCount || !columnCount) return [];
  const finiteMax = Math.max(0, ...weights.flat().filter((value) => value > IMPOSSIBLE_WEIGHT / 2));
  const costs = weights.map((row) => row.map((weight) => finiteMax - weight));
  const u = new Array(rowCount + 1).fill(0);
  const v = new Array(columnCount + 1).fill(0);
  const p = new Array(columnCount + 1).fill(0);
  const way = new Array(columnCount + 1).fill(0);

  for (let row = 1; row <= rowCount; row += 1) {
    p[0] = row;
    let column0 = 0;
    const minv = new Array(columnCount + 1).fill(Infinity);
    const used = new Array(columnCount + 1).fill(false);
    do {
      used[column0] = true;
      const row0 = p[column0];
      let delta = Infinity;
      let column1 = 0;
      for (let column = 1; column <= columnCount; column += 1) {
        if (used[column]) continue;
        const current = costs[row0 - 1][column - 1] - u[row0] - v[column];
        if (current < minv[column]) {
          minv[column] = current;
          way[column] = column0;
        }
        if (minv[column] < delta) {
          delta = minv[column];
          column1 = column;
        }
      }
      for (let column = 0; column <= columnCount; column += 1) {
        if (used[column]) {
          u[p[column]] += delta;
          v[column] -= delta;
        } else {
          minv[column] -= delta;
        }
      }
      column0 = column1;
    } while (p[column0] !== 0);
    do {
      const column1 = way[column0];
      p[column0] = p[column1];
      column0 = column1;
    } while (column0 !== 0);
  }

  const assignment = new Array(rowCount).fill(-1);
  for (let column = 1; column <= columnCount; column += 1) {
    if (p[column]) assignment[p[column] - 1] = column - 1;
  }
  return assignment;
}

function buildMatchingAssignment({ operators, promotions, rooms, manufacturingRecipes, growthCategory, policies = {}, moodWeight, duration = 24, penalties = new Map() }) {
  const slots = rooms.flatMap((room) => Array.from({ length: 3 }, (_, index) => ({ room, index })));
  const dummyCount = slots.length;
  const columns = [...operators, ...Array.from({ length: dummyCount }, (_, index) => ({ id: `__dummy-${index}`, dummy: true }))];
  const prepared = Object.fromEntries(rooms.map((room) => [room.id, Object.fromEntries(operators.map((operator) => [
    operator.id,
    prepareCandidate(operator, room, promotions[operator.id] ?? 4, manufacturingRecipes, growthCategory),
  ]))]));
  const weights = slots.map(({ room, index }) => columns.map((operator) => {
    if (operator.dummy) return 0;
    const candidate = prepared[room.id][operator.id];
    const policy = policies[room.id];
    if (policy === "mood" && !hasMoodReduction(candidate)) return IMPOSSIBLE_WEIGHT;
    if (policy === "plain" && hasMoodReduction(candidate)) return IMPOSSIBLE_WEIGHT;
    // The first occupied production slot also enables the facility's base 100%.
    // Without this marginal value, a small E0 roster gets packed into one room.
    const openingBonus = room.id !== "control" && index === 0 ? 100 : 0;
    return candidateWeight(candidate, room, manufacturingRecipes, growthCategory, moodWeight, duration)
      + openingBonus - (penalties.get(operator.id) ?? 0);
  }));
  const chosenColumns = maximizeAssignment(weights);
  const result = Object.fromEntries(rooms.map((room) => [room.id, []]));
  slots.forEach(({ room }, slotIndex) => {
    const operator = columns[chosenColumns[slotIndex]];
    if (!operator || operator.dummy || weights[slotIndex][chosenColumns[slotIndex]] <= 0) return;
    result[room.id].push(prepared[room.id][operator.id]);
  });
  return result;
}

export function summaryObjective(summary, rooms) {
  return rooms
    .filter((room) => room.id !== "control")
    .reduce((sum, room) => sum + (summary.rooms[room.id]?.averageFactor ?? 0), 0);
}

function assignmentSignature(assignments, rooms) {
  return rooms.map((room) => `${room.id}:${(assignments[room.id] ?? []).map((operator) => operator.id).sort().join(",")}`).join("|");
}

export function optimizeAfkAssignments({ operators, promotions, rooms, manufacturingRecipes, growthCategory }) {
  const seen = new Set();
  let best = null;
  const policyCount = 2 ** PRODUCTION_ROOMS.length;
  const axes = [[0, 5, 10], [0, 0, 8]];
  for (let mask = 0; mask < policyCount; mask += 1) {
    const policies = Object.fromEntries(PRODUCTION_ROOMS.map((roomId, index) => [roomId, mask & (1 << index) ? "mood" : "plain"]));
    for (const moodWeight of [0.45, 0.8, 1.2, 1.7]) {
      const assignments = buildMatchingAssignment({
        operators, promotions, rooms, manufacturingRecipes, growthCategory, policies, moodWeight,
      });
      const signature = assignmentSignature(assignments, rooms);
      if (seen.has(signature)) continue;
      seen.add(signature);
      let candidateScore = -Infinity;
      for (const axis of axes) {
        const summary = evaluateStartupOffsets({
          rooms,
          assignments,
          manufacturingRecipes,
          growthCategory,
          offsetsByRoom: Object.fromEntries(rooms.map((room) => [room.id, axis])),
          warmupDays: 30,
          sampleDays: 15,
        });
        candidateScore = Math.max(candidateScore, summaryObjective(summary, rooms));
      }
      if (!best || candidateScore > best.score + 1e-9) best = { assignments, score: candidateScore };
    }
  }
  return best?.assignments ?? Object.fromEntries(rooms.map((room) => [room.id, []]));
}

function buildShiftSchedule({ operators, promotions, rooms, manufacturingRecipes, growthCategory, loginTimes, startShift, reusePenalty, moodWeight }) {
  const durations = getShiftDurations(loginTimes);
  const shiftCount = loginTimes.length;
  const byShift = Array.from({ length: shiftCount }, () => null);
  const lastEnd = new Map();
  let absoluteStart = 0;
  for (let sequenceIndex = 0; sequenceIndex < shiftCount; sequenceIndex += 1) {
    const shiftIndex = (startShift + sequenceIndex) % shiftCount;
    const penalties = new Map();
    operators.forEach((operator) => {
      if (!lastEnd.has(operator.id)) return;
      const restHours = Math.max(0, absoluteStart - lastEnd.get(operator.id));
      const recoveryFraction = Math.min(1, restHours / (MOOD_MAX / BASE_MOOD_RECOVERY_PER_HOUR));
      penalties.set(operator.id, reusePenalty * (1 - recoveryFraction));
    });
    const assignment = buildMatchingAssignment({
      operators,
      promotions,
      rooms,
      manufacturingRecipes,
      growthCategory,
      moodWeight,
      duration: durations[shiftIndex],
      penalties,
    });
    byShift[shiftIndex] = assignment;
    rooms.forEach((room) => assignment[room.id].forEach((operator) => {
      lastEnd.set(operator.id, absoluteStart + durations[shiftIndex]);
    }));
    absoluteStart += durations[shiftIndex];
  }
  return Object.fromEntries(rooms.map((room) => [room.id, byShift.map((assignment) => assignment[room.id])]));
}

function shiftSignature(shiftAssignments, rooms) {
  return rooms.map((room) => `${room.id}:${shiftAssignments[room.id].map((team) => team.map((operator) => operator.id).sort().join(",")).join("/")}`).join("|");
}

export function optimizeShiftAssignments({ operators, promotions, rooms, manufacturingRecipes, growthCategory, loginTimes }) {
  const seen = new Set();
  let best = null;
  for (let startShift = 0; startShift < loginTimes.length; startShift += 1) {
    for (const reusePenalty of [80, 140, 240]) {
      for (const moodWeight of [0.35, 0.75, 1.15]) {
        const shiftAssignments = buildShiftSchedule({
          operators,
          promotions,
          rooms,
          manufacturingRecipes,
          growthCategory,
          loginTimes,
          startShift,
          reusePenalty,
          moodWeight,
        });
        const signature = shiftSignature(shiftAssignments, rooms);
        if (seen.has(signature)) continue;
        seen.add(signature);
        const summary = evaluateShiftAssignments({
          rooms,
          shiftAssignments,
          loginTimes,
          manufacturingRecipes,
          growthCategory,
          // Use the same evaluation window as the displayed fixed-login result.
        });
        const score = summaryObjective(summary, rooms);
        if (!best || score > best.score + 1e-9) best = { shiftAssignments, score };
      }
    }
  }
  return best?.shiftAssignments ?? Object.fromEntries(rooms.map((room) => [room.id, loginTimes.map(() => [])]));
}
