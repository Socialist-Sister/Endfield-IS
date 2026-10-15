import { performance } from "node:perf_hooks";
import { OPERATORS } from "../src/operatorData.js";
import { optimizePlan } from "../src/planningOptimizer.js";
import { DEFAULT_MANUFACTURING_RECIPES } from "../src/scheduleModel.js";
const rooms = [{id:"manufacture-a",type:"制造舱"},{id:"manufacture-b",type:"制造舱"},{id:"growth",type:"培养舱"},{id:"reception",type:"会客室"},{id:"control",type:"总控中枢"}];
for (const mode of ["auto", "manual"]) {
  const start = performance.now();
  const result = optimizePlan({mode, rooms, operators:OPERATORS, promotions:{}, manufacturingRecipes:DEFAULT_MANUFACTURING_RECIPES, growthCategory:"rare-mineral"});
  console.log(JSON.stringify({mode,elapsedMs:performance.now()-start,roomPlans:result.roomPlans,summary:result.summary}));
}
