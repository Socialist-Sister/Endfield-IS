import { BASE_MOOD_DRAIN_PER_HOUR, BASE_MOOD_RECOVERY_PER_HOUR, MOOD_MAX, DEFAULT_MANUFACTURING_RECIPES, manufacturingSkillCategory, sumSkillValue, summarizeOutputs } from "./scheduleModel.js";

export const PLAN_ROOM_IDS = ["control", "reception", "manufacture-a", "manufacture-b", "growth"];
export const PLAN_RULES = Object.freeze({ version: "hourly-ab-2026-10-15", resolutionMinutes: 60, singleResolutionMinutes: 30, warmupDays: 180, sampleDays: 90 });
const EPS = 1e-7;
export const modulo24 = (value) => ((value % 24) + 24) % 24;
const finite = (value, fallback) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
export function normalizeRoomPlans(value = {}, ids = PLAN_ROOM_IDS) {
  return Object.fromEntries(ids.map((id) => {
    const plan = value?.[id];
    const start = modulo24(finite(plan?.start, 0));
    const duration = Math.max(0.5, Math.min(23.5, finite(plan?.duration, 12)));
    return [id, { kind: plan?.kind === "single" ? "single" : "dual",
      start: modulo24(Math.round(start)),
      // Round both clock endpoints, not start and duration independently.
      duration: Math.max(1, Math.min(23, Math.round(start + duration) - Math.round(start))),
      offsets: [0, 1, 2].map((index) => Math.max(0, Math.min(23.5, Math.round(finite(plan?.offsets?.[index], [0, 5, 10][index]) * 2) / 2))),
    }];
  }));
}
export function formatPlanClock(hours) {
  const minutes = Math.round(modulo24(hours) * 60) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function planWindow(plan, group) {
  const start = group === 0 ? plan.start : modulo24(plan.start + plan.duration);
  const duration = group === 0 ? plan.duration : 24 - plan.duration;
  const rawEnd = start + duration;
  return { start, duration, end: modulo24(rawEnd), label: `${formatPlanClock(start)}–${rawEnd === 24 ? "24:00" : formatPlanClock(rawEnd)}${rawEnd > 24 ? " 次日" : ""}` };
}
export function activePlanGroup(time, plan) {
  return modulo24(time - plan.start) < plan.duration - EPS ? 0 : 1;
}

export function compilePlan({ rooms, teams, manufacturingRecipes = DEFAULT_MANUFACTURING_RECIPES, growthCategory = "rare-mineral" }) {
  const used = new Set();
  return rooms.map((room) => {
    const category = room.type === "制造舱" ? manufacturingSkillCategory(room.id, manufacturingRecipes) : room.id === "growth" ? growthCategory : room.id === "reception" ? "clue-rate" : null;
    const groups = teams[room.id] ?? [[], []];
    if (groups.length !== 2) throw new Error("每个舱室必须包含两个班组槽位");
    return { id: room.id, category, groups: groups.map((team) => {
      if (team.length > 3) throw new Error("班组最多容纳 3 名干员");
      return team.map((op) => {
        if (used.has(op.id)) throw new Error("同一干员不能重复编入班组");
        used.add(op.id);
        return { id: op.id, drop: sumSkillValue([op], "mood-drop"), regen: sumSkillValue([op], "mood-regen"), output: category ? sumSkillValue([op], category) : 0 };
      });
    }) };
  });
}

// One event clock for every room: Control Nexus changes affect recovery in both
// single-team and AB rooms immediately. Mood is never reset at shift boundaries.
export function simulatePlan(model, inputPlans, { warmupDays = 180, sampleDays = 90 } = {}) {
  if (!Number.isFinite(warmupDays) || warmupDays < 0 || !Number.isFinite(sampleDays) || sampleDays <= 0) throw new Error("无效模拟周期");
  const plans = normalizeRoomPlans(inputPlans, model.map((room) => room.id));
  const states = [];
  model.forEach((room, ri) => room.groups.forEach((team, gi) => {
    if (plans[room.id].kind === "single" && gi === 1 && team.length) throw new Error("单班方案不能包含 B 组人员");
    team.forEach((profile, index) => states.push({ profile, ri, gi, index, mood: MOOD_MAX, working: false, started: false, scheduled: false }));
  }));
  const membersByRoom = model.map((_, ri) => [0, 1].map((gi) => states.filter((s) => s.ri === ri && s.gi === gi)));
  const roomPlans = model.map((room) => plans[room.id]);
  const boundaries = [...new Set(roomPlans.filter((plan) => plan.kind === "dual").flatMap((plan) => [plan.start, modulo24(plan.start + plan.duration)]))].sort((a, b) => a - b);
  const size = model.length;
  const counts = new Array(size).fill(0), drops = [...counts], regens = [...counts], outputs = [...counts], drains = [...counts];
  const stats = model.map(() => ({ effective: 0, coverage: 0, occupied: 0, groups: [0, 1].map(() => ({ minMood: MOOD_MAX, active: 0, fatigue: 0 })) }));
  const control = model.findIndex((room) => room.id === "control");
  const warmup = warmupDays * 24, finish = warmup + sampleDays * 24;
  let time = 0, recoveryHours = 0;
  while (time < finish - EPS) {
    counts.fill(0); drops.fill(0); regens.fill(0); outputs.fill(0);
    for (const state of states) {
      const plan = roomPlans[state.ri];
      if (plan.kind === "single") {
        if (!state.started && time + EPS >= plan.offsets[state.index]) { state.started = true; state.working = true; }
        else if (state.started && !state.working && state.mood >= MOOD_MAX - EPS) state.working = true;
        state.scheduled = state.started;
      } else {
        const scheduled = activePlanGroup(time + EPS, plan) === state.gi;
        if (!scheduled) state.working = false;
        else if ((!state.scheduled && state.mood > EPS) || state.mood >= MOOD_MAX - EPS) state.working = true;
        state.scheduled = scheduled;
      }
      if (!state.working) continue;
      counts[state.ri]++; drops[state.ri] += state.profile.drop; regens[state.ri] += state.profile.regen; outputs[state.ri] += state.profile.output;
    }
    const recovery = BASE_MOOD_RECOVERY_PER_HOUR * (1 + (control < 0 ? 0 : regens[control] / 100));
    for (let ri = 0; ri < size; ri++) drains[ri] = BASE_MOOD_DRAIN_PER_HOUR * (1 - Math.min(0.95, drops[ri] / 100));
    let next = finish;
    if (time < warmup - EPS) next = Math.min(next, warmup);
    if (boundaries.length) {
      // Snap the day index at midnight within event tolerance. Taking modulo
      // just before midnight otherwise schedules the same boundary twice.
      const dayStart = Math.floor((time + EPS) / 24) * 24;
      const boundary = boundaries.find((b) => dayStart + b > time + EPS);
      next = Math.min(next, dayStart + (boundary ?? (24 + boundaries[0])));
    }
    for (const state of states) {
      if (roomPlans[state.ri].kind === "single" && !state.started) next = Math.min(next, roomPlans[state.ri].offsets[state.index]);
      else if (state.working) next = Math.min(next, time + state.mood / drains[state.ri]);
      else if (state.mood < MOOD_MAX - EPS) next = Math.min(next, time + (MOOD_MAX - state.mood) / recovery);
    }
    const duration = next - time;
    if (duration <= 1e-9) throw new Error("排班事件无法推进时间");
    const measured = Math.max(0, next - Math.max(time, warmup));
    recoveryHours += recovery * measured;
    for (let ri = 0; ri < size; ri++) {
      stats[ri].effective += (counts[ri] && model[ri].category ? (1 + 0.4 * counts[ri]) * (1 + outputs[ri] / 100) : 0) * measured;
      stats[ri].coverage += (counts[ri] ? measured : 0);
      stats[ri].occupied += counts[ri] * measured;
      for (let gi = 0; gi < 2; gi++) {
        const members = membersByRoom[ri][gi];
        if (members.some((s) => s.working)) stats[ri].groups[gi].active += measured;
        if (members.some((s) => s.scheduled && !s.working)) stats[ri].groups[gi].fatigue += measured;
      }
    }
    for (const state of states) {
      if (state.working) {
        state.mood = Math.max(0, state.mood - drains[state.ri] * duration);
        if (state.mood <= EPS) state.working = false;
      } else if (state.started || roomPlans[state.ri].kind === "dual") state.mood = Math.min(MOOD_MAX, state.mood + recovery * duration);
      if (measured > 0 && state.scheduled) stats[state.ri].groups[state.gi].minMood = Math.min(stats[state.ri].groups[state.gi].minMood, state.mood);
    }
    time = next;
  }
  const hours = sampleDays * 24;
  return { moodRecovery: recoveryHours / hours, rooms: Object.fromEntries(model.map((room, ri) => [room.id, {
    effectiveHoursPerDay: stats[ri].effective / sampleDays, averageFactor: stats[ri].effective / hours,
    coverageRate: Math.min(1, stats[ri].coverage / hours), averageActive: stats[ri].occupied / hours,
    downtimeHours: Math.max(0, 24 - stats[ri].coverage / sampleDays),
    groups: stats[ri].groups.map((group, gi) => ({ minMood: room.groups[gi].length ? group.minMood : null, activeHours: group.active / sampleDays, fatigueHours: group.fatigue / sampleDays })),
  }])) };
}
export function evaluatePlan({ rooms, teams, roomPlans, manufacturingRecipes = DEFAULT_MANUFACTURING_RECIPES, growthCategory = "rare-mineral", ...options }) {
  const result = simulatePlan(compilePlan({ rooms, teams, manufacturingRecipes, growthCategory }), roomPlans, options);
  return { ...summarizeOutputs(rooms, result.rooms, result.moodRecovery, manufacturingRecipes, growthCategory),
    planning: { roomPlans: normalizeRoomPlans(roomPlans, rooms.map((room) => room.id)), rules: PLAN_RULES.version, warmupDays: options.warmupDays ?? 180, sampleDays: options.sampleDays ?? 90 } };
}
