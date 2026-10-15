import { OPERATORS } from "./operatorData.js";
import { optimizePlan } from "./planningOptimizer.js";
self.onmessage = ({ data }) => {
  try {
    const result = optimizePlan({ ...data, operators: OPERATORS.filter((operator) => data.selected.includes(operator.id)) },
      (value) => self.postMessage({ type: "progress", value }));
    self.postMessage({ type: "result", ...result });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : "计算失败" });
  }
};
