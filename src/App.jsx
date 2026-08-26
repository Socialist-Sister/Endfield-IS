import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, ArrowsClockwise, Calculator, CaretDown, ChartLineUp, Check,
  ClockCounterClockwise, Crosshair, Cube, Diamond, DotsNine, Factory, Hexagon,
  MagnifyingGlass, Plus, ShieldCheck, SlidersHorizontal, Square, Star, Target, Trash,
  Triangle, UsersThree,
} from "@phosphor-icons/react";
import { FACILITIES, OPERATORS, getOperatorSkillSummary } from "./operatorData.js";
import { AXIS_SCOPES } from "./scheduleModel.js";

const INITIAL_SELECTED = [];
const OPERATOR_SYMBOLS = [Diamond, Hexagon, Triangle, Square, Star, Crosshair, DotsNine, Cube, Target];
const ROOM_META = [
  { id: "manufacture-a", name: "制造舱 01", type: "制造舱", recipe: "武器经验材料" },
  { id: "manufacture-b", name: "制造舱 02", type: "制造舱", recipe: "干员经验材料" },
  { id: "growth", name: "培养舱", type: "培养舱", recipe: "质料培养" },
  { id: "reception", name: "会客室", type: "会客室", recipe: "线索收集" },
  { id: "control", name: "总控中枢", type: "总控中枢", recipe: "全局恢复" },
];
const GROWTH_OPTIONS = {
  "rare-mineral": { label: "矿物质料" },
  vitrified: { label: "晶植质料" },
  fungal: { label: "菌类质料" },
};
const emptyAssignments = () => Object.fromEntries(ROOM_META.map((room) => [room.id, []]));
const emptyShiftAssignments = (shiftCount) => Object.fromEntries(ROOM_META.map((room) => [room.id, Array.from({ length: shiftCount }, () => [])]));
function preferredManufacturingCategory(roomId, priority) {
  if (priority === "weapon-exp") return "weapon-exp";
  if (priority === "operator-exp") return "operator-exp";
  return roomId === "manufacture-a" ? "weapon-exp" : "operator-exp";
}

function hasMoodReduction(operator) {
  return operator.activeSkills.some((skill) => skill.category === "mood-drop");
}

function getRoomRecipe(room, priority, growthCategory, summary) {
  if (room.type === "制造舱") {
    return preferredManufacturingCategory(room.id, priority) === "weapon-exp" ? "高级武器套组" : "高级作战记录";
  }
  if (room.id === "reception") return `预计 ${summary.clues.toFixed(2)} 线索/日`;
  if (room.id === "control") return `休息恢复 ${summary.moodRecovery.toFixed(1)}%/小时`;
  return GROWTH_OPTIONS[growthCategory].label;
}

function getMoodGroupLabel(team, room) {
  if (room.id === "control" || !team.length) return null;
  const moodOperators = team.filter(hasMoodReduction).length;
  return moodOperators ? `${moodOperators}/${team.length} 减耗组` : "无减耗组";
}

function getAssignmentSkills(operator, room, priority, growthCategory, team = []) {
  const preferredCategory = room.type === "制造舱" ? preferredManufacturingCategory(room.id, priority) : null;
  const selectedCategory = room.id === "growth" ? growthCategory : preferredCategory;
  return getOperatorSkillSummary(operator, operator.promotion).map((skill, index) => {
    const sameFacility = skill.facility === room.type;
    const recipeCategories = ["weapon-exp", "operator-exp", "rare-mineral", "vitrified", "fungal"];
    const recipeMatches = !selectedCategory || !recipeCategories.includes(skill.category) || skill.category === selectedCategory;
    const sameClueOwner = skill.category !== "clue-special" || team.find((member) => member.activeSkills.some((activeSkill) => (
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

function AssignmentSkills({ operator, room, priority, growthCategory, team }) {
  return (
    <span className="assignment-skills">
      {getAssignmentSkills(operator, room, priority, growthCategory, team).map((skill) => (
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

function Metric({ label, value, note }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
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
  const configRef = useRef(null);
  const resultRef = useRef(null);
  const workerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const [mode, setMode] = useState("afk");
  const [activeSection, setActiveSection] = useState("config");
  const [selected, setSelected] = useState(INITIAL_SELECTED);
  const [promotions, setPromotions] = useState(() => Object.fromEntries(OPERATORS.map((operator) => [operator.id, 4])));
  const [operatorSearch, setOperatorSearch] = useState("");
  const [facilityFilter, setFacilityFilter] = useState("all");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [priority, setPriority] = useState("balanced");
  const [growthCategory, setGrowthCategory] = useState("vitrified");
  const [axisScope, setAxisScope] = useState("shared");
  const [loginTimes, setLoginTimes] = useState(["08:00", "22:30"]);
  const [newTime, setNewTime] = useState("13:00");
  const [calculated, setCalculated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [calculationError, setCalculationError] = useState("");
  const [dailySummary, setDailySummary] = useState(null);
  const [assignments, setAssignments] = useState(emptyAssignments);
  const [shiftAssignments, setShiftAssignments] = useState(() => emptyShiftAssignments(2));

  const filteredOperators = useMemo(() => {
    const query = operatorSearch.trim().toLowerCase();
    return OPERATORS.filter((operator) => {
      const matchesSearch = !query || operator.name.toLowerCase().includes(query) || operator.id.includes(query);
      const matchesFacility = facilityFilter === "all" || operator.skills.some((skill) => skill.facility === facilityFilter);
      return matchesSearch && matchesFacility && (!ownedOnly || selected.includes(operator.id));
    });
  }, [facilityFilter, operatorSearch, ownedOnly, selected]);

  const canCalculate = selected.length >= 3 && (mode === "afk" || loginTimes.length > 0);
  const allOperatorsSelected = selected.length === OPERATORS.length;

  useEffect(() => () => {
    workerRef.current?.terminate();
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
  }, []);

  function stopCalculation() {
    workerRef.current?.terminate();
    workerRef.current = null;
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;
  }
  function invalidate() {
    setCalculated(false);
    setCalculationError("");
    if (workerRef.current) {
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
  function addTime() {
    if (!newTime || loginTimes.includes(newTime)) return;
    setLoginTimes((current) => [...current, newTime].sort());
    invalidate();
  }
  function calculate() {
    stopCalculation();
    setBusy(true);
    setCalculationError("");
    setProgress(2);
    const worker = new Worker(new URL("./calculation.worker.js", import.meta.url), { type: "module" });
    workerRef.current = worker;
    const startedAt = performance.now();
    const expectedDuration = mode === "shift" ? 1200 : axisScope === "facility" ? 33000 : 13000;
    progressTimerRef.current = window.setInterval(() => {
      const elapsedFraction = (performance.now() - startedAt) / expectedDuration;
      setProgress((current) => Math.max(current, Math.min(92, 4 + (elapsedFraction * 86))));
    }, 120);
    worker.onmessage = ({ data }) => {
      if (data.type === "progress") {
        setProgress((current) => Math.max(current, data.value));
        return;
      }
      if (data.type !== "result") return;
      stopCalculation();
      setAssignments(data.assignments);
      setShiftAssignments(data.shiftAssignments);
      setDailySummary(data.summary);
      setProgress(100);
      window.setTimeout(() => {
        setBusy(false); setCalculated(true); setActiveSection("result");
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.setTimeout(() => resultRef.current?.focus({ preventScroll: true }), 350);
      }, 120);
      window.setTimeout(() => setProgress(0), 650);
    };
    worker.onerror = () => {
      stopCalculation();
      setBusy(false);
      setProgress(0);
      setCalculationError("计算未完成，请重试");
    };
    worker.postMessage({
      mode,
      rooms: ROOM_META,
      selected,
      promotions,
      priority,
      growthCategory,
      loginTimes,
      axisScope,
    });
  }
  function goToSection(section, targetRef) {
    if (section === "result" && !calculated) return;
    setActiveSection(section); window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => targetRef.current?.focus({ preventScroll: true }), 350);
  }
  return (
    <main className="app-shell">
      <aside className="step-rail" aria-label="计算步骤">
        <div className="brand-mark" aria-label="帝江排班计算器"><Calculator size={23} weight="fill" /></div>
        <div className="rail-steps">
          <button className={`rail-step ${activeSection === "config" ? "rail-step--active" : ""}`} aria-label="配置计算参数" onClick={() => goToSection("config", configRef)}><SlidersHorizontal size={21} weight="bold" /><span>配置</span></button>
          <button className={`rail-step ${activeSection === "result" ? "rail-step--active" : ""}`} aria-label="查看计算结果" onClick={() => goToSection("result", resultRef)} disabled={!calculated} title={calculated ? "查看上次计算结果" : "完成计算后查看结果"}><ChartLineUp size={21} weight="bold" /><span>结果</span></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-title"><p className="eyebrow">// DIJIANG / SHIFT CALCULATOR</p><h1>帝江排班计算器</h1></div>
        </header>
        <div className="calculator-layout">
          {activeSection === "config" && (
          <section className="config-panel page-enter" ref={configRef} tabIndex={-1}>
            <div className="panel-heading">
              <div><span className="step-index">01</span><span className="heading-copy"><h2>设置计算条件</h2><p>选择策略、产出方向与参与计算的干员</p></span></div>
              <span className="selection-count">已选 {selected.length}/{OPERATORS.length}</span>
            </div>

            <div className="config-workbench">
              <div className="config-controls">
                <fieldset className="field-group">
                  <legend>排班策略</legend>
                  <div className="mode-switch">
                    <button className={mode === "afk" ? "is-active" : ""} onClick={() => { setMode("afk"); invalidate(); }}><ArrowsClockwise size={19} weight="bold" /><span><strong>挂机方案</strong><small>长期平均收益</small></span></button>
                    <button className={mode === "shift" ? "is-active" : ""} onClick={() => { setMode("shift"); invalidate(); }}><ClockCounterClockwise size={19} weight="bold" /><span><strong>定点倒班</strong><small>按上线时间换人</small></span></button>
                  </div>
                </fieldset>
                <fieldset className="field-group">
                  <legend>生产优先级</legend>
                  <div className="select-wrap"><select aria-label="生产优先级" value={priority} onChange={(event) => { setPriority(event.target.value); invalidate(); }}><option value="balanced">综合产出均衡</option><option value="weapon-exp">武器经验优先</option><option value="operator-exp">干员经验优先</option></select><CaretDown size={17} weight="bold" /></div>
                </fieldset>
                <fieldset className="field-group">
                  <legend>培养对象</legend>
                  <div className="select-wrap"><select aria-label="培养对象" value={growthCategory} onChange={(event) => { setGrowthCategory(event.target.value); invalidate(); }}>{Object.entries(GROWTH_OPTIONS).map(([value, option]) => <option value={value} key={value}>{option.label}</option>)}</select><CaretDown size={17} weight="bold" /></div>
                </fieldset>
                {mode === "afk" && (
                  <fieldset className="field-group field-group--cadence">
                    <legend>启动轴求解范围</legend>
                    <div className="cadence-switch">
                      <button className={axisScope === "shared" ? "is-active" : ""} onClick={() => { setAxisScope("shared"); invalidate(); }}>
                        <span><strong>统一启动轴</strong><small>所有设施使用同一组时间，容易照着执行</small></span><em>简洁</em>
                      </button>
                      <button className={axisScope === "facility" ? "is-active" : ""} onClick={() => { setAxisScope("facility"); invalidate(); }}>
                        <span><strong>分设施启动轴</strong><small>每个设施分别搜索，优先长期产出</small></span><em>精细</em>
                      </button>
                    </div>
                    <p className="cadence-note">算法完整枚举 30 分钟网格，并使用更长周期复核候选；以计入停产后的长期产效为主、覆盖率为次。非总控仍只组成全减耗或无减耗小组。</p>
                  </fieldset>
                )}
                {mode === "shift" && (
                  <fieldset className="field-group field-group--times">
                    <legend>每日上线时间</legend>
                    <div className="time-list">{loginTimes.map((time) => <span className="time-chip" key={time}>{time}<button aria-label={`移除 ${time}`} onClick={() => { setLoginTimes((current) => current.filter((item) => item !== time)); invalidate(); }}><Trash size={14} weight="bold" /></button></span>)}</div>
                    <div className="time-add"><input aria-label="新增上线时间" type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} /><button onClick={addTime}><Plus size={16} weight="bold" />添加</button></div>
                  </fieldset>
                )}
                <aside className="assumption-card"><ShieldCheck size={22} weight="fill" /><div><strong>模拟口径</strong><p>{mode === "afk" ? "首次进驻按满心情；之后按 7%/小时消耗、总控 12%/小时恢复，模拟自动下班与满心情返岗。未计好友助力和手动补心情。" : "按多日连续状态模拟整组换班；接班时继承干员实际心情，归零后自动休息、回满后若仍在本班则返岗。未计好友助力。"}</p></div></aside>
              </div>

              <fieldset className="field-group field-group--operators">
                <legend><span>参与计算的干员</span><small>默认 E4 · 可逐人调整练度</small></legend>
                <div className="operator-toolbar">
                  <label className="operator-search"><MagnifyingGlass size={17} weight="bold" /><input value={operatorSearch} onChange={(event) => setOperatorSearch(event.target.value)} placeholder="搜索干员" /></label>
                  <label className="operator-filter"><span>设施</span><select value={facilityFilter} onChange={(event) => setFacilityFilter(event.target.value)}><option value="all">全部设施</option>{FACILITIES.map((facility) => <option value={facility} key={facility}>{facility}</option>)}</select></label>
                  <button className={`owned-filter ${ownedOnly ? "is-active" : ""}`} aria-pressed={ownedOnly} onClick={() => setOwnedOnly((current) => !current)}>仅看已拥有</button>
                  <button className={`select-all-button ${allOperatorsSelected ? "is-active" : ""}`} aria-pressed={allOperatorsSelected} onClick={toggleAllOperators}>{allOperatorsSelected ? "全不选" : `全选 ${OPERATORS.length}`}</button>
                  <span className="operator-result-count">显示 {filteredOperators.length}/{OPERATORS.length}</span>
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

            <div className="config-actionbar"><div><span>NEXT / 02</span><strong>{calculationError || (!canCalculate ? (selected.length < 3 ? "至少选择 3 名干员" : "至少添加 1 个上线时间") : mode === "afk" ? `将自动搜索${AXIS_SCOPES[axisScope].label}` : "条件已就绪，可以生成排班")}</strong></div><button className="calculate-button" onClick={calculate} disabled={busy || !canCalculate}><Calculator size={21} weight="fill" />{busy ? (mode === "afk" ? "正在搜索启动轴…" : "正在计算…") : "生成排班结果"}{!busy && <ArrowRight size={20} weight="bold" />}</button></div>
          </section>
          )}

          {activeSection === "result" && calculated && (
          <section className="result-panel page-enter" aria-live="polite" ref={resultRef} tabIndex={-1}>
            <div className="result-header">
              <div><span className="step-index">02</span><p>{mode === "afk" ? "长期挂机推荐" : "固定上线倒班推荐"}</p><h2>计算完成，建议按此排班</h2></div>
              <div className="result-actions"><div className="result-status"><span className="status-dot" />结果可用</div><button className="edit-config-button" onClick={() => goToSection("config", configRef)}><ArrowLeft size={17} weight="bold" />修改配置</button></div>
            </div>
            <div className="metric-row">
              <Metric label="高级武器套组" value={`${dailySummary.weapon.toFixed(1)} /日`} note="满级制造舱 · 按实际在岗折算" />
              <Metric label="高级作战记录" value={`${dailySummary.operator.toFixed(1)} /日`} note="满级制造舱 · 按实际在岗折算" />
              <Metric label={`${GROWTH_OPTIONS[growthCategory].label}培养`} value={`${dailySummary.growth.toFixed(2)} /日`} note="3 级培养舱 · 9 个培养箱" />
              <Metric label="预计线索搜集" value={`${dailySummary.clues.toFixed(2)} /日`} note="按 72 小时基础周期估算" />
            </div>
            <div className="operation-strip" aria-label="排班运行指标">
              <div><span>平均产效</span><strong>{(dailySummary.averageEfficiency * 100).toFixed(0)}%</strong><small>40% 进驻 × 技能乘算</small></div>
              <div><span>平均在岗</span><strong>{dailySummary.averageActive.toFixed(2)} / 3</strong><small>生产设施长期均值</small></div>
              <div><span>设施覆盖</span><strong>{(dailySummary.averageCoverage * 100).toFixed(1)}%</strong><small>至少一人在岗的时间</small></div>
              <div><span>平均停产</span><strong>{dailySummary.averageDowntime.toFixed(2)}h</strong><small>每设施每日</small></div>
            </div>
            <section className="timeline-section">
              <div className="section-label-row"><div><span>ASSIGNMENT PLAN</span><h3>{mode === "afk" ? "算法推荐启动轴" : "按上线节点进行整组换班"}</h3></div><span className="mode-badge">{mode === "afk" ? AXIS_SCOPES[axisScope].shortLabel : `每日 ${loginTimes.length} 次`}</span></div>
              <div className={`assignment-board ${mode === "shift" ? "assignment-board--shifts" : "assignment-board--afk"}`}>
                {ROOM_META.map((room, roomIndex) => {
                  const roomOperators = assignments[room.id];
                  const roomSummary = dailySummary.rooms[room.id];
                  const startOffsets = mode === "afk" ? (dailySummary.startup.offsetsByRoom[room.id] ?? []) : [];
                  const scheduledOperators = roomOperators
                    .map((operator, operatorIndex) => ({ operator, startOffset: startOffsets[operatorIndex] ?? 0, operatorIndex }))
                    .sort((left, right) => left.startOffset - right.startOffset || left.operatorIndex - right.operatorIndex);
                  const moodGroup = mode === "afk" ? getMoodGroupLabel(roomOperators, room) : null;
                  return (
                    <article className="facility-lane" key={room.id}>
                      <div className="facility-name"><Factory size={22} weight="fill" /><span><strong>{room.name}</strong><small>{getRoomRecipe(room, priority, growthCategory, dailySummary)}</small>{room.id !== "control" && <em>产效 {(roomSummary.averageFactor * 100).toFixed(0)}% · 覆盖 {(roomSummary.coverageRate * 100).toFixed(0)}%</em>}{moodGroup && <em>{moodGroup}</em>}</span></div>
                      {mode === "afk" ? (
                        <div className="lane-assignments">{scheduledOperators.length ? scheduledOperators.map(({ operator, startOffset }, index) => <div className="assignment-slot" key={operator.id}><div className="assignment-time" aria-label={formatStartOffset(startOffset)} title={formatStartOffset(startOffset)}>{formatStartOffsetLabel(startOffset)}</div><div className="assignment-cell" style={{ "--delay": `${index * 55 + roomIndex * 35}ms` }}><OperatorMark operator={operator} /><span><strong>{operator.name}</strong><AssignmentSkills operator={operator} room={room} priority={priority} growthCategory={growthCategory} team={roomOperators} /></span></div></div>) : <div className="empty-lane">当前干员数量不足</div>}</div>
                      ) : (
                        <div className="lane-assignments lane-assignments--shifts" style={{ "--shift-count": loginTimes.length }}>
                          {(shiftAssignments[room.id] ?? []).map((shiftOperators, shiftIndex) => <section className="shift-block" key={`${room.id}-${loginTimes[shiftIndex]}`}><header className="shift-block__header"><span>班次 {String(shiftIndex + 1).padStart(2, "0")}</span><strong>{loginTimes[shiftIndex]}</strong></header><div className="shift-operators">{shiftOperators.length ? shiftOperators.map((operator, index) => <div className="assignment-cell assignment-cell--compact" key={`${operator.id}-${shiftIndex}`} style={{ "--delay": `${index * 45 + shiftIndex * 80 + roomIndex * 35}ms` }}><OperatorMark operator={operator} /><span><strong>{operator.name}</strong><AssignmentSkills operator={operator} room={room} priority={priority} growthCategory={growthCategory} team={shiftOperators} /></span></div>) : <div className="empty-lane">本班保留空位</div>}</div></section>)}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
            <footer className="result-footer"><div className="explain-block"><UsersThree size={22} weight="fill" /><div><strong>产量口径</strong><p>{mode === "afk" ? "跨舱室按各生产设施的标准化产效等权比较；完整枚举半小时启动轴，以 180 日预热、随后 90 日平均复核。每个时间片按实际在岗人数计算：(1 + 40% × 人数) × (1 + 当前配方技能合计)。" : "跨舱室按标准化产效等权比较；每个上线节点整组换班，并在多日模拟中连续追踪工作、归零、休息与返岗。定向线索只改变类型概率，不计入线索总量。"}</p></div></div><div className="run-code">BASE 40% × SKILL</div></footer>
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
    </main>
  );
}
