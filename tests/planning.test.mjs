import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePlan, normalizeRoomPlans, planWindow, activePlanGroup } from "../src/planningModel.js";
import { evaluateStartupOffsets, evaluateShiftAssignments } from "../src/scheduleModel.js";
import { optimizePlan } from "../src/planningOptimizer.js";
import { OPERATORS } from "../src/operatorData.js";
const room = { id: "manufacture-a", type: "制造舱" };
const worker = (id, skills = {}) => ({ id, activeSkills: Object.entries(skills).map(([category, value]) => ({ category, activeTier: { value } })) });
const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a-b) < tolerance, `${a} != ${b}`);
const simulate = (teams, plan, extra = {}) => evaluatePlan({ rooms: [room], teams: { [room.id]: teams }, roomPlans: { [room.id]: plan }, ...extra });

test("AB: rested 2+1 crews produce the analytic 160% indefinitely", () => {
  const result = simulate([[worker("a"), worker("b")], [worker("c")]], { kind: "dual", start: 0, duration: 12 });
  close(result.rooms[room.id].averageFactor, 1.6); close(result.rooms[room.id].coverageRate, 1);
  close(result.rooms[room.id].groups[0].minMood, 16);
});
test("single-team engine matches original event simulation including mixed control recovery", () => {
  const rooms = [room, { id: "control", type: "总控中枢" }];
  const assignments = { [room.id]: [worker("a", {"operator-exp":30}), worker("b"), worker("c")], control: [worker("d", {"mood-regen":16}), worker("e", {"mood-regen":12})] };
  const offsetsByRoom = { [room.id]: [0, 2.5, 9], control: [0, 7, 0] };
  const original = evaluateStartupOffsets({ rooms, assignments, offsetsByRoom, warmupDays: 180, sampleDays: 90 });
  const updated = evaluatePlan({ rooms, teams: Object.fromEntries(rooms.map((r) => [r.id, [assignments[r.id], []]])), roomPlans: Object.fromEntries(rooms.map((r) => [r.id, {kind:"single", offsets:offsetsByRoom[r.id]}])) });
  close(updated.cognitive, original.cognitive, 1e-5); close(updated.moodRecovery, original.moodRecovery, 1e-5);
});
test("AB agrees with original two-shift simulation, including exhausted crews and unequal hours", () => {
  const teams = [[worker("a", {"operator-exp":30})], [worker("b")]];
  const original = evaluateShiftAssignments({rooms:[room],shiftAssignments:{[room.id]:teams},loginTimes:["00:00","20:00"],warmupDays:180,sampleDays:90});
  const updated = simulate(teams,{kind:"dual",start:0,duration:20});
  close(updated.cognitive,original.cognitive,1e-6);
  assert.ok(updated.rooms[room.id].groups[0].fatigueHours > 0);
});
test("AB half-day empty group has exactly twelve hours of downtime", () => {
  const result = simulate([[worker("a")], []],{kind:"dual",start:0,duration:12});
  close(result.rooms[room.id].averageFactor,.7);close(result.rooms[room.id].downtimeHours,12);
});
test("midnight windows are complementary and use the correct active team", () => {
  const plan={kind:"dual",start:20,duration:8};
  assert.equal(planWindow(plan,0).label,"20:00–04:00 次日");
  assert.equal(planWindow(plan,1).label,"04:00–20:00");
  assert.deepEqual([0,4,12,20,24,28].map(t=>activePlanGroup(t,plan)),[0,1,1,0,0,1]);
  const teams=[[worker("a",{"operator-exp":30})],[worker("b")]];
  close(simulate(teams,plan).cognitive,simulate(teams,{...plan,start:0}).cognitive,1e-6);
});
test("mixed modes: resting control groups provide no recovery bonus", () => {
  const result=evaluatePlan({rooms:[room,{id:"control",type:"总控中枢"}],teams:{[room.id]:[[worker("a")],[]],control:[[worker("c",{"mood-regen":50})],[]]},roomPlans:{[room.id]:{kind:"single",offsets:[0,0,0]},control:{kind:"dual",start:0,duration:12}}});
  close(result.moodRecovery,15);
});
test("duplicate ownership, too many members, and a B team in single mode are rejected", () => {
  assert.throws(()=>simulate([[worker("a")],[worker("a")]],{kind:"dual"}),/重复/);
  assert.throws(()=>simulate([[1,2,3,4].map(worker),[]],{kind:"dual"}),/最多/);
  assert.throws(()=>simulate([[worker("a")],[worker("b")]],{kind:"single"}),/B 组/);
});
test("malformed times normalize to finite half-hour values", () => {
  const plans=normalizeRoomPlans({[room.id]:{kind:"invalid",start:NaN,duration:Infinity,offsets:[-10,"8",99]}},[room.id]);
  assert.deepEqual(plans[room.id],{kind:"dual",start:0,duration:12,offsets:[0,5,23.5]});
});
test("one selected operator can be scheduled; manual constraints survive unchanged", () => {
  const input={mode:"manual",rooms:[room],operators:[OPERATORS.find(op=>op.id==='purrchena')],promotions:{},manufacturingRecipes:{"manufacture-a":"advanced-battle-record"},growthCategory:"rare-mineral",roomPlans:{[room.id]:{kind:"dual",start:22,duration:10}}};
  const result=optimizePlan(input);
  assert.deepEqual(result.roomPlans,normalizeRoomPlans(input.roomPlans,[room.id]));
  assert.equal(Object.values(result.teams).flat(2).length,1);assert.ok(result.summary.operator>0);
});
test("automatic solution retains a verified single-team baseline and unique operators", () => {
  const result=optimizePlan({mode:"auto",rooms:[room],operators:OPERATORS.slice(-3),promotions:{},manufacturingRecipes:{"manufacture-a":"advanced-battle-record"},growthCategory:"rare-mineral"});
  const ids=Object.values(result.teams).flat(2).map(op=>op.id);
  assert.equal(ids.length,new Set(ids).size);
  assert.ok(result.summary.planning.score>=result.summary.planning.singleBaselineScore-1e-7);
});

// A single 7%/12% fatigue cycle meets an empty AB room's midnight boundary
// at 2999.9999999999604h; the next event must advance to the following boundary.
test("a one-person mixed plan tolerates floating-point midnight collisions", () => {
  const rooms=[room,{id:"manufacture-b",type:"制造舱"}];
  const result=evaluatePlan({rooms,teams:{[room.id]:[[],[]],"manufacture-b":[[worker("a")],[]]},roomPlans:{[room.id]:{kind:"dual",start:0,duration:12},"manufacture-b":{kind:"single",offsets:[0,5,10]}}});
  assert.ok(Number.isFinite(result.operator));
  assert.ok(result.rooms["manufacture-b"].averageFactor > .8);
});
