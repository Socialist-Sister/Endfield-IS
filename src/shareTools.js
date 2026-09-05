import { layoutFacilityRow } from "./resultCardLayout.js";
// Sharing stays client-only: configuration lives in the URL hash and result cards are drawn locally.
export const CANONICAL_URL = "https://www.endfieldis.dpdns.org/";
const SHARE_VERSION = 1;

function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeSharedConfiguration(configuration) {
  const selected = [...new Set(configuration.selected ?? [])];
  const promotions = selected
    .filter((operatorId) => Number(configuration.promotions?.[operatorId] ?? 4) !== 4)
    .map((operatorId) => [operatorId, Number(configuration.promotions[operatorId])]);
  return encodeBase64Url(JSON.stringify({
    v: SHARE_VERSION,
    m: configuration.mode === "shift" ? "s" : "a",
    o: selected,
    p: promotions,
    r: [configuration.manufacturingRecipes?.["manufacture-a"], configuration.manufacturingRecipes?.["manufacture-b"]],
    g: configuration.growthCategory,
    a: configuration.axisScope,
    t: configuration.loginTimes,
  }));
}

export function decodeSharedConfiguration(value) {
  try {
    const encoded = value.startsWith("#")
      ? new URLSearchParams(value.slice(1)).get("config")
      : value;
    if (!encoded || encoded.length > 65536) return null;
    const payload = JSON.parse(decodeBase64Url(encoded));
    if (payload.v !== SHARE_VERSION || !Array.isArray(payload.o)) return null;
    return {
      mode: payload.m === "s" ? "shift" : "afk",
      selected: payload.o,
      promotions: Object.fromEntries(Array.isArray(payload.p) ? payload.p : []),
      manufacturingRecipes: {
        "manufacture-a": payload.r?.[0],
        "manufacture-b": payload.r?.[1],
      },
      growthCategory: payload.g,
      axisScope: payload.a,
      loginTimes: Array.isArray(payload.t) ? payload.t : [],
    };
  } catch {
    return null;
  }
}

export function buildConfigurationShareUrl(configuration, baseUrl = CANONICAL_URL) {
  const url = new URL(baseUrl);
  url.hash = `config=${encodeSharedConfiguration(configuration)}`;
  return url.toString();
}

export async function copyText(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
  } catch {
    // Some browsers deny the Clipboard API but still allow a user-initiated copy.
  }
  const previousFocus = document.activeElement;
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  try {
    input.select();
    if (!document.execCommand("copy")) throw new Error("浏览器未允许复制");
  } finally {
    input.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}

function fitText(context, value, maxWidth) {
  const text = String(value ?? "");
  if (context.measureText(text).width <= maxWidth) return text;
  let output = text;
  while (output.length > 1 && context.measureText(`${output}…`).width > maxWidth) output = output.slice(0, -1);
  return `${output}…`;
}

function drawText(context, value, x, y, maxWidth) {
  context.fillText(fitText(context, value, maxWidth), x, y);
}

const EXPORT_COLORS = {
  ink: "#111313",
  paper: "#f4f5f3",
  fog: "#dfe1de",
  panel: "#eceeeb",
  lane: "#d8dbd8",
  yellow: "#ffef3a",
  yellowDark: "#b5aa00",
  muted: "#666b68",
  quiet: "#aeb2b0",
  rule: "#8c918e",
};

function drawMetric(context, metric, x, y, width, height) {
  context.fillStyle = EXPORT_COLORS.panel;
  context.fillRect(x, y, width, height);
  context.fillStyle = EXPORT_COLORS.yellow;
  context.fillRect(x, y, width, 7);
  context.fillStyle = "#555a57";
  context.font = '700 17px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
  drawText(context, metric.label, x + 20, y + 25, width - 40);
  context.fillStyle = EXPORT_COLORS.ink;
  context.font = '800 48px Bahnschrift, "Microsoft YaHei UI", sans-serif';
  drawText(context, metric.value, x + 20, y + 59, width - 92);
  const valueWidth = Math.min(context.measureText(metric.value).width, width - 112);
  context.fillStyle = EXPORT_COLORS.muted;
  context.fillRect(x + 31 + valueWidth, y + 67, 1, 31);
  context.font = '800 13px Bahnschrift, "Microsoft YaHei UI", sans-serif';
  context.fillText("日均", x + 43 + valueWidth, y + 77);
  context.fillStyle = "#6d726f";
  context.font = '500 13px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
  drawText(context, metric.note, x + 20, y + height - 29, width - 40);
}

function loadImage(source) {
  return new Promise((resolve) => {
    if (!source) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.decoding = "async";
    const timer = window.setTimeout(() => finish(null), 8000);
    const finish = (value) => { window.clearTimeout(timer); image.onload = null; image.onerror = null; resolve(value); };
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = new URL(source, window.location.href).href;
  });
}

async function loadMemberImages(rows) {
  const sources = [...new Set(rows.flatMap((row) => (
    row.groups?.flatMap((group) => group.members?.map((member) => member.avatar).filter(Boolean) ?? []) ?? []
  )))];
  const images = await Promise.all(sources.map(async (source) => [source, await loadImage(source)]));
  return new Map(images);
}

function drawPortrait(context, member, image, x, y, size) {
  context.fillStyle = "#c8cbc8";
  context.fillRect(x, y, size, size);
  if (image) {
    context.drawImage(image, x, y, size, size);
  } else {
    context.fillStyle = EXPORT_COLORS.ink;
    context.font = `800 ${Math.round(size * .42)}px "Microsoft YaHei UI", sans-serif`;
    context.textAlign = "center";
    context.fillText(member.name?.slice(0, 1) || "·", x + (size / 2), y + (size * .24));
    context.textAlign = "left";
  }
  context.strokeStyle = "#777c79";
  context.lineWidth = 1;
  context.strokeRect(x + .5, y + .5, size - 1, size - 1);
}

function drawSkillRows(context, member, x, y, width, compact = false, skillLines = []) {
  const skills = member.skills?.slice(0, 2) ?? [];
  const facilityWidth = 58;
  let lineY = y;
  if (!skills.length) {
    context.fillStyle = EXPORT_COLORS.muted;
    context.font = '500 12px "Microsoft YaHei UI", sans-serif';
    context.fillText("通用进驻", x, y);
    return;
  }
  skills.forEach((skill, index) => {
    const activeColor = skill.active ? "#424744" : "#747976";
    context.fillStyle = activeColor;
    context.font = '500 12px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
    drawText(context, skill.facility, x, lineY, facilityWidth - 5);
    const lines = skillLines[index] ?? [skill.description];
    lines.forEach((line, lineIndex) => context.fillText(line, x + facilityWidth, lineY + lineIndex * 18));
    lineY += lines.length * 18 + 4;
  });
}

function drawMemberCard(context, member, x, y, width, height, image, compact = false, skillLines = []) {
  context.fillStyle = EXPORT_COLORS.paper;
  context.fillRect(x, y, width, height);
  context.strokeStyle = EXPORT_COLORS.rule;
  context.lineWidth = 1;
  context.strokeRect(x + .5, y + .5, width - 1, height - 1);
  const portraitSize = compact ? 34 : 46;
  const inset = compact ? 10 : 12;
  drawPortrait(context, member, image, x + inset, y + inset, portraitSize);
  const textX = x + inset + portraitSize + (compact ? 10 : 12);
  context.fillStyle = EXPORT_COLORS.ink;
  context.font = `800 ${compact ? 13 : 16}px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif`;
  drawText(context, member.name, textX, y + inset - 1, width - (textX - x) - inset);
  drawSkillRows(
    context,
    member,
    textX,
    y + inset + (compact ? 23 : 29),
    width - (textX - x) - inset,
    compact,
    skillLines,
  );
}

function drawFacilityRow(context, row, x, y, width, height, mode, images, layout) {
  const labelWidth = 244;
  context.fillStyle = EXPORT_COLORS.ink;
  context.fillRect(x, y, labelWidth, height);
  context.fillStyle = EXPORT_COLORS.yellow;
  context.fillRect(x, y, 8, height);
  context.fillStyle = "#ffffff";
  context.font = '800 23px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
  drawText(context, row.name, x + 27, y + 24, labelWidth - 48);
  context.fillStyle = "#c2c6c3";
  context.font = '500 14px "Microsoft YaHei UI", sans-serif';
  drawText(context, row.meta, x + 27, y + 61, labelWidth - 48);
  if (row.stat) {
    context.fillStyle = EXPORT_COLORS.quiet;
    context.font = '700 12px Bahnschrift, "Microsoft YaHei UI", sans-serif';
    drawText(context, row.stat, x + 27, y + 94, labelWidth - 48);
  }

  const contentX = x + labelWidth + 1;
  const contentWidth = width - labelWidth - 1;
  context.fillStyle = EXPORT_COLORS.lane;
  context.fillRect(contentX, y, contentWidth, height);
  const groups = row.groups?.length ? row.groups : [{ label: "—", members: [] }];
  groups.forEach((group, groupIndex) => {
    const groupLayout = layout.groups[groupIndex];
    const groupX = x + groupLayout.x;
    const groupWidth = groupLayout.width;
    if (mode === "afk") {
      context.fillStyle = EXPORT_COLORS.ink;
      context.fillRect(groupX, y + 14, groupWidth, 29);
      context.fillStyle = EXPORT_COLORS.yellowDark;
      context.fillRect(groupX, y + 14, 5, 29);
      context.fillStyle = "#7d827f";
      context.font = '700 11px Bahnschrift, sans-serif';
      context.fillText("T", groupX + 13, y + 22);
      context.fillStyle = EXPORT_COLORS.yellow;
      context.font = '800 13px Bahnschrift, "Microsoft YaHei UI", sans-serif';
      drawText(context, group.label.replace(/^T\s*/u, ""), groupX + 30, y + 20, groupWidth - 42);
      const member = group.members?.[0];
      if (member) {
        const card = groupLayout.members[0];
        drawMemberCard(context, member, x + card.x, y + card.y, card.width, card.height, images.get(member.avatar), false, card.skillLines);
      } else {
        context.fillStyle = EXPORT_COLORS.paper;
        context.fillRect(groupX, y + 43, groupWidth, height - 57);
        context.fillStyle = EXPORT_COLORS.muted;
        context.font = '500 13px "Microsoft YaHei UI", sans-serif';
        context.fillText("当前干员数量不足", groupX + 15, y + 72);
      }
      return;
    }

    context.fillStyle = "#c9ccc9";
    context.fillRect(groupX, y, groupWidth, 48);
    context.fillStyle = EXPORT_COLORS.muted;
    context.font = '700 12px "Microsoft YaHei UI", sans-serif';
    drawText(context, group.label, groupX + 13, y + 17, groupWidth - 26);
    const members = group.members ?? [];
    if (!members.length) {
      context.fillStyle = EXPORT_COLORS.muted;
      context.font = '500 13px "Microsoft YaHei UI", sans-serif';
      context.fillText("本班保留空位", groupX + 12, y + 66);
      return;
    }
    members.forEach((member, memberIndex) => {
      const card = groupLayout.members[memberIndex];
      drawMemberCard(context, member, x + card.x, y + card.y, card.width, card.height,
        images.get(member.avatar), true, card.skillLines);
    });
  });
}

export async function downloadResultCard({ mode, summary, growthLabel, rows, download = true }) {
  const width = 1600;
  const margin = 64;
  const headerY = 40;
  const headerHeight = 136;
  const metricsY = 202;
  const metricHeight = 150;
  const operationsY = metricsY + metricHeight;
  const operationHeight = 86;
  const sectionY = operationsY + operationHeight + 34;
  const sectionHeight = 60;
  const rowsY = sectionY + sectionHeight + 16;
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法初始化排班图");
  context.font = '500 12px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
  const layouts = rows.map((row) => layoutFacilityRow(mode, row, width - margin * 2, (text) => context.measureText(text).width));
  const rowHeights = layouts.map((layout) => layout.height);
  const rowsHeight = rowHeights.reduce((total, value) => total + value, 0);
  const footerY = rowsY + rowsHeight + 34;
  const height = footerY + 76;
  canvas.width = width;
  canvas.height = height;

  const images = await loadMemberImages(rows);
  context.textBaseline = "top";
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = EXPORT_COLORS.fog;
  context.fillRect(0, 0, width, height);

  const contentWidth = width - (margin * 2);
  context.fillStyle = EXPORT_COLORS.ink;
  context.fillRect(margin, headerY, contentWidth, headerHeight);
  context.fillStyle = EXPORT_COLORS.yellow;
  context.fillRect(margin, headerY, 10, headerHeight);
  context.fillRect(margin, headerY + headerHeight - 7, contentWidth, 7);
  const markX = margin + 30;
  const markY = headerY + 28;
  const markSize = 74;
  context.fillRect(markX, markY, markSize, markSize);
  context.fillStyle = EXPORT_COLORS.ink;
  context.fillRect(markX + 20, markY + 12, 34, 45);
  context.fillStyle = EXPORT_COLORS.yellow;
  context.fillRect(markX + 26, markY + 18, 22, 10);
  [[27, 36], [37, 36], [47, 36], [27, 46], [37, 46], [47, 46]].forEach(([dotX, dotY]) => {
    context.fillRect(markX + dotX, markY + dotY, 4, 4);
  });
  context.fillStyle = EXPORT_COLORS.ink;
  context.font = '900 11px Bahnschrift, sans-serif';
  context.textAlign = "center";
  context.fillText("IS", markX + (markSize / 2), markY + 61);
  context.textAlign = "left";

  const titleX = markX + markSize + 27;
  context.fillStyle = EXPORT_COLORS.yellow;
  context.font = '800 14px Bahnschrift, "Microsoft YaHei UI", sans-serif';
  context.fillText("// DIJIANG / SHIFT SCHEDULE", titleX, headerY + 25);
  context.fillStyle = "#ffffff";
  context.font = '900 39px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
  context.fillText("帝江排班方案", titleX, headerY + 51);
  context.fillStyle = EXPORT_COLORS.quiet;
  context.font = '600 13px Bahnschrift, "Microsoft YaHei UI", sans-serif';
  context.fillText("ENDFIELD INDUSTRIES · INFRASTRUCTURE SCHEDULE", titleX, headerY + 101);

  const metaWidth = 310;
  const metaX = margin + contentWidth - metaWidth;
  context.fillStyle = "#3f4341";
  context.fillRect(metaX, headerY + 22, 1, headerHeight - 51);
  context.fillStyle = "#858a87";
  context.font = '700 11px Bahnschrift, sans-serif';
  context.fillText("SCHEDULE EXPORT", metaX + 24, headerY + 25);
  context.fillStyle = EXPORT_COLORS.yellow;
  context.font = '800 18px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
  context.fillText(mode === "afk" ? "长期挂机方案" : "固定上线倒班方案", metaX + 24, headerY + 50);
  const now = new Date();
  const exportDate = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part, index) => index ? String(part).padStart(2, "0") : String(part))
    .join(".");
  context.fillStyle = EXPORT_COLORS.quiet;
  context.font = '700 14px Bahnschrift, sans-serif';
  context.fillText(exportDate, metaX + 24, headerY + 84);

  const metrics = [
    { label: "高级认知载体", value: summary.cognitive.toFixed(1), note: "制造舱 · 最高等级 · 实际在岗折算" },
    { label: "高级作战记录", value: summary.operator.toFixed(1), note: "制造舱 · 最高等级 · 实际在岗折算" },
    { label: "武器检查套组", value: summary.weapon.toFixed(1), note: "制造舱 · 最高等级 · 实际在岗折算" },
    { label: `${growthLabel}培养`, value: summary.growth.toFixed(2), note: "培养舱 · 最高等级 · 9 箱 / 61h06m40s" },
    { label: "预计线索搜集", value: summary.clues.toFixed(2), note: "会客室 · 按 72 小时基础周期估算" },
  ];
  const metricGap = 1;
  const metricWidth = (width - (margin * 2) - (metricGap * 4)) / 5;
  metrics.forEach((metric, index) => drawMetric(context, metric, margin + (index * (metricWidth + metricGap)), metricsY, metricWidth, metricHeight));

  context.fillStyle = EXPORT_COLORS.ink;
  context.fillRect(margin, operationsY, contentWidth, operationHeight);
  const operational = [
    ["平均产效", `${(summary.averageEfficiency * 100).toFixed(0)}%`, "生产设施等权平均"],
    ["平均在岗", `${summary.averageActive.toFixed(2)} / 3`, "生产设施长期均值"],
    ["设施覆盖", `${(summary.averageCoverage * 100).toFixed(1)}%`, "至少一人在岗的时间"],
    ["平均停产", `${summary.averageDowntime.toFixed(2)}h`, "每设施每日"],
  ];
  operational.forEach(([label, value, note], index) => {
    const itemWidth = contentWidth / 4;
    const itemX = margin + (index * itemWidth);
    if (index) {
      context.fillStyle = "#3f4341";
      context.fillRect(itemX, operationsY + 14, 1, operationHeight - 28);
    }
    context.fillStyle = EXPORT_COLORS.quiet;
    context.font = '500 14px "Microsoft YaHei UI", sans-serif';
    context.fillText(label, itemX + 20, operationsY + 17);
    context.fillStyle = EXPORT_COLORS.yellow;
    context.font = '800 23px Bahnschrift, "Microsoft YaHei UI", sans-serif';
    context.textAlign = "right";
    context.fillText(value, itemX + itemWidth - 20, operationsY + 15);
    context.textAlign = "left";
    context.fillStyle = "#858a87";
    context.font = '500 12px "Microsoft YaHei UI", sans-serif';
    drawText(context, note, itemX + 20, operationsY + 54, itemWidth - 40);
  });

  context.fillStyle = "#d2d5d2";
  context.fillRect(margin, sectionY, contentWidth, sectionHeight);
  context.fillStyle = EXPORT_COLORS.yellowDark;
  context.fillRect(margin, sectionY, 7, sectionHeight);
  context.fillStyle = "#626764";
  context.font = '700 11px Bahnschrift, sans-serif';
  context.fillText("ASSIGNMENT PLAN", margin + 22, sectionY + 11);
  context.fillStyle = EXPORT_COLORS.ink;
  context.font = '800 18px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
  context.fillText(mode === "afk" ? "算法推荐启动轴" : "按上线节点进行整组换班", margin + 22, sectionY + 30);

  let rowY = rowsY;
  rows.forEach((row, index) => {
    drawFacilityRow(context, row, margin, rowY, contentWidth, rowHeights[index], mode, images, layouts[index]);
    context.fillStyle = "#5f6461";
    context.fillRect(margin, rowY + rowHeights[index] - 1, contentWidth, 1);
    rowY += rowHeights[index];
  });
  context.strokeStyle = EXPORT_COLORS.ink;
  context.lineWidth = 1;
  context.strokeRect(margin + .5, rowsY + .5, contentWidth - 1, rowsHeight - 1);

  context.fillStyle = EXPORT_COLORS.ink;
  context.fillRect(margin, footerY, contentWidth, 52);
  context.fillStyle = "#ffffff";
  context.font = '800 15px Bahnschrift, "Microsoft YaHei UI", sans-serif';
  context.fillText("ENDFIELD-IS", margin + 20, footerY + 18);
  context.fillStyle = "#858a87";
  context.font = '500 13px Bahnschrift, "Microsoft YaHei UI", sans-serif';
  context.textAlign = "right";
  context.fillText(CANONICAL_URL.replace(/\/$/u, ""), margin + contentWidth - 20, footerY + 19);
  context.textAlign = "left";

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("无法生成排班图");
  if (download) {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    anchor.href = objectUrl;
    anchor.download = `endfield-is-${mode}-${date}.png`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }
  return blob;
}
