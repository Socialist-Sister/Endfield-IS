import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { Calculator } from "@phosphor-icons/react/dist/csr/Calculator";
import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { ChartLineUp } from "@phosphor-icons/react/dist/csr/ChartLineUp";
import { Check } from "@phosphor-icons/react/dist/csr/Check";
import { ClockCounterClockwise } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { Crosshair } from "@phosphor-icons/react/dist/csr/Crosshair";
import { Cube } from "@phosphor-icons/react/dist/csr/Cube";
import { Diamond } from "@phosphor-icons/react/dist/csr/Diamond";
import { DotsNine } from "@phosphor-icons/react/dist/csr/DotsNine";
import { DownloadSimple } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { Factory } from "@phosphor-icons/react/dist/csr/Factory";
import { GithubLogo } from "@phosphor-icons/react/dist/csr/GithubLogo";
import { Hexagon } from "@phosphor-icons/react/dist/csr/Hexagon";
import { Info } from "@phosphor-icons/react/dist/csr/Info";
import { LinkSimple } from "@phosphor-icons/react/dist/csr/LinkSimple";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { SlidersHorizontal } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { Square } from "@phosphor-icons/react/dist/csr/Square";
import { Star } from "@phosphor-icons/react/dist/csr/Star";
import { Target } from "@phosphor-icons/react/dist/csr/Target";
import { Trash } from "@phosphor-icons/react/dist/csr/Trash";
import { Triangle } from "@phosphor-icons/react/dist/csr/Triangle";
import { FACILITIES, OPERATORS, getOperatorSkillSummary } from "./operatorData.js";
import {
  AXIS_SCOPES,
  DEFAULT_MANUFACTURING_RECIPES,
  MANUFACTURING_RECIPES,
  manufacturingRecipeId,
  manufacturingSkillCategory,
} from "./scheduleModel.js";
import {
  buildConfigurationShareUrl,
  copyText,
  decodeSharedConfiguration,
  downloadResultCard,
} from "./shareTools.js";

const INITIAL_SELECTED = [];
const REPOSITORY_URL = "https://github.com/Socialist-Sister/Endfield-IS";
const OPERATOR_SYMBOLS = [Diamond, Hexagon, Triangle, Square, Star, Crosshair, DotsNine, Cube, Target];
const ROOM_META = [
  { id: "manufacture-a", name: "制造舱Ⅰ", type: "制造舱", recipe: "生产制造" },
  { id: "manufacture-b", name: "制造舱Ⅱ", type: "制造舱", recipe: "生产制造" },
  { id: "growth", name: "培养舱Ⅰ", type: "培养舱", recipe: "质料培养" },
  { id: "reception", name: "会客室", type: "会客室", recipe: "线索收集" },
  { id: "control", name: "总控中枢", type: "总控中枢", recipe: "全局恢复" },
];
const RESULT_ROOM_ORDER = ["control", "reception", "manufacture-a", "manufacture-b", "growth"];
const RESULT_ROOM_META = RESULT_ROOM_ORDER.map((roomId) => ROOM_META.find((room) => room.id === roomId));
const GROWTH_OPTIONS = {
  "rare-mineral": { label: "矿物质料" },
  vitrified: { label: "晶植质料" },
  fungal: { label: "菌类质料" },
};
const OPERATOR_IDS = new Set(OPERATORS.map((operator) => operator.id));
const RECIPE_IDS = new Set(Object.keys(MANUFACTURING_RECIPES));
const GROWTH_IDS = new Set(Object.keys(GROWTH_OPTIONS));

function readSharedConfiguration() {
  if (typeof window === "undefined") return null;
  const shared = decodeSharedConfiguration(window.location.hash);
  if (!shared) return null;
  const selected = [...new Set(shared.selected.filter((operatorId) => OPERATOR_IDS.has(operatorId)))];
  const promotions = Object.fromEntries(OPERATORS.map((operator) => {
    const raw = shared.promotions?.[operator.id];
    const value = typeof raw === "number" || typeof raw === "string" ? Number(raw) : 4;
    return [operator.id, Number.isInteger(value) && value >= 0 && value <= 4 ? value : 4];
  }));
  const defaultRecipes = { ...DEFAULT_MANUFACTURING_RECIPES };
  const manufacturingRecipes = Object.fromEntries(Object.keys(defaultRecipes).map((roomId) => {
    const recipeId = shared.manufacturingRecipes?.[roomId];
    return [roomId, RECIPE_IDS.has(recipeId) ? recipeId : defaultRecipes[roomId]];
  }));
  const loginTimes = [...new Set(shared.loginTimes.filter((time) => typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/u.test(time)))].sort();
  return {
    mode: shared.mode === "shift" ? "shift" : "afk",
    selected,
    promotions,
    manufacturingRecipes,
    growthCategory: GROWTH_IDS.has(shared.growthCategory) ? shared.growthCategory : "rare-mineral",
    axisScope: typeof shared.axisScope === "string" && Object.hasOwn(AXIS_SCOPES, shared.axisScope) ? shared.axisScope : "shared",
    loginTimes,
  };
}
const emptyAssignments = () => Object.fromEntries(ROOM_META.map((room) => [room.id, []]));
const emptyShiftAssignments = (shiftCount) => Object.fromEntries(ROOM_META.map((room) => [room.id, Array.from({ length: shiftCount }, () => [])]));
function getRoomRecipe(room, manufacturingRecipes, growthCategory, summary) {
  if (room.type === "制造舱") {
    return MANUFACTURING_RECIPES[manufacturingRecipeId(room.id, manufacturingRecipes)].label;
  }
  if (room.id === "reception") return `预计 ${summary.clues.toFixed(2)} 线索/日`;
  if (room.id === "control") return `休息恢复 ${summary.moodRecovery.toFixed(1)}%/小时`;
  return GROWTH_OPTIONS[growthCategory].label;
}

function getAssignmentSkills(operator, room, manufacturingRecipes, growthCategory, team = []) {
  const preferredCategory = room.type === "制造舱" ? manufacturingSkillCategory(room.id, manufacturingRecipes) : null;
  const selectedCategory = room.id === "growth" ? growthCategory : preferredCategory;
  return getOperatorSkillSummary(operator, operator.promotion).map((skill, index) => {
    const sameFacility = skill.facility === room.type;
    const recipeCategories = ["weapon-exp", "operator-exp", "rare-mineral", "vitrified", "fungal"];
    const recipeMatches = !selectedCategory || !recipeCategories.includes(skill.category) || skill.category === selectedCategory;
    const sameClueOwner = skill.category !== "clue-special" || team.find((member) => (member.activeSkills ?? []).some((activeSkill) => (
      activeSkill.category === "clue-special" && activeSkill.clue === skill.clue
    )))?.id === operator.id;
    const applies = Boolean(skill.activeTier && sameFacility && recipeMatches && sameClueOwner);
    const reason = !skill.activeTier
      ? `未解锁 · E${skill.tiers[0].promotion} 解锁`
      : !sameFacility
        ? "当前舱室不生效"
        : !recipeMatches
          ? "当前配方不生效"
          : !sameClueOwner
            ? "同类定向线索效果不可叠加"
          : null;
    return { ...skill, applies, reason, displayIndex: index };
  }).sort((left, right) => Number(right.applies) - Number(left.applies) || left.displayIndex - right.displayIndex);
}

function AssignmentSkills({ operator, room, manufacturingRecipes, growthCategory, team }) {
  return (
    <span className="assignment-skills">
      {getAssignmentSkills(operator, room, manufacturingRecipes, growthCategory, team).map((skill) => (
        <small
          className={`assignment-skill ${skill.applies ? "" : "assignment-skill--inactive"}`}
          data-active={skill.applies}
          key={skill.name}
          title={skill.applies ? skill.name : `${skill.name}：${skill.reason}`}
        >
          <span>{skill.facility}</span>
          <span>{skill.activeTier?.description ?? skill.reason}</span>
        </small>
      ))}
    </span>
  );
}

function formatStartOffset(hours) {
  const minutes = Math.round(hours * 60);
  if (!minutes) return "立即启动";
  const hourPart = Math.floor(minutes / 60);
  const minutePart = minutes % 60;
  return `+${hourPart ? `${hourPart}h` : ""}${minutePart ? `${minutePart}m` : ""} 启动`;
}

function formatStartOffsetLabel(hours) {
  const minutes = Math.round(hours * 60);
  if (!minutes) return "0h";
  const hourPart = Math.floor(minutes / 60);
  const minutePart = minutes % 60;
  return `+${hourPart ? `${hourPart}h` : ""}${minutePart ? `${minutePart}m` : ""}`;
}

function Metric({ label, value, period = "日均", note }) {
  return <div className="metric"><span>{label}</span><div className="metric-value" aria-label={`${value}，${period}`}><strong>{value}</strong><em>{period}</em></div><small>{note}</small></div>;
}

function PageHeading({ index, title, description, backdrop, children }) {
  return (
    <div className="page-heading">
      <div><span className="step-index">{index}</span><span className="heading-copy"><h2>{title}</h2><p>{description}</p></span></div>
      <span className="page-heading__backdrop" aria-hidden="true"><span>{backdrop}</span></span>
      {children}
    </div>
  );
}

function OperatorMark({ operator, muted = false }) {
  const [imageFailed, setImageFailed] = useState(false);
  const symbolIndex = operator.id.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0) % OPERATOR_SYMBOLS.length;
  const Symbol = OPERATOR_SYMBOLS[symbolIndex];
  return (
    <span className={`operator-mark ${muted ? "operator-mark--muted" : ""}`} aria-hidden="true">
      {!imageFailed && <img src={operator.avatar} alt="" loading="lazy" onError={() => setImageFailed(true)} />}
      {imageFailed && <Symbol className="operator-mark__fallback" size={18} weight="bold" />}
    </span>
  );
}

export function App() {
  const sharedConfiguration = useMemo(readSharedConfiguration, []);
  const configRef = useRef(null);
  const resultRef = useRef(null);
  const aboutRef = useRef(null);
  const workerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const utilityNoticeTimerRef = useRef(null);
  const completionTimerRef = useRef(null);
  const dismissTimerRef = useRef(null);
  const navigationTimerRef = useRef(null);
  const exportingRef = useRef(false);
  const [mode, setMode] = useState(sharedConfiguration?.mode ?? "afk");
  const [activeSection, setActiveSection] = useState("config");
  const [selected, setSelected] = useState(sharedConfiguration?.selected ?? INITIAL_SELECTED);
  const [promotions, setPromotions] = useState(() => sharedConfiguration?.promotions ?? Object.fromEntries(OPERATORS.map((operator) => [operator.id, 4])));
  const [operatorSearch, setOperatorSearch] = useState("");
  const [facilityFilter, setFacilityFilter] = useState("all");
  const [manufacturingRecipes, setManufacturingRecipes] = useState(() => sharedConfiguration?.manufacturingRecipes ?? ({ ...DEFAULT_MANUFACTURING_RECIPES }));
  const [growthCategory, setGrowthCategory] = useState(sharedConfiguration?.growthCategory ?? "rare-mineral");
  const [axisScope, setAxisScope] = useState(sharedConfiguration?.axisScope ?? "shared");
  const [loginTimes, setLoginTimes] = useState(sharedConfiguration?.loginTimes ?? ["08:00", "22:30"]);
  const [newTime, setNewTime] = useState("13:00");
  const [calculated, setCalculated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [calculationError, setCalculationError] = useState("");
  const [dailySummary, setDailySummary] = useState(null);
  const [assignments, setAssignments] = useState(emptyAssignments);
  const [shiftAssignments, setShiftAssignments] = useState(() => emptyShiftAssignments(2));
  const [lastResultInputs, setLastResultInputs] = useState(null);
  const [utilityNotice, setUtilityNotice] = useState("");
  const [shareFallback, setShareFallback] = useState("");
  const [exporting, setExporting] = useState(false);

  const filteredOperators = useMemo(() => {
    const query = operatorSearch.trim().toLowerCase();
    return OPERATORS.filter((operator) => {
      const matchesSearch = !query || operator.name.toLowerCase().includes(query) || operator.id.includes(query);
      const matchesFacility = facilityFilter === "all" || operator.skills.some((skill) => skill.facility === facilityFilter);
      return matchesSearch && matchesFacility;
    });
  }, [facilityFilter, operatorSearch]);

  const canCalculate = selected.length >= 3 && (mode === "afk" || loginTimes.length > 0);
  const allOperatorsSelected = selected.length === OPERATORS.length;
  const calculationHint = calculationError || (!canCalculate
    ? (selected.length < 3 ? "至少选择 3 名干员" : "至少添加 1 个上线时间")
    : mode === "afk" ? `将自动搜索${AXIS_SCOPES[axisScope].label}` : "条件已就绪，可以生成排班");
  const resultMode = lastResultInputs?.mode ?? mode;
  const resultManufacturingRecipes = lastResultInputs?.manufacturingRecipes ?? manufacturingRecipes;
  const resultGrowthCategory = lastResultInputs?.growthCategory ?? growthCategory;
  const resultLoginTimes = lastResultInputs?.loginTimes ?? loginTimes;
  const resultAxisScope = lastResultInputs?.axisScope ?? axisScope;

  useEffect(() => () => {
    stopCalculation();
    window.clearTimeout(navigationTimerRef.current);
    if (utilityNoticeTimerRef.current) window.clearTimeout(utilityNoticeTimerRef.current);
  }, []);

  useEffect(() => {
    if (sharedConfiguration) showUtilityNotice(`已载入分享配置 · ${sharedConfiguration.selected.length} 名干员`);
  }, [sharedConfiguration]);

  function stopCalculation() {
    workerRef.current?.terminate();
    workerRef.current = null;
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;
    window.clearTimeout(completionTimerRef.current);
    window.clearTimeout(dismissTimerRef.current);
    completionTimerRef.current = null;
    dismissTimerRef.current = null;
  }
  function showUtilityNotice(message) {
    setUtilityNotice(message);
    if (utilityNoticeTimerRef.current) window.clearTimeout(utilityNoticeTimerRef.current);
    utilityNoticeTimerRef.current = window.setTimeout(() => setUtilityNotice(""), 2600);
  }
  function invalidate() {
    setCalculationError("");
    setShareFallback("");
    if (workerRef.current || completionTimerRef.current || dismissTimerRef.current) {
      stopCalculation();
      setBusy(false);
      setProgress(0);
    }
  }
  function toggleAllOperators() {
    setSelected(allOperatorsSelected ? [] : OPERATORS.map((operator) => operator.id));
    invalidate();
  }
  function toggleOperator(id) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    invalidate();
  }
  function setPromotion(id, value) {
    setPromotions((current) => ({ ...current, [id]: Number(value) }));
    invalidate();
  }
  function setManufacturingRecipe(roomId, recipeId) {
    setManufacturingRecipes((current) => ({ ...current, [roomId]: recipeId }));
    invalidate();
  }
  function addTime() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/u.test(newTime)) { showUtilityNotice("请输入有效的上线时间"); return; }
    if (loginTimes.includes(newTime)) { showUtilityNotice("该上线时间已添加"); return; }
    setLoginTimes((current) => [...current, newTime].sort());
    invalidate();
  }
  async function copyConfigurationLink() {
    const url = buildConfigurationShareUrl({ mode, selected, promotions, manufacturingRecipes, growthCategory, axisScope, loginTimes });
    try {
      await copyText(url);
      setShareFallback("");
      showUtilityNotice(`配置链接已复制 · ${selected.length} 名干员`);
    } catch {
      setShareFallback(url);
      showUtilityNotice("自动复制未获允许，请复制下方配置链接");
    }
  }
  async function exportResultImage() {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    try {
      const rows = RESULT_ROOM_META.flatMap((room) => {
        const roomOperators = assignments[room.id] ?? [];
        const roomSummary = dailySummary.rooms[room.id];
        const memberData = (operator, team) => ({
          name: operator.name,
          avatar: operator.avatar,
          skills: getAssignmentSkills(
            operator,
            room,
            resultManufacturingRecipes,
            resultGrowthCategory,
            team,
          ).map((skill) => ({
            facility: skill.facility,
            description: skill.activeTier?.description ?? skill.reason,
            active: skill.applies,
          })),
        });
        const stat = room.id === "control"
          ? ""
          : `产效 ${(roomSummary.averageFactor * 100).toFixed(0)}% · 覆盖 ${(roomSummary.coverageRate * 100).toFixed(0)}%`;
        const groups = resultMode === "afk"
          ? roomOperators.map((operator, operatorIndex) => ({
            offset: dailySummary.startup.offsetsByRoom[room.id]?.[operatorIndex] ?? 0,
            members: [memberData(operator, roomOperators)],
          })).sort((left, right) => left.offset - right.offset).map((group) => ({
            label: `T ${formatStartOffsetLabel(group.offset)}`,
            members: group.members,
          }))
          : (shiftAssignments[room.id] ?? []).map((team, shiftIndex) => ({
            label: `班次 ${String(shiftIndex + 1).padStart(2, "0")} · ${resultLoginTimes[shiftIndex]}`,
            members: team.map((operator) => memberData(operator, team)),
          }));
        const chunks = [];
        for (let index = 0; index < groups.length || index === 0; index += 4) chunks.push(groups.slice(index, index + 4));
        return chunks.map((groupChunk, chunkIndex) => ({
          name: chunkIndex ? `${room.name} · 续` : room.name,
          meta: getRoomRecipe(room, resultManufacturingRecipes, resultGrowthCategory, dailySummary),
          stat,
          groups: groupChunk,
        }));
      });
      await downloadResultCard({
        mode: resultMode,
        summary: dailySummary,
        growthLabel: GROWTH_OPTIONS[resultGrowthCategory].label,
        rows,
      });
      showUtilityNotice("排班图已生成");
    } catch {
      showUtilityNotice("排班图生成失败，请重试");
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }
  function calculate() {
    if (!canCalculate) return;
    stopCalculation();
    setBusy(true);
    setCalculationError("");
    setProgress(2);
    const calculationRequest = {
      mode,
      rooms: ROOM_META,
      selected: [...selected],
      promotions: { ...promotions },
      manufacturingRecipes: { ...manufacturingRecipes },
      growthCategory,
      loginTimes: [...loginTimes],
      axisScope,
    };
    let worker;
    try {
      worker = new Worker(new URL("./calculation.worker.js", import.meta.url), { type: "module" });
    } catch {
      setBusy(false);
      setProgress(0);
      setCalculationError("无法启动计算，请刷新页面后重试");
      return;
    }
    workerRef.current = worker;
    const startedAt = performance.now();
    const expectedDuration = calculationRequest.mode === "shift" ? 1200 : calculationRequest.axisScope === "facility" ? 33000 : 13000;
    progressTimerRef.current = window.setInterval(() => {
      const elapsedFraction = (performance.now() - startedAt) / expectedDuration;
      setProgress((current) => Math.max(current, Math.min(92, 4 + (elapsedFraction * 86))));
    }, 120);
    worker.onmessage = ({ data }) => {
      if (workerRef.current !== worker) return;
      if (data.type === "progress") {
        setProgress((current) => Math.max(current, data.value));
        return;
      }
      if (data.type !== "result") return;
      stopCalculation();
      setAssignments(data.assignments);
      setShiftAssignments(data.shiftAssignments);
      setDailySummary(data.summary);
      setLastResultInputs({
        mode: calculationRequest.mode,
        manufacturingRecipes: calculationRequest.manufacturingRecipes,
        growthCategory: calculationRequest.growthCategory,
        loginTimes: calculationRequest.loginTimes,
        axisScope: calculationRequest.axisScope,
      });
      setCalculated(true);
      setProgress(100);
      completionTimerRef.current = window.setTimeout(() => {
        completionTimerRef.current = null;
        setBusy(false); setActiveSection("result");
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.clearTimeout(navigationTimerRef.current);
        navigationTimerRef.current = window.setTimeout(() => resultRef.current?.focus({ preventScroll: true }), 350);
      }, 120);
      dismissTimerRef.current = window.setTimeout(() => { dismissTimerRef.current = null; setProgress(0); }, 650);
    };
    worker.onerror = () => {
      if (workerRef.current !== worker) return;
      stopCalculation();
      setBusy(false);
      setProgress(0);
      setCalculationError("计算未完成，请重试");
    };
    worker.onmessageerror = worker.onerror;
    try { worker.postMessage(calculationRequest); } catch { worker.onerror(); }
  }
  function goToSection(section, targetRef) {
    if (section === "result" && !calculated) return;
    setActiveSection(section); window.scrollTo({ top: 0, behavior: "smooth" });
    window.clearTimeout(completionTimerRef.current);
    window.clearTimeout(navigationTimerRef.current);
    if (!workerRef.current) setBusy(false);
    navigationTimerRef.current = window.setTimeout(() => targetRef.current?.focus({ preventScroll: true }), 350);
  }
  return (
    <main className="app-shell">
      <aside className="step-rail" aria-label="计算步骤">
        <div className="brand-mark" aria-label="帝江排班计算器"><Calculator size={23} weight="fill" /></div>
        <div className="rail-steps">
          <button className={`rail-step ${activeSection === "config" ? "rail-step--active" : ""}`} aria-current={activeSection === "config" ? "step" : undefined} aria-label="配置计算参数" onClick={() => goToSection("config", configRef)}><SlidersHorizontal size={21} weight="bold" /><span>配置</span></button>
          <button className={`rail-step ${activeSection === "result" ? "rail-step--active" : ""}`} aria-current={activeSection === "result" ? "step" : undefined} aria-label="查看计算结果" onClick={() => goToSection("result", resultRef)} disabled={!calculated} title={calculated ? "查看上次计算结果" : "完成计算后查看结果"}><ChartLineUp size={21} weight="bold" /><span>结果</span></button>
          <button className={`rail-step ${activeSection === "about" ? "rail-step--active" : ""}`} aria-current={activeSection === "about" ? "step" : undefined} aria-label="查看项目说明" onClick={() => goToSection("about", aboutRef)}><Info size={21} weight="bold" /><span>关于</span></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-title"><h1>帝江排班计算器</h1><p className="eyebrow">// DIJIANG / SHIFT CALCULATOR</p></div>
        </header>
        <div className="calculator-layout">
          {activeSection === "config" && (
          <section className="config-panel page-enter" ref={configRef} tabIndex={-1}>
            <PageHeading index="01" title="基建配置" description="选择策略、产出与干员" backdrop="CONFIGURATION">
              <div className="page-heading__actions">
                <button className="page-heading__action page-heading__action--secondary" onClick={copyConfigurationLink}><LinkSimple size={20} weight="bold" />复制配置链接</button>
                <button className="page-heading__action page-heading__action--forward" onClick={calculate} aria-describedby={!canCalculate || calculationError ? "calculation-hint" : undefined} disabled={busy || !canCalculate} title={calculationHint} aria-label={`生成排班结果。${calculationHint}`}><Calculator size={21} weight="fill" />{busy ? (mode === "afk" ? "正在搜索启动轴…" : "正在计算…") : "生成排班结果"}{!busy && <ArrowRight size={20} weight="bold" />}</button>
              </div>
            </PageHeading>

            {(!canCalculate || calculationError) && <p id="calculation-hint" className="calculation-hint" role={calculationError ? "alert" : "status"}>{calculationHint}</p>}
            {busy && <p className="calculation-hint" role="status">正在计算，修改配置会取消本次计算。</p>}
            {shareFallback && <label className="share-fallback">手动复制配置链接<input aria-label="配置分享链接" readOnly value={shareFallback} onFocus={(event) => event.target.select()} /></label>}
            <div className="config-workbench">
              <div className="config-controls">
                <fieldset className="field-group">
                  <legend>排班策略</legend>
                  <div className="mode-switch">
                    <button aria-pressed={mode === "afk"} className={mode === "afk" ? "is-active" : ""} onClick={() => { setMode("afk"); invalidate(); }}><ArrowsClockwise size={19} weight="bold" /><span><strong>挂机方案</strong><small>长期平均收益</small></span></button>
                    <button aria-pressed={mode === "shift"} className={mode === "shift" ? "is-active" : ""} onClick={() => { setMode("shift"); invalidate(); }}><ClockCounterClockwise size={19} weight="bold" /><span><strong>定点倒班</strong><small>按上线时间换人</small></span></button>
                  </div>
                </fieldset>
                <fieldset className="field-group">
                  <legend>制造舱Ⅰ</legend>
                  <div className="select-wrap"><select aria-label="制造舱Ⅰ生产配方" value={manufacturingRecipes["manufacture-a"]} onChange={(event) => setManufacturingRecipe("manufacture-a", event.target.value)}>{Object.entries(MANUFACTURING_RECIPES).map(([value, option]) => <option value={value} key={value}>{option.label}</option>)}</select><CaretDown size={17} weight="bold" /></div>
                </fieldset>
                <fieldset className="field-group">
                  <legend>制造舱Ⅱ</legend>
                  <div className="select-wrap"><select aria-label="制造舱Ⅱ生产配方" value={manufacturingRecipes["manufacture-b"]} onChange={(event) => setManufacturingRecipe("manufacture-b", event.target.value)}>{Object.entries(MANUFACTURING_RECIPES).map(([value, option]) => <option value={value} key={value}>{option.label}</option>)}</select><CaretDown size={17} weight="bold" /></div>
                </fieldset>
                <fieldset className="field-group">
                  <legend>培养舱Ⅰ</legend>
                  <div className="select-wrap"><select aria-label="培养对象" value={growthCategory} onChange={(event) => { setGrowthCategory(event.target.value); invalidate(); }}>{Object.entries(GROWTH_OPTIONS).map(([value, option]) => <option value={value} key={value}>{option.label}</option>)}</select><CaretDown size={17} weight="bold" /></div>
                </fieldset>
                {mode === "afk" && (
                  <fieldset className="field-group field-group--cadence">
                    <legend>启动轴求解范围</legend>
                    <div className="cadence-switch">
                      <button aria-pressed={axisScope === "shared"} className={axisScope === "shared" ? "is-active" : ""} onClick={() => { setAxisScope("shared"); invalidate(); }}>
                        <span><strong>统一启动轴</strong><small>所有设施使用同一组时间，容易照着执行</small></span><em>简洁</em>
                      </button>
                      <button aria-pressed={axisScope === "facility"} className={axisScope === "facility" ? "is-active" : ""} onClick={() => { setAxisScope("facility"); invalidate(); }}>
                        <span><strong>分设施启动轴</strong><small>每个设施分别搜索，优先长期产出</small></span><em>精细</em>
                      </button>
                    </div>
                  </fieldset>
                )}
                {mode === "shift" && (
                  <fieldset className="field-group field-group--times">
                    <legend>每日上线时间</legend>
                    <div className="time-list">{loginTimes.map((time) => <span className="time-chip" key={time}>{time}<button aria-label={`移除 ${time}`} onClick={() => { setLoginTimes((current) => current.filter((item) => item !== time)); invalidate(); }}><Trash size={14} weight="bold" /></button></span>)}</div>
                    <div className="time-add"><input aria-label="新增上线时间" type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} /><button onClick={addTime}><Plus size={16} weight="bold" />添加</button></div>
                  </fieldset>
                )}
              </div>

              <fieldset className="field-group field-group--operators">
                <legend><span>参与计算的干员</span><small>默认 E4 · 可逐人调整练度</small></legend>
                <div className="operator-toolbar">
                  <label className="operator-search"><MagnifyingGlass size={17} weight="bold" /><input aria-label="搜索干员" value={operatorSearch} onChange={(event) => setOperatorSearch(event.target.value)} placeholder="搜索干员" /></label>
                  <label className="operator-filter"><span>设施</span><select value={facilityFilter} onChange={(event) => setFacilityFilter(event.target.value)}><option value="all">全部设施</option>{FACILITIES.map((facility) => <option value={facility} key={facility}>{facility}</option>)}</select></label>
                  <span className="selection-count operator-selection-count">已选 {selected.length}/{OPERATORS.length}</span>
                  <button className={`select-all-button ${allOperatorsSelected ? "is-active" : ""}`} aria-pressed={allOperatorsSelected} onClick={toggleAllOperators}>{allOperatorsSelected ? "全不选" : `全选 ${OPERATORS.length}`}</button>
                </div>
                <div className="operator-list">
                  {filteredOperators.map((operator) => {
                    const active = selected.includes(operator.id);
                    const promotion = promotions[operator.id] ?? 4;
                    const skillSummary = getOperatorSkillSummary(operator, promotion);
                    return (
                      <article className={`operator-card ${active ? "is-selected" : ""}`} key={operator.id}>
                        <button className="operator-toggle" onClick={() => toggleOperator(operator.id)} aria-pressed={active} aria-label={`${active ? "排除" : "选择"}${operator.name}`}>
                          <OperatorMark operator={operator} muted={!active} />
                          <span className="operator-copy"><span><strong>{operator.name}</strong><small className="rarity">{operator.rarity}★</small></span><small>{active ? "参与计算" : "未拥有 / 不参与"}</small></span>
                          <span className="check-box">{active && <Check size={14} weight="bold" />}</span>
                        </button>
                        <label className="promotion-control"><span>练度</span><select value={promotion} onChange={(event) => setPromotion(operator.id, event.target.value)} aria-label={`${operator.name}练度`}>{[0, 1, 2, 3, 4].map((level) => <option value={level} key={level}>E{level}</option>)}</select></label>
                        <div className="skill-chips">
                          {skillSummary.length ? skillSummary.map((skill) => <span className={`skill-chip ${skill.activeTier ? "" : "skill-chip--locked"}`} key={skill.name} title={skill.name}><strong>{skill.facility}</strong><small>{skill.activeTier?.description ?? `E${skill.tiers[0].promotion} 解锁`}</small></span>) : <span className="skill-chip skill-chip--pending"><strong>资料待确认</strong><small>暂不参与技能匹配</small></span>}
                        </div>
                      </article>
                    );
                  })}
                  {!filteredOperators.length && <div className="operator-empty">没有符合当前筛选条件的干员</div>}
                </div>
              </fieldset>
            </div>

          </section>
          )}

          {activeSection === "result" && calculated && (
          <section className="result-panel page-enter" aria-live="polite" ref={resultRef} tabIndex={-1}>
            <PageHeading index="02" title="计算结果" description={resultMode === "afk" ? "长期挂机推荐" : "固定上线倒班推荐"} backdrop="RESULT">
              <div className="page-heading__actions">
                <button className="page-heading__action page-heading__action--secondary" onClick={exportResultImage} disabled={exporting} aria-busy={exporting}><DownloadSimple size={20} weight="bold" />{exporting ? "正在生成排班图…" : "导出排班图"}</button>
                <button className="page-heading__action page-heading__action--back" onClick={() => goToSection("config", configRef)}><ArrowLeft size={20} weight="bold" />修改配置</button>
              </div>
            </PageHeading>
            <div className="metric-row">
              <Metric label="高级认知载体" value={dailySummary.cognitive.toFixed(1)} note="制造舱 · 最高等级 · 实际在岗折算" />
              <Metric label="高级作战记录" value={dailySummary.operator.toFixed(1)} note="制造舱 · 最高等级 · 实际在岗折算" />
              <Metric label="武器检查套组" value={dailySummary.weapon.toFixed(1)} note="制造舱 · 最高等级 · 实际在岗折算" />
              <Metric label={`${GROWTH_OPTIONS[resultGrowthCategory].label}培养`} value={dailySummary.growth.toFixed(2)} note="培养舱 · 最高等级 · 9 箱 / 61h06m40s" />
              <Metric label="预计线索搜集" value={dailySummary.clues.toFixed(2)} note="会客室 · 按 72 小时基础周期估算" />
            </div>
            <div className="operation-strip" aria-label="排班运行指标">
              <div><span>平均产效</span><strong>{(dailySummary.averageEfficiency * 100).toFixed(0)}%</strong><small>生产设施等权平均</small></div>
              <div><span>平均在岗</span><strong>{dailySummary.averageActive.toFixed(2)} / 3</strong><small>生产设施长期均值</small></div>
              <div><span>设施覆盖</span><strong>{(dailySummary.averageCoverage * 100).toFixed(1)}%</strong><small>至少一人在岗的时间</small></div>
              <div><span>平均停产</span><strong>{dailySummary.averageDowntime.toFixed(2)}h</strong><small>每设施每日</small></div>
            </div>
            <section className="timeline-section">
              <div className="section-label-row"><div><span>ASSIGNMENT PLAN</span><h3>{resultMode === "afk" ? "算法推荐启动轴" : "按上线节点进行整组换班"}</h3></div><span className="mode-badge">{resultMode === "afk" ? AXIS_SCOPES[resultAxisScope].shortLabel : `每日 ${resultLoginTimes.length} 次`}</span></div>
              <div className={`assignment-board ${resultMode === "shift" ? "assignment-board--shifts" : "assignment-board--afk"}`}>
                {RESULT_ROOM_META.map((room, roomIndex) => {
                  const roomOperators = assignments[room.id];
                  const roomSummary = dailySummary.rooms[room.id];
                  const startOffsets = resultMode === "afk" ? (dailySummary.startup.offsetsByRoom[room.id] ?? []) : [];
                  const scheduledOperators = roomOperators
                    .map((operator, operatorIndex) => ({ operator, startOffset: startOffsets[operatorIndex] ?? 0, operatorIndex }))
                    .sort((left, right) => left.startOffset - right.startOffset || left.operatorIndex - right.operatorIndex);
                  return (
                    <article className="facility-lane" key={room.id}>
                      <div className="facility-name"><Factory size={22} weight="fill" /><span><strong>{room.name}</strong><small>{getRoomRecipe(room, resultManufacturingRecipes, resultGrowthCategory, dailySummary)}</small>{room.id !== "control" && <em>产效 {(roomSummary.averageFactor * 100).toFixed(0)}% · 覆盖 {(roomSummary.coverageRate * 100).toFixed(0)}%</em>}</span></div>
                      {resultMode === "afk" ? (
                        <div className="lane-assignments">{scheduledOperators.length ? scheduledOperators.map(({ operator, startOffset }, index) => <div className="assignment-slot" key={operator.id}><div className="assignment-time" aria-label={formatStartOffset(startOffset)} title={formatStartOffset(startOffset)}>{formatStartOffsetLabel(startOffset)}</div><div className="assignment-cell" style={{ "--delay": `${index * 55 + roomIndex * 35}ms` }}><OperatorMark operator={operator} /><span><strong>{operator.name}</strong><AssignmentSkills operator={operator} room={room} manufacturingRecipes={resultManufacturingRecipes} growthCategory={resultGrowthCategory} team={roomOperators} /></span></div></div>) : <div className="empty-lane">当前干员数量不足</div>}</div>
                      ) : (
                        <div className="lane-assignments lane-assignments--shifts" style={{ "--shift-count": resultLoginTimes.length }}>
                          {(shiftAssignments[room.id] ?? []).map((shiftOperators, shiftIndex) => <section className="shift-block" key={`${room.id}-${resultLoginTimes[shiftIndex]}`}><header className="shift-block__header"><span>班次 {String(shiftIndex + 1).padStart(2, "0")}</span><strong>{resultLoginTimes[shiftIndex]}</strong></header><div className="shift-operators">{shiftOperators.length ? shiftOperators.map((operator, index) => <div className="assignment-cell assignment-cell--compact" key={`${operator.id}-${shiftIndex}`} style={{ "--delay": `${index * 45 + shiftIndex * 80 + roomIndex * 35}ms` }}><OperatorMark operator={operator} /><span><strong>{operator.name}</strong><AssignmentSkills operator={operator} room={room} manufacturingRecipes={resultManufacturingRecipes} growthCategory={resultGrowthCategory} team={shiftOperators} /></span></div>) : <div className="empty-lane">本班保留空位</div>}</div></section>)}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          </section>
          )}

          {activeSection === "about" && (
          <section className="about-panel page-enter" ref={aboutRef} tabIndex={-1}>
            <header className="about-header">
              <div className="about-title"><Info size={28} weight="fill" /><span><p>ABOUT / METHOD</p><h2>关于本项目</h2></span></div>
              <a className="about-repo-link" href={REPOSITORY_URL} target="_blank" rel="noreferrer"><GithubLogo size={20} weight="fill" />查看 GitHub 仓库<ArrowSquareOut size={16} weight="bold" /></a>
            </header>

            <div className="about-intro">
              <p>帝江排班计算器根据手动选择的干员、练度与生产目标，比较长期挂机和定点倒班的稳定周期收益，并给出可直接照做的排班。计算允许出现停产；只有停产后的长期日产量确实更高时，才会采用该方案。</p>
            </div>

            <div className="about-grid">
              <section className="about-section">
                <span className="about-section__code">MODE</span>
                <h3>两种排班模式</h3>
                <dl className="about-definitions">
                  <div><dt>挂机方案</dt><dd>从满心情开始，干员心情归零后自动下班，恢复满后自动返岗；算法搜索错峰进驻时间，以长期日产量选择启动轴。</dd></div>
                  <div><dt>定点倒班</dt><dd>每个上线时间都是一次整组换班；干员心情跨班次、跨天连续继承，不会在接班时重置为满值。</dd></div>
                </dl>
              </section>

              <section className="about-section">
                <span className="about-section__code">STATE</span>
                <h3>心情与技能</h3>
                <dl className="about-definitions">
                  <div><dt>工作消耗</dt><dd>基础为每小时 7% 心情；舱室减耗技能作用于整个舱室。挂机时总控外不会混用减耗与普通干员，避免自动轮换乱轴。</dd></div>
                  <div><dt>休息恢复</dt><dd>基础为每小时 12%，再乘总控中枢心情恢复技能加成。未计好友助力和手动补心情。</dd></div>
                  <div><dt>练度</dt><dd>E0–E4 决定两个基建技能槽的解锁与升级；没有匹配技能的干员仍可提供通用进驻加成。</dd></div>
                </dl>
              </section>

              <section className="about-section about-section--wide">
                <span className="about-section__code">SOLVER</span>
                <h3>大致算法</h3>
                <ol className="solver-steps">
                  <li><span>01</span><div><strong>建立状态</strong><p>根据练度解析技能，为五个舱室生成候选组合，并固定两个制造配方与一个培养质料类型。</p></div></li>
                  <li><span>02</span><div><strong>模拟运行</strong><p>逐时间片追踪在岗人数、心情消耗、休息恢复、自动下班与返岗；定点倒班则按用户输入的上线节点整组替换。</p></div></li>
                  <li><span>03</span><div><strong>搜索启动轴</strong><p>挂机模式枚举 30 分钟网格，经过 180 日预热后再取 90 日稳定周期平均；覆盖率只在产量相同时用于比较。</p></div></li>
                  <li><span>04</span><div><strong>比较产出</strong><p>每个生产时间片按（1 + 40% × 在岗人数）×（1 + 当前配方适用技能合计）计算，并将停产时间计入最终日产量。</p></div></li>
                </ol>
              </section>

              <section className="about-section">
                <span className="about-section__code">OUTPUT</span>
                <h3>产量口径</h3>
                <ul className="about-list">
                  <li>制造舱按既有产品耗时折算单份等效产量，未模拟载荷队列和批次收获；耗时的基础效率与批量口径仍需游戏内对照。</li>
                  <li>培养舱固定一种质料类别，以 9 箱、单箱 61 小时 6 分 40 秒折算；同类内其他耗时的材料不适用此数量估计。</li>
                  <li>跨舱室使用等权标准化产效比较，最终仍分别展示制造、培养和线索结果，不混成一种资源总量。</li>
                </ul>
              </section>

              <section className="about-section">
                <span className="about-section__code">LIMIT</span>
                <h3>数据与边界</h3>
                <ul className="about-list">
                  <li>当前收录 30 名具有可确认基建信息的干员；管理员不参与分配。</li>
                  <li>线索数量按 72 小时基础周期估算，该常量仍待独立核验。定向技能只作 L1 / L2 倾向，不额外增加总量。</li>
                  <li>工具不会读取或控制游戏；游戏机制与数值更新后，结果需随数据版本重新校验。</li>
                </ul>
                <div className="about-links"><a href={REPOSITORY_URL} target="_blank" rel="noreferrer">源代码<ArrowSquareOut size={14} weight="bold" /></a><a href={`${REPOSITORY_URL}/issues`} target="_blank" rel="noreferrer">问题与建议<ArrowSquareOut size={14} weight="bold" /></a></div>
              </section>
            </div>
          </section>
          )}
        </div>
      </section>
      {(busy || progress > 0) && (
        <div
          className="calculation-progress"
          role="progressbar"
          aria-label="排班计算进度"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(progress)}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
      {utilityNotice && <div className="utility-toast" role="status"><Info size={17} weight="fill" />{utilityNotice}</div>}
    </main>
  );
}
