import { useState } from "react";
import SelectField from "./SelectField.jsx";
import { activePlanGroup, formatPlanClock, modulo24, planWindow } from "./planningModel.js";

const TIMES = Array.from({ length: 24 }, (_, i) => ({ value: i, label: formatPlanClock(i) }));
const OFFSETS = Array.from({ length: 48 }, (_, i) => ({ value: i / 2, label: `T +${i / 2}h` }));
export function PlanTimeline({ plan }) {
  if (plan.kind === "single") return <div className="plan-single-timing">{plan.offsets.map((offset, index) => <span key={index}>槽位 {index + 1}<strong>T +{offset}h</strong></span>)}</div>;
  const points = [...new Set([0, plan.start, modulo24(plan.start + plan.duration), 24])].sort((a, b) => a - b);
  return <div className="plan-clock" aria-label={`A 组 ${planWindow(plan, 0).label}；B 组 ${planWindow(plan, 1).label}；UTC+8`}>
    <div className="plan-clock__ticks"><span>00:00</span><span>12:00</span><span>24:00</span></div>
    <div className="plan-clock__bar" aria-hidden="true">{points.slice(0, -1).map((start, i) => <span key={start} className={activePlanGroup(start + .001, plan) === 0 ? "plan-clock__a" : "plan-clock__b"} style={{ width: `${(points[i + 1] - start) / 24 * 100}%` }}>{points[i + 1] - start >= 2 ? (activePlanGroup(start + .001, plan) === 0 ? "A" : "B") : ""}</span>)}</div>
  </div>;
}
export default function PlanEditor({ rooms, plans, onChange }) {
  const [roomId, setRoomId] = useState(rooms[0].id);
  const room = rooms.find((r) => r.id === roomId);
  const plan = plans[roomId];
  const update = (patch) => onChange({ ...plans, [roomId]: { ...plan, ...patch } });
  return <fieldset className="field-group field-group--planning">
    <legend>舱室运行方式 <small>UTC+8</small></legend>
    <SelectField label="编辑舱室" tone="dark" value={roomId} onChange={setRoomId} options={rooms.map((r) => ({ value: r.id, label: r.name }))} />
    <div className="plan-kind-switch">{[["single", "单班错峰"], ["dual", "AB 双班"]].map(([value, label]) => <button key={value} className={plan.kind === value ? "is-active" : ""} aria-pressed={plan.kind === value} onClick={() => update({ kind: value })}>{label}</button>)}</div>
    {plan.kind === "dual" ? <>
      <div className="plan-time-inputs">
        <label><span>A 组开始</span><SelectField label={`${room.name} A组开始`} tone="dark" value={plan.start} onChange={(value) => update({ start: Number(value) })} options={TIMES} /></label>
        <label><span>A 组结束</span><SelectField label={`${room.name} A组结束`} tone="dark" value={modulo24(plan.start + plan.duration)} onChange={(value) => update({ duration: modulo24(Number(value) - plan.start) })} options={TIMES.filter(({ value }) => value !== plan.start)} /></label>
      </div>
      <label className="plan-duration"><span>A 组工作时长 <strong>{plan.duration} 小时</strong></span><input type="range" min="1" max="23" step="1" aria-label={`${room.name} A组工作时长`} value={plan.duration} onChange={(e) => update({ duration: Number(e.target.value) })} /></label>
      <PlanTimeline plan={plan} />
      <p className="plan-help">B 组 {planWindow(plan, 1).label} · {24 - plan.duration} 小时 · 仅整点换班</p>
    </> : <>
      <p className="plan-help">按结果中的槽位顺序分时进驻，此后耗尽休息、满心情返岗。</p>
      <div className="plan-offset-inputs">{plan.offsets.map((offset, index) => <label key={index}><span>槽位 {index + 1}</span><SelectField label={`${room.name} 槽位${index + 1}启动偏移`} value={offset} tone="dark" options={OFFSETS} onChange={(value) => update({ offsets: plan.offsets.map((old, i) => i === index ? Number(value) : old) })} /></label>)}</div>
    </>}
    <button className="plan-apply-all" onClick={() => onChange(Object.fromEntries(rooms.map((r) => [r.id, { ...plan, offsets: [...plan.offsets] }])))}>应用到所有舱室</button>
    <div className="plan-room-summary">{rooms.map((r) => <button key={r.id} onClick={() => setRoomId(r.id)} aria-pressed={r.id === roomId}><span>{r.name}</span><strong>{plans[r.id].kind === "single" ? "单班错峰" : `AB · ${plans[r.id].duration} / ${24 - plans[r.id].duration}h`}</strong></button>)}</div>
  </fieldset>;
}
