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
    if (!encoded) return null;
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
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  document.execCommand("copy");
  input.remove();
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

function drawMetric(context, metric, x, y, width, height) {
  context.fillStyle = "#eceeeb";
  context.fillRect(x, y, width, height);
  context.fillStyle = "#ffef3a";
  context.fillRect(x, y, width, 8);
  context.fillStyle = "#555a57";
  context.font = '700 18px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
  drawText(context, metric.label, x + 22, y + 28, width - 44);
  context.fillStyle = "#111313";
  context.font = '800 48px Bahnschrift, "Microsoft YaHei UI", sans-serif';
  drawText(context, metric.value, x + 22, y + 64, width - 90);
  context.fillStyle = "#666b68";
  context.font = '700 15px "Microsoft YaHei UI", sans-serif';
  context.fillText("日均", x + width - 58, y + 91);
}

function drawFacilityRow(context, row, x, y, width, height) {
  const labelWidth = 278;
  context.fillStyle = "#111313";
  context.fillRect(x, y, labelWidth, height);
  context.fillStyle = "#ffef3a";
  context.fillRect(x, y, 8, height);
  context.fillStyle = "#ffffff";
  context.font = '800 25px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
  drawText(context, row.name, x + 28, y + 27, labelWidth - 48);
  context.fillStyle = "#aeb2b0";
  context.font = '500 15px "Microsoft YaHei UI", sans-serif';
  drawText(context, row.meta, x + 28, y + 68, labelWidth - 48);
  if (row.stat) {
    context.fillStyle = "#ffef3a";
    context.font = '700 14px Bahnschrift, "Microsoft YaHei UI", sans-serif';
    drawText(context, row.stat, x + 28, y + 104, labelWidth - 48);
  }

  const contentX = x + labelWidth + 1;
  const contentWidth = width - labelWidth - 1;
  context.fillStyle = "#f4f5f3";
  context.fillRect(contentX, y, contentWidth, height);
  const groups = row.groups?.length ? row.groups : [{ label: "—", members: [] }];
  const groupWidth = contentWidth / groups.length;
  groups.forEach((group, groupIndex) => {
    const groupX = contentX + (groupIndex * groupWidth);
    if (groupIndex) {
      context.fillStyle = "#b8bcba";
      context.fillRect(groupX, y + 16, 1, height - 32);
    }
    context.fillStyle = "#111313";
    context.font = '800 16px Bahnschrift, "Microsoft YaHei UI", sans-serif';
    drawText(context, group.label, groupX + 18, y + 20, groupWidth - 36);
    if (!group.members?.length) {
      context.fillStyle = "#858a87";
      context.font = '500 15px "Microsoft YaHei UI", sans-serif';
      context.fillText("空位", groupX + 18, y + 57);
      return;
    }
    group.members.slice(0, 3).forEach((member, memberIndex) => {
      const memberY = y + 55 + (memberIndex * 29);
      context.fillStyle = "#a99f00";
      context.fillRect(groupX + 18, memberY + 4, 7, 7);
      context.fillStyle = "#111313";
      context.font = '700 16px "Microsoft YaHei UI", sans-serif';
      drawText(context, member.name, groupX + 35, memberY, Math.min(130, groupWidth * .35));
      context.fillStyle = "#666b68";
      context.font = '500 13px "Microsoft YaHei UI", sans-serif';
      drawText(context, member.detail || "通用进驻", groupX + Math.min(175, groupWidth * .42), memberY + 2, Math.max(80, groupWidth - Math.min(195, groupWidth * .42)));
    });
  });
}

export async function downloadResultCard({ mode, summary, growthLabel, rows }) {
  const width = 1600;
  const rowHeight = 148;
  const height = 430 + (rows.length * rowHeight) + 94;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.textBaseline = "top";
  context.fillStyle = "#dfe1de";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#ffef3a";
  context.fillRect(0, 0, width, 14);
  context.fillStyle = "#111313";
  context.fillRect(0, 14, width, 142);
  context.fillStyle = "#ffef3a";
  context.font = '800 18px Bahnschrift, "Microsoft YaHei UI", sans-serif';
  context.fillText("// DIJIANG / SHIFT CALCULATOR", 72, 48);
  context.fillStyle = "#ffffff";
  context.font = '800 46px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif';
  context.fillText("帝江排班计算结果", 72, 83);
  context.fillStyle = "#aeb2b0";
  context.font = '500 17px "Microsoft YaHei UI", sans-serif';
  context.fillText(mode === "afk" ? "长期挂机推荐" : "固定上线倒班推荐", width - 240, 94);

  const metrics = [
    { label: "高级认知载体", value: summary.cognitive.toFixed(1) },
    { label: "高级作战记录", value: summary.operator.toFixed(1) },
    { label: "武器检查套组", value: summary.weapon.toFixed(1) },
    { label: `${growthLabel}培养`, value: summary.growth.toFixed(2) },
    { label: "预计线索搜集", value: summary.clues.toFixed(2) },
  ];
  const margin = 72;
  const metricGap = 2;
  const metricWidth = (width - (margin * 2) - (metricGap * 4)) / 5;
  metrics.forEach((metric, index) => drawMetric(context, metric, margin + (index * (metricWidth + metricGap)), 184, metricWidth, 142));

  context.fillStyle = "#111313";
  context.fillRect(margin, 328, width - (margin * 2), 74);
  const operational = [
    ["平均产效", `${(summary.averageEfficiency * 100).toFixed(0)}%`],
    ["平均在岗", `${summary.averageActive.toFixed(2)} / 3`],
    ["设施覆盖", `${(summary.averageCoverage * 100).toFixed(1)}%`],
    ["平均停产", `${summary.averageDowntime.toFixed(2)}h`],
  ];
  operational.forEach(([label, value], index) => {
    const itemWidth = (width - (margin * 2)) / 4;
    const itemX = margin + (index * itemWidth);
    if (index) {
      context.fillStyle = "#3f4341";
      context.fillRect(itemX, 344, 1, 42);
    }
    context.fillStyle = "#aeb2b0";
    context.font = '500 15px "Microsoft YaHei UI", sans-serif';
    context.fillText(label, itemX + 22, 345);
    context.fillStyle = "#ffef3a";
    context.font = '800 24px Bahnschrift, "Microsoft YaHei UI", sans-serif';
    context.fillText(value, itemX + 22, 367);
  });

  rows.forEach((row, index) => drawFacilityRow(context, row, margin, 430 + (index * rowHeight), width - (margin * 2), rowHeight - 2));
  const footerY = 430 + (rows.length * rowHeight) + 28;
  context.fillStyle = "#111313";
  context.font = '800 16px Bahnschrift, "Microsoft YaHei UI", sans-serif';
  context.fillText("ENDFIELD-IS", margin, footerY);
  context.fillStyle = "#666b68";
  context.font = '500 14px Bahnschrift, "Microsoft YaHei UI", sans-serif';
  context.fillText(CANONICAL_URL.replace(/\/$/u, ""), width - 345, footerY);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("无法生成排班图");
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  anchor.href = objectUrl;
  anchor.download = `endfield-is-${mode}-${date}.png`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
