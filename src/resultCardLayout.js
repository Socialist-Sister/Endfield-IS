// Canvas and tests share these bounds. Text wraps before row heights are chosen.
export function wrapText(value, maxWidth, measure) {
  const lines = [];
  let line = "";
  for (const character of String(value ?? "")) {
    if (character === "\n") { lines.push(line); line = ""; continue; }
    if (line && measure(line + character) > maxWidth) { lines.push(line); line = ""; }
    line += character;
  }
  lines.push(line);
  return lines;
}

export function layoutFacilityRow(mode, row, width, measure) {
  const labelWidth = 244;
  const contentX = labelWidth + 1;
  const compact = mode !== "afk";
  const padding = compact ? 0 : 14;
  const gap = compact ? 1 : 10;
  const groups = row.groups?.length ? row.groups : [{ label: "—", members: [] }];
  const groupWidth = (width - contentX - padding * 2 - gap * (groups.length - 1)) / groups.length;
  let height = compact ? 160 : 174;
  const layouts = groups.map((group, index) => {
    const x = contentX + padding + index * (groupWidth + gap);
    const cardWidth = groupWidth - (compact ? 18 : 0);
    const inset = compact ? 10 : 12;
    const portraitSize = compact ? 34 : 46;
    const textOffset = inset + portraitSize + (compact ? 10 : 12);
    const descriptionWidth = cardWidth - textOffset - inset - 58;
    let memberY = compact ? 57 : 43;
    const members = (group.members ?? []).map((member) => {
      const skillLines = (member.skills ?? []).slice(0, 2).map((skill) =>
        wrapText(skill.description, Math.max(12, descriptionWidth), measure));
      const skillHeight = skillLines.reduce((total, lines) => total + lines.length * 18 + 4, 0);
      const cardHeight = Math.max(compact ? 79 : 117, inset * 2 + (compact ? 23 : 29) + skillHeight);
      const bounds = { x: x + (compact ? 9 : 0), y: memberY, width: cardWidth, height: cardHeight, skillLines };
      memberY += cardHeight + (compact ? 9 : 0);
      return bounds;
    });
    height = Math.max(height, memberY + (compact ? 6 : 14));
    return { x, width: groupWidth, members };
  });
  return { height, labelWidth, contentX, groups: layouts };
}
