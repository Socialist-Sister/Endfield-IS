export const BASE_ASSIGNMENT_BONUS = 0.4;
export const BASE_MOOD_DRAIN_PER_HOUR = 7;
export const BASE_MOOD_RECOVERY_PER_HOUR = 12;
export const MOOD_MAX = 100;
export const MANUFACTURING_RECIPES = {
  "advanced-cognitive-carrier": {
    label: "高级认知载体",
    skillCategory: "operator-exp",
    hours: 24 + (26 / 60) + (40 / 3600),
  },
  "advanced-battle-record": {
    label: "高级作战记录",
    skillCategory: "operator-exp",
    hours: 9 + (46 / 60) + (40 / 3600),
  },
  "weapon-inspection-kit": {
    label: "武器检查套组",
    skillCategory: "weapon-exp",
    hours: 9 + (46 / 60) + (40 / 3600),
  },
};
export const DEFAULT_MANUFACTURING_RECIPES = {
  "manufacture-a": "advanced-cognitive-carrier",
  "manufacture-b": "advanced-battle-record",
};
export const GROWTH_PRODUCT_HOURS = 61 + (6 / 60) + (40 / 3600);
export const GROWTH_BOX_COUNT = 9;
export const CLUE_BASE_HOURS = 72;

export const AXIS_SCOPES = {
  shared: {
    label: "统一启动轴",
    shortLabel: "统一轴",
    description: "所有设施共用一组启动时间，便于一次设置",
  },
  facility: {
    label: "分设施启动轴",
    shortLabel: "分设施轴",
    description: "每个设施分别求解，优先长期产出",
  },
};

const PRODUCT_CATEGORIES = ["weapon-exp", "operator-exp", "rare-mineral", "vitrified", "fungal", "clue-rate"];
const REFERENCE_AXES = [[0, 5, 10], [0, 0, 8]];
const FINAL_WARMUP_HOURS = 24 * 180;
const FINAL_SAMPLE_HOURS = 24 * 90;
const SEARCH_WARMUP_HOURS = 24 * 30;
const SEARCH_SAMPLE_HOURS = 24 * 15;

function operatorSkills(operator) {
  if (operator.activeSkills) return operator.activeSkills;
  return operator.activeSkill ? [operator.activeSkill] : [];
}

export function sumSkillValue(team, category) {
  return team.reduce((sum, operator) => sum + operatorSkills(operator).reduce((operatorSum, skill) => (
    operatorSum + (skill.category === category ? (skill.activeTier?.value ?? 0) : 0)
  ), 0), 0);
}

export function productionFactor(team, category) {
  if (!team.length) return 0;
  const assignmentFactor = 1 + (team.length * BASE_ASSIGNMENT_BONUS);
  const skillFactor = 1 + (sumSkillValue(team, category) / 100);
  return assignmentFactor * skillFactor;
}

export function parseClock(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours + (minutes / 60);
}

export function getShiftDurations(loginTimes) {
  if (loginTimes.length <= 1) return [24];
  return loginTimes.map((time, index) => {
    const start = parseClock(time);
    const end = parseClock(loginTimes[(index + 1) % loginTimes.length]);
    return (end - start + 24) % 24 || 24;
  });
}

export function manufacturingRecipeId(roomId, manufacturingRecipes = DEFAULT_MANUFACTURING_RECIPES) {
  return manufacturingRecipes?.[roomId]
    ?? DEFAULT_MANUFACTURING_RECIPES[roomId]
    ?? "advanced-battle-record";
}

export function manufacturingSkillCategory(roomId, manufacturingRecipes = DEFAULT_MANUFACTURING_RECIPES) {
  return MANUFACTURING_RECIPES[manufacturingRecipeId(roomId, manufacturingRecipes)]?.skillCategory ?? "operator-exp";
}

function roomProductionCategory(room, team, manufacturingRecipes, growthCategory) {
  if (room.type === "制造舱") return manufacturingSkillCategory(room.id, manufacturingRecipes);
  if (room.id === "reception") return "clue-rate";
  if (room.id === "control") return null;
  return growthCategory;
}

function moodDrainRate(team) {
  const reduction = Math.min(0.95, sumSkillValue(team, "mood-drop") / 100);
  return BASE_MOOD_DRAIN_PER_HOUR * (1 - reduction);
}

function moodRecoveryRate(controlTeam) {
  return BASE_MOOD_RECOVERY_PER_HOUR * (1 + (sumSkillValue(controlTeam, "mood-regen") / 100));
}

function emptyRoomAccumulator() {
  return { effectiveHours: 0, coverageHours: 0, activeOperatorHours: 0 };
}

function normalizeRoomStats(accumulator, periodHours) {
  const days = periodHours / 24;
  const coverageRate = Math.min(1, Math.max(0, accumulator.coverageHours / periodHours));
  return {
    effectiveHoursPerDay: accumulator.effectiveHours / days,
    averageFactor: accumulator.effectiveHours / periodHours,
    coverageRate,
    averageActive: accumulator.activeOperatorHours / periodHours,
    downtimeHours: 24 * (1 - coverageRate),
  };
}

function summarizeOutputs(rooms, roomStats, moodRecovery, manufacturingRecipes, growthCategory, startup = null) {
  const emptyStats = normalizeRoomStats(emptyRoomAccumulator(), 24);
  const receptionRoom = roomStats.reception ?? emptyStats;
  const growthRoom = roomStats.growth ?? emptyStats;
  const manufacturing = Object.fromEntries(Object.keys(MANUFACTURING_RECIPES).map((recipeId) => [recipeId, 0]));
  rooms.filter((room) => room.type === "制造舱").forEach((room) => {
    const recipeId = manufacturingRecipeId(room.id, manufacturingRecipes);
    const recipe = MANUFACTURING_RECIPES[recipeId];
    const effectiveHours = (roomStats[room.id] ?? emptyStats).effectiveHoursPerDay;
    if (recipe) manufacturing[recipeId] += effectiveHours / recipe.hours;
  });
  const productionRooms = rooms.filter((room) => room.id !== "control").map((room) => roomStats[room.id]);
  const mean = (key) => productionRooms.length
    ? productionRooms.reduce((sum, room) => sum + room[key], 0) / productionRooms.length
    : 0;

  return {
    cognitive: manufacturing["advanced-cognitive-carrier"],
    operator: manufacturing["advanced-battle-record"],
    weapon: manufacturing["weapon-inspection-kit"],
    manufacturing,
    manufacturingRecipes: Object.fromEntries(rooms
      .filter((room) => room.type === "制造舱")
      .map((room) => [room.id, manufacturingRecipeId(room.id, manufacturingRecipes)])),
    growth: (growthRoom.effectiveHoursPerDay / GROWTH_PRODUCT_HOURS) * GROWTH_BOX_COUNT,
    growthCategory,
    clues: receptionRoom.effectiveHoursPerDay / CLUE_BASE_HOURS,
    moodRecovery,
    averageEfficiency: mean("averageFactor"),
    averageCoverage: mean("coverageRate"),
    averageActive: mean("averageActive"),
    averageDowntime: mean("downtimeHours"),
    rooms: roomStats,
    startup,
  };
}

function buildAfkModel(rooms, assignments, manufacturingRecipes, growthCategory) {
  return rooms.map((room) => {
    const category = room.type === "制造舱"
      ? manufacturingSkillCategory(room.id, manufacturingRecipes)
      : room.id === "reception" ? "clue-rate" : room.id === "growth" ? growthCategory : null;
    return {
      room,
      category,
      operators: (assignments[room.id] ?? []).map((operator) => {
        const values = Object.fromEntries(PRODUCT_CATEGORIES.map((skillCategory) => [skillCategory, sumSkillValue([operator], skillCategory)]));
        return {
          operator,
          moodDrop: sumSkillValue([operator], "mood-drop"),
          moodRegen: sumSkillValue([operator], "mood-regen"),
          values,
        };
      }),
    };
  });
}

function simulateAfkModel(model, offsetsByRoom, { warmupHours, sampleHours }) {
  const totalHours = warmupHours + sampleHours;
  const roomCount = model.length;
  const accumulators = model.map(() => emptyRoomAccumulator());
  const states = [];
  let recoveryRateHours = 0;

  model.forEach((profile, roomIndex) => {
    const offsets = offsetsByRoom[profile.room.id] ?? [0, 0, 0];
    profile.operators.forEach((operatorProfile, operatorIndex) => states.push({
      profile: operatorProfile,
      roomIndex,
      startAt: offsets[operatorIndex] ?? offsets[offsets.length - 1] ?? 0,
      mood: MOOD_MAX,
      started: false,
      working: false,
    }));
  });

  const activeCounts = new Array(roomCount).fill(0);
  const moodDropTotals = new Array(roomCount).fill(0);
  const moodRegenTotals = new Array(roomCount).fill(0);
  const skillTotals = model.map(() => Object.fromEntries(PRODUCT_CATEGORIES.map((category) => [category, 0])));
  const controlIndex = model.findIndex((profile) => profile.room.id === "control");
  let time = 0;

  while (time < totalHours - 1e-7) {
    activeCounts.fill(0);
    moodDropTotals.fill(0);
    moodRegenTotals.fill(0);
    skillTotals.forEach((totals) => PRODUCT_CATEGORIES.forEach((category) => { totals[category] = 0; }));

    states.forEach((state) => {
      if (!state.started && time + 1e-7 >= state.startAt) {
        state.started = true;
        state.working = true;
      } else if (state.started && !state.working && state.mood >= MOOD_MAX - 1e-7) {
        state.mood = MOOD_MAX;
        state.working = true;
      }
      if (!state.working) return;
      const { roomIndex, profile } = state;
      activeCounts[roomIndex] += 1;
      moodDropTotals[roomIndex] += profile.moodDrop;
      moodRegenTotals[roomIndex] += profile.moodRegen;
      PRODUCT_CATEGORIES.forEach((category) => { skillTotals[roomIndex][category] += profile.values[category]; });
    });

    const recoveryRate = BASE_MOOD_RECOVERY_PER_HOUR * (1 + ((controlIndex >= 0 ? moodRegenTotals[controlIndex] : 0) / 100));
    const drainRates = moodDropTotals.map((total) => BASE_MOOD_DRAIN_PER_HOUR * (1 - Math.min(0.95, total / 100)));
    let nextTime = totalHours;
    states.forEach((state) => {
      if (!state.started) {
        nextTime = Math.min(nextTime, state.startAt);
      } else if (state.working) {
        nextTime = Math.min(nextTime, time + (state.mood / drainRates[state.roomIndex]));
      } else {
        nextTime = Math.min(nextTime, time + ((MOOD_MAX - state.mood) / recoveryRate));
      }
    });
    const duration = Math.max(0, nextTime - time);
    if (duration <= 1e-9) {
      time += 1e-7;
      continue;
    }
    const measuredDuration = Math.max(0, Math.min(nextTime, totalHours) - Math.max(time, warmupHours));

    if (measuredDuration > 0) {
      model.forEach((profile, roomIndex) => {
        const count = activeCounts[roomIndex];
        const category = profile.category;
        const factor = count && category
          ? (1 + (count * BASE_ASSIGNMENT_BONUS)) * (1 + (skillTotals[roomIndex][category] / 100))
          : 0;
        accumulators[roomIndex].effectiveHours += factor * measuredDuration;
        accumulators[roomIndex].coverageHours += (count ? 1 : 0) * measuredDuration;
        accumulators[roomIndex].activeOperatorHours += count * measuredDuration;
      });
      recoveryRateHours += recoveryRate * measuredDuration;
    }

    states.forEach((state) => {
      if (!state.started) return;
      if (state.working) {
        state.mood = Math.max(0, state.mood - (drainRates[state.roomIndex] * duration));
        if (state.mood <= 1e-7) state.working = false;
      } else {
        state.mood = Math.min(MOOD_MAX, state.mood + (recoveryRate * duration));
      }
    });
    time = nextTime;
  }

  return {
    roomStats: Object.fromEntries(model.map((profile, index) => [
      profile.room.id,
      normalizeRoomStats(accumulators[index], sampleHours),
    ])),
    moodRecovery: recoveryRateHours / sampleHours,
  };
}

function normalizeAxis(axis) {
  const clamped = axis.map((value) => Math.max(0, Math.min(23.5, value)));
  const firstStart = Math.min(...clamped);
  return clamped.map((value) => Math.round((value - firstStart) * 2) / 2);
}

function axisKey(axis) {
  return axis.map((value) => value.toFixed(1)).join("/");
}

function halfHourAxes() {
  const axes = [];
  for (let first = 0; first < 24; first += 0.5) {
    for (let second = 0; second < 24; second += 0.5) {
      for (let third = 0; third < 24; third += 0.5) {
        if (Math.min(first, second, third) === 0) axes.push([first, second, third]);
      }
    }
  }
  return axes;
}

function stablePatternAxes() {
  const axes = [];
  const addPermutations = (values) => {
    const [first, second, third] = values;
    axes.push(
      [first, second, third], [first, third, second],
      [second, first, third], [second, third, first],
      [third, first, second], [third, second, first],
    );
  };
  for (let third = 0; third < 24; third += 0.5) {
    [0, 0.5, 1].forEach((gap) => addPermutations([0, gap, third]));
  }
  return axes;
}

function compareEvaluations(left, right) {
  if (Math.abs(left.score - right.score) > 1e-7) return right.score - left.score;
  if (Math.abs(left.coverage - right.coverage) > 1e-7) return right.coverage - left.coverage;
  const leftSpread = Math.max(...left.axis);
  const rightSpread = Math.max(...right.axis);
  if (leftSpread !== rightSpread) return leftSpread - rightSpread;
  return axisKey(left.axis).localeCompare(axisKey(right.axis));
}

function searchAxis(evaluate, initialAxes = []) {
  const seen = new Set();
  const results = [];
  let evaluatedCandidates = 0;
  const assess = (axis) => {
    const normalized = normalizeAxis(axis);
    const key = axisKey(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ axis: normalized, ...evaluate(normalized) });
    evaluatedCandidates += 1;
  };

  [...REFERENCE_AXES, ...initialAxes].forEach(assess);
  halfHourAxes().forEach(assess);
  results.sort(compareEvaluations);
  const finalistMap = new Map();
  [...results.slice(0, 24).map((result) => result.axis), ...stablePatternAxes(), ...REFERENCE_AXES, ...initialAxes]
    .map(normalizeAxis)
    .forEach((axis) => finalistMap.set(axisKey(axis), axis));
  return { axis: results[0].axis, finalists: [...finalistMap.values()], evaluatedCandidates };
}

function searchOptions() {
  return {
    warmupHours: SEARCH_WARMUP_HOURS,
    sampleHours: SEARCH_SAMPLE_HOURS,
  };
}

function verificationOptions() {
  return {
    warmupHours: FINAL_WARMUP_HOURS,
    sampleHours: FINAL_SAMPLE_HOURS,
  };
}

function selectVerifiedAxis(axes, evaluate) {
  return axes
    .map((axis) => ({ axis, ...evaluate(axis) }))
    .sort(compareEvaluations)[0].axis;
}

function productionScore(rooms, roomStats) {
  const productionRooms = rooms.filter((room) => room.id !== "control");
  return {
    score: productionRooms.reduce((sum, room) => sum + roomStats[room.id].effectiveHoursPerDay, 0),
    coverage: productionRooms.length ? Math.min(...productionRooms.map((room) => roomStats[room.id].coverageRate)) : 0,
  };
}

function optimizeSharedAxis(rooms, assignments, manufacturingRecipes, growthCategory) {
  const model = buildAfkModel(rooms, assignments, manufacturingRecipes, growthCategory);
  const result = searchAxis((axis) => {
    const offsetsByRoom = Object.fromEntries(rooms.map((room) => [room.id, axis]));
    const simulation = simulateAfkModel(model, offsetsByRoom, searchOptions());
    return productionScore(rooms, simulation.roomStats);
  });
  const verifiedAxis = selectVerifiedAxis(result.finalists, (axis) => {
    const offsetsByRoom = Object.fromEntries(rooms.map((room) => [room.id, axis]));
    const simulation = simulateAfkModel(model, offsetsByRoom, verificationOptions());
    return productionScore(rooms, simulation.roomStats);
  });
  return {
    offsetsByRoom: Object.fromEntries(rooms.map((room) => [room.id, verifiedAxis])),
    sharedOffsets: verifiedAxis,
    evaluatedCandidates: result.evaluatedCandidates + result.finalists.length,
  };
}

function optimizeFacilityAxes(rooms, assignments, manufacturingRecipes, growthCategory) {
  const controlRoom = rooms.find((room) => room.id === "control");
  const shared = optimizeSharedAxis(rooms, assignments, manufacturingRecipes, growthCategory);
  const controlAxis = shared.sharedOffsets;
  let evaluatedCandidates = shared.evaluatedCandidates;
  const offsetsByRoom = Object.fromEntries(rooms.map((room) => [room.id, controlAxis]));
  rooms.filter((room) => room.id !== "control").forEach((room) => {
    if (!(assignments[room.id] ?? []).length) {
      offsetsByRoom[room.id] = [0, 0, 0];
      return;
    }
    const localRooms = controlRoom ? [room, controlRoom] : [room];
    const localModel = buildAfkModel(localRooms, assignments, manufacturingRecipes, growthCategory);
    const roomResult = searchAxis((axis) => {
      const simulation = simulateAfkModel(localModel, {
        [room.id]: axis,
        ...(controlRoom ? { control: controlAxis } : {}),
      }, searchOptions());
      const stats = simulation.roomStats[room.id];
      return { score: stats.effectiveHoursPerDay, coverage: stats.coverageRate };
    }, [controlAxis]);
    offsetsByRoom[room.id] = selectVerifiedAxis(roomResult.finalists, (axis) => {
      const simulation = simulateAfkModel(localModel, {
        [room.id]: axis,
        ...(controlRoom ? { control: controlAxis } : {}),
      }, verificationOptions());
      const stats = simulation.roomStats[room.id];
      return { score: stats.effectiveHoursPerDay, coverage: stats.coverageRate };
    });
    evaluatedCandidates += roomResult.evaluatedCandidates + roomResult.finalists.length;
  });

  const fullModel = buildAfkModel(rooms, assignments, manufacturingRecipes, growthCategory);
  const baselineSimulation = simulateAfkModel(fullModel, shared.offsetsByRoom, {
    warmupHours: FINAL_WARMUP_HOURS,
    sampleHours: FINAL_SAMPLE_HOURS,
  });
  const candidateSimulation = simulateAfkModel(fullModel, offsetsByRoom, {
    warmupHours: FINAL_WARMUP_HOURS,
    sampleHours: FINAL_SAMPLE_HOURS,
  });
  const baselineScore = productionScore(rooms, baselineSimulation.roomStats).score;
  const candidateScore = productionScore(rooms, candidateSimulation.roomStats).score;
  const useIndependentAxes = candidateScore > baselineScore + 1e-7;

  return {
    offsetsByRoom: useIndependentAxes ? offsetsByRoom : shared.offsetsByRoom,
    sharedOffsets: null,
    evaluatedCandidates,
    gainVsShared: baselineScore ? (Math.max(candidateScore, baselineScore) / baselineScore) - 1 : 0,
    matchedSharedAxis: !useIndependentAxes,
  };
}

export function optimizeStartupAxis({ rooms, assignments, manufacturingRecipes = DEFAULT_MANUFACTURING_RECIPES, growthCategory = "vitrified", axisScope = "shared" }) {
  const optimized = axisScope === "facility"
    ? optimizeFacilityAxes(rooms, assignments, manufacturingRecipes, growthCategory)
    : optimizeSharedAxis(rooms, assignments, manufacturingRecipes, growthCategory);
  return {
    scope: axisScope,
    ...optimized,
    gainVsShared: optimized.gainVsShared ?? 0,
    resolutionMinutes: 30,
    warmupDays: FINAL_WARMUP_HOURS / 24,
    sampleDays: FINAL_SAMPLE_HOURS / 24,
  };
}

export function evaluateStartupOffsets({ rooms, assignments, manufacturingRecipes = DEFAULT_MANUFACTURING_RECIPES, growthCategory = "vitrified", offsetsByRoom, warmupDays = 60, sampleDays = 30 }) {
  const model = buildAfkModel(rooms, assignments, manufacturingRecipes, growthCategory);
  const simulation = simulateAfkModel(model, offsetsByRoom, {
    warmupHours: warmupDays * 24,
    sampleHours: sampleDays * 24,
  });
  return summarizeOutputs(rooms, simulation.roomStats, simulation.moodRecovery, manufacturingRecipes, growthCategory);
}

function simulateAfk({ rooms, assignments, manufacturingRecipes, growthCategory, axisScope }) {
  const startup = optimizeStartupAxis({ rooms, assignments, manufacturingRecipes, growthCategory, axisScope });
  const model = buildAfkModel(rooms, assignments, manufacturingRecipes, growthCategory);
  const simulation = simulateAfkModel(model, startup.offsetsByRoom, {
    warmupHours: FINAL_WARMUP_HOURS,
    sampleHours: FINAL_SAMPLE_HOURS,
  });
  return summarizeOutputs(rooms, simulation.roomStats, simulation.moodRecovery, manufacturingRecipes, growthCategory, startup);
}

function shiftIndexAt(time, starts) {
  const hour = ((time % 24) + 24) % 24;
  for (let index = starts.length - 1; index >= 0; index -= 1) {
    if (hour + 1e-7 >= starts[index]) return index;
  }
  return starts.length - 1;
}

function nextShiftBoundary(time, starts) {
  const day = Math.floor(time / 24);
  const hour = time - (day * 24);
  const next = starts.find((start) => start > hour + 1e-7);
  return next === undefined ? ((day + 1) * 24) + starts[0] : (day * 24) + next;
}

function simulateShiftModel({ rooms, shiftAssignments, loginTimes, manufacturingRecipes, growthCategory, warmupHours, sampleHours }) {
  const starts = [...loginTimes].sort().map(parseClock);
  const totalHours = warmupHours + sampleHours;
  const accumulators = Object.fromEntries(rooms.map((room) => [room.id, emptyRoomAccumulator()]));
  const roomById = Object.fromEntries(rooms.map((room) => [room.id, room]));
  const operatorById = new Map();
  rooms.forEach((room) => (shiftAssignments[room.id] ?? []).forEach((team) => team.forEach((operator) => {
    if (!operatorById.has(operator.id)) operatorById.set(operator.id, operator);
  })));
  const states = new Map([...operatorById].map(([id, operator]) => [id, {
    operator,
    mood: MOOD_MAX,
    assignedRoom: null,
    working: false,
  }]));
  let recoveryRateHours = 0;
  let time = 0;
  let activeShift = shiftIndexAt(0, starts);

  const applyShift = (shiftIndex) => {
    states.forEach((state) => { state.assignedRoom = null; state.working = false; });
    rooms.forEach((room) => {
      const team = shiftAssignments[room.id]?.[shiftIndex] ?? [];
      team.forEach((operator) => {
        const state = states.get(operator.id);
        if (!state || state.assignedRoom) return;
        state.assignedRoom = room.id;
        state.working = state.mood > 1e-7;
      });
    });
  };
  applyShift(activeShift);

  while (time < totalHours - 1e-7) {
    const activeTeams = Object.fromEntries(rooms.map((room) => [room.id, []]));
    states.forEach((state) => {
      if (state.working && state.assignedRoom) activeTeams[state.assignedRoom].push(state.operator);
    });
    const controlTeam = activeTeams.control ?? [];
    const recoveryRate = moodRecoveryRate(controlTeam);
    const drainRates = Object.fromEntries(rooms.map((room) => [room.id, moodDrainRate(activeTeams[room.id])]));
    let nextTime = Math.min(totalHours, nextShiftBoundary(time, starts));
    states.forEach((state) => {
      if (state.working && state.assignedRoom) {
        nextTime = Math.min(nextTime, time + (state.mood / drainRates[state.assignedRoom]));
      } else if (state.mood < MOOD_MAX - 1e-7) {
        nextTime = Math.min(nextTime, time + ((MOOD_MAX - state.mood) / recoveryRate));
      }
    });
    const duration = Math.max(0, nextTime - time);
    if (duration <= 1e-9) {
      time += 1e-7;
      continue;
    }
    const measuredDuration = Math.max(0, Math.min(nextTime, totalHours) - Math.max(time, warmupHours));
    if (measuredDuration > 0) {
      rooms.forEach((room) => {
        const team = activeTeams[room.id];
        const category = roomProductionCategory(room, team, manufacturingRecipes, growthCategory);
        const factor = category ? productionFactor(team, category) : 0;
        accumulators[room.id].effectiveHours += factor * measuredDuration;
        accumulators[room.id].coverageHours += (team.length ? 1 : 0) * measuredDuration;
        accumulators[room.id].activeOperatorHours += team.length * measuredDuration;
      });
      recoveryRateHours += recoveryRate * measuredDuration;
    }

    states.forEach((state) => {
      if (state.working && state.assignedRoom) {
        state.mood = Math.max(0, state.mood - (drainRates[state.assignedRoom] * duration));
        if (state.mood <= 1e-7) state.working = false;
      } else {
        state.mood = Math.min(MOOD_MAX, state.mood + (recoveryRate * duration));
      }
    });
    time = nextTime;
    const boundary = Math.abs(time - nextShiftBoundary(time - 1e-5, starts)) < 1e-4;
    if (boundary) {
      activeShift = shiftIndexAt(time, starts);
      applyShift(activeShift);
    } else {
      states.forEach((state) => {
        if (!state.working && state.assignedRoom && state.mood >= MOOD_MAX - 1e-7) {
          state.mood = MOOD_MAX;
          state.working = true;
        }
      });
    }
  }

  const roomStats = Object.fromEntries(rooms.map((room) => [
    room.id,
    normalizeRoomStats(accumulators[room.id], sampleHours),
  ]));
  return summarizeOutputs(rooms, roomStats, recoveryRateHours / sampleHours, manufacturingRecipes, growthCategory);
}

export function evaluateShiftAssignments({ rooms, shiftAssignments, loginTimes, manufacturingRecipes = DEFAULT_MANUFACTURING_RECIPES, growthCategory = "vitrified", warmupDays = 60, sampleDays = 30 }) {
  return simulateShiftModel({
    rooms,
    shiftAssignments,
    loginTimes,
    manufacturingRecipes,
    growthCategory,
    warmupHours: warmupDays * 24,
    sampleHours: sampleDays * 24,
  });
}

export function buildDailySummary({ mode, rooms, assignments, shiftAssignments, loginTimes, manufacturingRecipes = DEFAULT_MANUFACTURING_RECIPES, growthCategory = "vitrified", axisScope = "shared" }) {
  if (mode === "afk") return simulateAfk({ rooms, assignments, manufacturingRecipes, growthCategory, axisScope });
  return evaluateShiftAssignments({ rooms, shiftAssignments, loginTimes, manufacturingRecipes, growthCategory });
}
