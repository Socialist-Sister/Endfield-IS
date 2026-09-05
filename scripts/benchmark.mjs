import { performance } from "node:perf_hooks";
import { OPERATORS } from "../src/operatorData.js";
import { optimizeAfkAssignments, optimizeShiftAssignments } from "../src/assignmentOptimizer.js";
import { buildDailySummary, DEFAULT_MANUFACTURING_RECIPES } from "../src/scheduleModel.js";

const rooms = [
  { id: "manufacture-a", type: "制造舱" }, { id: "manufacture-b", type: "制造舱" },
  { id: "growth", type: "培养舱" }, { id: "reception", type: "会客室" },
  { id: "control", type: "总控中枢" },
];
const configuration = {
  rooms, operators: OPERATORS,
  promotions: Object.fromEntries(OPERATORS.map((operator) => [operator.id, 4])),
  manufacturingRecipes: DEFAULT_MANUFACTURING_RECIPES, growthCategory: "rare-mineral",
  loginTimes: ["08:00", "22:30"],
};
for (const mode of ["afk", "shift"]) {
  const start = performance.now();
  const assignments = mode === "afk" ? optimizeAfkAssignments(configuration) : {};
  const shiftAssignments = mode === "shift" ? optimizeShiftAssignments(configuration) : {};
  const allocationMs = performance.now() - start;
  for (const axisScope of mode === "afk" ? ["shared", "facility"] : ["shared"]) {
    const summaryStart = performance.now();
    const summary = buildDailySummary({ ...configuration, assignments, shiftAssignments, mode, axisScope });
    console.log(JSON.stringify({ mode, axisScope, allocationMs, summaryMs: performance.now() - summaryStart, summary }));
  }
}
