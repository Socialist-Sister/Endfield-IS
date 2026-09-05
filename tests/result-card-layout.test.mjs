import assert from "node:assert/strict";
import test from "node:test";
import { layoutFacilityRow, wrapText } from "../src/resultCardLayout.js";

const measure = (text) => Array.from(text).length * 12;
const member = { skills: [
  { description: "菌类质料培养效率 +30%" },
  { description: "同类定向线索效果不可叠加，当前设施不生效" },
] };

test("wrapped text preserves every character including unicode symbols", () => {
  const text = "技能：培养效率+30%🟨";
  const lines = wrapText(text, 60, measure);
  assert.equal(lines.join(""), text);
  assert.ok(lines.every((line) => measure(line) <= 60));
});

for (const mode of ["afk", "shift"]) {
  for (const groupCount of [0, 1, 2, 3, 4]) {
    for (const memberCount of mode === "afk" ? [0, 1] : [0, 1, 2, 3, 6]) {
      test(`${mode}: ${groupCount} groups / ${memberCount} members stay inside the row`, () => {
        const row = { groups: Array.from({ length: groupCount }, () => ({ members: Array.from({ length: memberCount }, () => member) })) };
        const layout = layoutFacilityRow(mode, row, 1472, measure);
        for (const group of layout.groups) {
          let previousBottom = 0;
          for (const card of group.members) {
            assert.ok(card.x >= layout.contentX);
            assert.ok(card.x + card.width <= 1472 + 1e-8);
            assert.ok(card.y >= previousBottom);
            assert.ok(card.y + card.height < layout.height);
            assert.equal(card.skillLines.length, 2);
            card.skillLines.forEach((lines, index) => assert.equal(lines.join(""), member.skills[index].description));
            previousBottom = card.y + card.height;
          }
        }
      });
    }
  }
}
