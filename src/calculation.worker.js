import { OPERATORS } from "./operatorData.js";
import { optimizeAfkAssignments, optimizeShiftAssignments } from "./assignmentOptimizer.js";
import { buildDailySummary } from "./scheduleModel.js";

function emptyAssignments(rooms) {
  return Object.fromEntries(rooms.map((room) => [room.id, []]));
}

function emptyShiftAssignments(rooms, shiftCount) {
  return Object.fromEntries(rooms.map((room) => [room.id, Array.from({ length: shiftCount }, () => [])]));
}

self.onmessage = ({ data }) => {
  const {
    mode, rooms, selected, promotions, manufacturingRecipes, growthCategory, loginTimes, axisScope,
  } = data;
  const selectedOperators = OPERATORS.filter((operator) => selected.includes(operator.id));
  self.postMessage({ type: "progress", value: 8 });

  const assignments = mode === "afk"
    ? optimizeAfkAssignments({
      operators: selectedOperators,
      promotions,
      rooms,
      manufacturingRecipes,
      growthCategory,
    })
    : emptyAssignments(rooms);
  self.postMessage({ type: "progress", value: mode === "afk" ? 18 : 12 });

  const shiftAssignments = mode === "shift"
    ? optimizeShiftAssignments({
      operators: selectedOperators,
      promotions,
      rooms,
      manufacturingRecipes,
      growthCategory,
      loginTimes,
    })
    : emptyShiftAssignments(rooms, loginTimes.length);
  self.postMessage({ type: "progress", value: mode === "shift" ? 72 : 22 });

  const summary = buildDailySummary({
    mode,
    rooms,
    assignments,
    shiftAssignments,
    loginTimes,
    manufacturingRecipes,
    growthCategory,
    axisScope,
  });
  self.postMessage({ type: "result", assignments, shiftAssignments, summary });
};
