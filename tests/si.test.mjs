import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { OPERATORS, getActiveSkill } from "../src/operatorData.js";
import { prepareCandidate } from "../src/assignmentOptimizer.js";
import { DEFAULT_MANUFACTURING_RECIPES, productionFactor, sumSkillValue } from "../src/scheduleModel.js";
import { evaluatePlan } from "../src/planningModel.js";
import { optimizePlan } from "../src/planningOptimizer.js";
import { encodeSharedConfiguration, decodeSharedConfiguration } from "../src/shareTools.js";
const si = OPERATORS.find(op => op.id === "si");
const reception = { id: "reception", type: "会客室" };
const prepare = (op, promotion=4, room=reception) => prepareCandidate(op, room, promotion, DEFAULT_MANUFACTURING_RECIPES, "rare-mineral");
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("Si's E0–E4 reception skills match verified unlocks and upgrades", () => {
  assert.equal(si.name, "祀");
  assert.equal(si.rarity, 6);
  assert.ok(existsSync(new URL(`../public${si.avatar}`, import.meta.url)));
  assert.deepEqual(si.skills.map(s=>s.name), ["点器为伥", "墨魉代劳"]);
  for (const [promotion, clue, drop] of [[0,0,0],[1,20,0],[2,20,14],[3,30,14],[4,30,18]]) {
    const candidate=prepare(si,promotion);
    assert.equal(getActiveSkill(si.skills[0],promotion)?.value ?? 0,clue);
    assert.equal(sumSkillValue([candidate],"mood-drop"),drop);
    close(productionFactor([candidate],"clue-rate"),1.4*(1+clue/100));
  }
});

test("Si's reception bonuses never apply in manufacturing, growth, or control", () => {
  for (const room of [{id:"manufacture-a",type:"制造舱"},{id:"manufacture-b",type:"制造舱"},{id:"growth",type:"培养舱"},{id:"control",type:"总控中枢"}]) {
    const candidate=prepare(si,4,room);
    assert.deepEqual(candidate.activeSkills,[]);
    close(productionFactor([candidate],"operator-exp"),1.4);
    assert.equal(sumSkillValue([candidate],"mood-drop"),0);
  }
});

test("Si reduces the entire active crew's mood drain and boosts only her staffed clue window", () => {
  const [a,b]=OPERATORS.filter(o=>o.id!=="si").slice(0,2).map(o=>prepare(o,0));
  const result=evaluatePlan({rooms:[reception],teams:{reception:[[prepare(si),a],[b]]},roomPlans:{reception:{kind:"dual",start:0,duration:12}}});
  close(result.rooms.reception.averageFactor,(1.8*1.3+1.4)/2);
  close(result.rooms.reception.groups[0].minMood,100-7.2*.82*12);
  close(result.rooms.reception.groups[1].minMood,100-7.2*12);
  close(result.rooms.reception.coverageRate,1);
});

test("Si survives configuration sharing and is available to automatic and manual planning", () => {
  for (const mode of ["auto","manual"]) {
    const input={mode,selected:["si"],promotions:{si:2},manufacturingRecipes:DEFAULT_MANUFACTURING_RECIPES,growthCategory:"rare-mineral",roomPlans:{reception:{kind:"dual",start:20,duration:8}}};
    const restored=decodeSharedConfiguration(encodeSharedConfiguration(input));
    assert.deepEqual(restored.selected,["si"]);
    assert.equal(restored.promotions.si,2);
    const result=optimizePlan({...restored,rooms:[reception],operators:[si]});
    assert.deepEqual(Object.values(result.teams).flat(2).map(o=>o.id),["si"]);
    assert.ok(result.summary.clues>0);
    if(mode==="manual") { assert.equal(result.roomPlans.reception.start,20); assert.equal(result.roomPlans.reception.duration,8); }
  }
});
