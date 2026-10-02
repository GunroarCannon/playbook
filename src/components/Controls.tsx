"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ParamSpec, ParamValue } from "@/lib/sims";

const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snap = (v: number, step: number, min: number) => +(Math.round((v - min) / step) * step + min).toFixed(4);
const fmt = (v: number, step = 1) => (step < 1 ? v.toFixed(Math.min(2, String(step).split(".")[1]?.length ?? 1)) : String(Math.round(v)));

type CommonProps = { spec: ParamSpec; value: ParamValue; onChange: (v: ParamValue) => void; flash?: boolean };

/* ---------------------------------------------------------------- Rotary dial */

export function Dial({ spec, value, onChange, flash }: CommonProps) {
  const min = spec.min ?? 0,
    max = spec.max ?? 100,
    step = spec.step ?? 1;
  const v = typeof value === "number" ? value : Number(value);
  const t = (clamp(v, min, max) - min) / (max - min || 1);
  const angle = -135 + t * 270;
  const ref = useRef<SVGSVGElement>(null);
  const drag = useRef<{ startY: number; startV: number; mode: "angle" | "vertical" } | null>(null);

  const setFromPointer = useCallback(
    (e: PointerEvent) => {
      const el = ref.current;
      if (!el || !drag.current) return;
      if (drag.current.mode === "vertical") {
        const dy = drag.current.startY - e.clientY;
        const nv = drag.current.startV + (dy / 160) * (max - min);
        onChange(snap(clamp(nv, min, max), step, min));
        return;
      }
      const r = el.getBoundingClientRect();
      const a = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI + 90;
      let deg = a > 180 ? a - 360 : a; // -180..180, 0 = up
      deg = clamp(deg, -135, 135);
      onChange(snap(min + ((deg + 135) / 270) * (max - min), step, min));
    },
    [max, min, onChange, step],
  );

  const onKey = (e: KeyboardEvent) => {
    const big = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") onChange(snap(clamp(v + step * big, min, max), step, min));
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") onChange(snap(clamp(v - step * big, min, max), step, min));
    else return;
    e.preventDefault();
  };

  const ticks = Array.from({ length: 28 }, (_, i) => {
    const a = ((-135 + (i / 27) * 270 - 90) * Math.PI) / 180;
    const major = i % 9 === 0;
    const r1 = 46,
      rB = major ? 39 : 42.5;
    return <line key={i} x1={r2(50 + r1 * Math.cos(a))} y1={r2(50 + r1 * Math.sin(a))} x2={r2(50 + rB * Math.cos(a))} y2={r2(50 + rB * Math.sin(a))} strokeWidth={major ? 1.6 : 1} />;
  });

  return (
    <div className={`flex flex-col items-center select-none ${flash ? "animate-[pb-pulse_0.6s_ease-in-out_2]" : ""}`}>
      <svg
        ref={ref}
        viewBox="0 0 100 100"
        className="w-[78px] h-[78px] cursor-grab active:cursor-grabbing touch-none focus:outline-none focus-visible:drop-shadow-[0_0_3px_var(--blue)] text-ink"
        role="slider"
        tabIndex={0}
        aria-label={spec.label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={v}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { startY: e.clientY, startV: v, mode: e.altKey ? "vertical" : "angle" };
          setFromPointer(e);
        }}
        onPointerMove={(e) => drag.current && setFromPointer(e)}
        onPointerUp={() => (drag.current = null)}
        onWheel={(e) => onChange(snap(clamp(v + (e.deltaY < 0 ? step : -step), min, max), step, min))}
      >
        <g stroke="currentColor" fill="none" strokeLinecap="round">
          {ticks}
          {/* value arc */}
          <path
            d={describeArc(50, 50, 35, -135, angle)}
            stroke="var(--blue)"
            strokeWidth="2.4"
            opacity={0.85}
          />
          {/* grip ring */}
          <circle cx="50" cy="50" r="31" fill="url(#pb-hatch)" strokeWidth="1.6" />
          <circle cx="50" cy="50" r="23" fill="var(--sheet)" strokeWidth="1.6" />
          <g transform={`rotate(${angle} 50 50)`}>
            <line x1="50" y1="50" x2="50" y2="22" strokeWidth="3" />
            <circle cx="50" cy="31" r="2" fill="currentColor" />
          </g>
          <circle cx="50" cy="50" r="3" fill="currentColor" />
        </g>
      </svg>
      <div className="mono text-[13px] -mt-1 text-ink">
        {fmt(v, step)}
        {spec.unit && <span className="text-ink-3 text-[11px] ml-0.5">{spec.unit}</span>}
      </div>
      <div className="hand text-[13px] text-ink-2 leading-tight text-center max-w-[96px]">{spec.label}</div>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: r2(cx + r * Math.cos(a)), y: r2(cy + r * Math.sin(a)) };
}
function describeArc(cx: number, cy: number, r: number, start: number, end: number) {
  if (end - start < 0.5) return "";
  const s = polar(cx, cy, r, start),
    e = polar(cx, cy, r, end);
  return `M${s.x} ${s.y} A${r} ${r} 0 ${end - start > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
}

/* ---------------------------------------------------------------- Fader */

export function Fader({ spec, value, onChange, flash }: CommonProps) {
  const id = useId();
  const min = spec.min ?? 0,
    max = spec.max ?? 100,
    step = spec.step ?? 1;
  const v = typeof value === "number" ? value : Number(value);
  const t = (clamp(v, min, max) - min) / (max - min || 1);
  return (
    <div className={`flex flex-col gap-0.5 min-w-[150px] ${flash ? "animate-[pb-pulse_0.6s_ease-in-out_2]" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="hand text-[13px] text-ink-2">
          {spec.label}
        </label>
        <span className="mono text-[13px] text-ink">
          {fmt(v, step)}
          {spec.unit && <span className="text-ink-3 text-[11px] ml-0.5">{spec.unit}</span>}
        </span>
      </div>
      <div className="relative h-7">
        <svg className="absolute inset-0 w-full h-full text-ink" preserveAspectRatio="none" viewBox="0 0 200 28" aria-hidden>
          <g stroke="currentColor" fill="none">
            {Array.from({ length: 21 }, (_, i) => (
              <line key={i} x1={6 + i * 9.4} x2={6 + i * 9.4} y1={i % 5 === 0 ? 2 : 5} y2={8} strokeWidth={i % 5 === 0 ? 1.2 : 0.8} opacity={0.7} />
            ))}
            <rect x="4" y="14" width="192" height="6" rx="3" strokeWidth="1.3" fill="var(--sheet-2)" />
            <line x1="7" x2={7 + t * 186} y1="17" y2="17" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round" />
          </g>
        </svg>
        {/* thumb */}
        <div
          className="pointer-events-none absolute top-[9px] h-[17px] w-[14px] -ml-[7px] border-[1.5px] border-ink rounded-[2px] bg-sheet shadow-[1.5px_1.5px_0_var(--shadow)] flex items-center justify-center gap-[2px]"
          style={{ left: `calc(${2 + t * 96}%)` }}
        >
          <span className="w-px h-2 bg-ink" />
          <span className="w-px h-2 bg-ink" />
        </div>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={v}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Knife switch */

export function KnifeToggle({ spec, value, onChange, flash }: CommonProps) {
  const on = Boolean(value);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={spec.label}
      onClick={() => onChange(!on)}
      className={`flex flex-col items-center select-none group ${flash ? "animate-[pb-pulse_0.6s_ease-in-out_2]" : ""}`}
    >
      <svg viewBox="0 0 80 64" className="w-[70px] h-[56px] text-ink">
        <g stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="44" width="68" height="16" rx="2" strokeWidth="1.5" fill="url(#pb-hatch)" />
          {/* clips */}
          <path d="M18 44 V36 M24 44 V36" strokeWidth="1.6" />
          <path d="M56 44 V36 M62 44 V36" strokeWidth="1.6" />
          {/* blade pivots at left clip */}
          <g style={{ transition: "transform 0.25s cubic-bezier(.5,1.6,.5,1)", transformOrigin: "21px 40px", transform: `rotate(${on ? 0 : -58}deg)` }}>
            <path d="M21 40 L59 40" strokeWidth="3.2" />
            <path d="M59 40 L59 24" strokeWidth="2" />
            <rect x="52" y="14" width="14" height="10" rx="4" fill={on ? "var(--red)" : "var(--sheet)"} strokeWidth="1.5" />
          </g>
          <circle cx="21" cy="40" r="2.4" fill="currentColor" />
        </g>
      </svg>
      <span className={`mono text-[11px] tracking-widest ${on ? "text-red" : "text-ink-3"}`}>{on ? "ON" : "OFF"}</span>
      <span className="hand text-[13px] text-ink-2 leading-tight text-center max-w-[100px]">{spec.label}</span>
    </button>
  );
}

/* ---------------------------------------------------------------- Selector */

export function Selector({ spec, value, onChange, flash }: CommonProps) {
  return (
    <div className={`flex flex-col gap-1 ${flash ? "animate-[pb-pulse_0.6s_ease-in-out_2]" : ""}`}>
      <span className="hand text-[13px] text-ink-2">{spec.label}</span>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={spec.label}>
        {spec.options?.map((o) => {
          const active = String(value) === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`hand text-[13px] px-2 py-0.5 rounded-[3px] border-[1.5px] transition ${
                active ? "border-ink bg-ink text-sheet shadow-[2px_2px_0_var(--blue)]" : "border-ink/40 text-ink-2 hover:border-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Control(props: CommonProps) {
  switch (props.spec.control) {
    case "dial":
      return <Dial {...props} />;
    case "fader":
      return <Fader {...props} />;
    case "toggle":
      return <KnifeToggle {...props} />;
    case "select":
      return <Selector {...props} />;
  }
}

/* ---------------------------------------------------------------- Run button (big red arcade button) */

const CAP_TOP = 38; // cap face centre when up
const CAP_SEAT = 56; // where the cap meets the ring

export function RunButton({ onClick, running, disabled }: { onClick: () => void; running?: boolean; disabled?: boolean }) {
  const [down, setDown] = useState(false);
  const [jiggle, setJiggle] = useState(false);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const pressed = down || running;
  const sink = pressed ? 9 : 0;

  // Every so often the button bounces and wiggles to invite a press.
  useEffect(() => {
    if (running || disabled) return;
    let t: ReturnType<typeof setTimeout>;
    const queue = () => {
      t = setTimeout(() => {
        setJiggle(true);
        queue();
      }, 6000 + Math.random() * 7000);
    };
    queue();
    return () => clearTimeout(t);
  }, [running, disabled]);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      className="group flex flex-col items-center gap-1 select-none outline-none disabled:opacity-50 disabled:cursor-not-allowed focus-visible:[&_.pb-tag]:ring-2 focus-visible:[&_.pb-tag]:ring-[var(--red)]"
      aria-label="Run stress test"
    >
      <svg
        viewBox="0 0 120 92"
        className={`w-[104px] h-[80px] text-ink overflow-visible ${jiggle && !pressed ? "pb-jiggle" : ""}`}
        onAnimationEnd={() => setJiggle(false)}
      >
        <defs>
          <radialGradient id={`${uid}-face`} cx="38%" cy="30%" r="80%">
            <stop offset="0" stopColor="#ff6a55" />
            <stop offset="0.45" stopColor="#ee2b1f" />
            <stop offset="1" stopColor="#c4170f" />
          </radialGradient>
          <linearGradient id={`${uid}-side`} x1="0" x2="1">
            <stop offset="0" stopColor="#7a0c07" />
            <stop offset="0.25" stopColor="#c81d14" />
            <stop offset="0.45" stopColor="#d9281d" />
            <stop offset="1" stopColor="#6a0904" />
          </linearGradient>
          <linearGradient id={`${uid}-ring`} x1="0" x2="1">
            <stop offset="0" stopColor="#2e3035" />
            <stop offset="0.35" stopColor="#5b5f66" />
            <stop offset="1" stopColor="#25272b" />
          </linearGradient>
          <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a4a8ae" />
            <stop offset="1" stopColor="#6c7077" />
          </linearGradient>
        </defs>
        <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          {/* cast shadow */}
          <ellipse cx="63" cy="84" rx="54" ry="7" fill="currentColor" opacity="0.12" stroke="none" />
          {/* grey ring base */}
          <path d="M8 60 L8 70 A52 15 0 0 0 112 70 L112 60 Z" fill={`url(#${uid}-ring)`} strokeWidth="1.6" />
          <ellipse cx="60" cy="60" rx="52" ry="15" fill={`url(#${uid}-rim)`} strokeWidth="1.6" />
          <ellipse cx="60" cy={CAP_SEAT + 1} rx="45" ry="12.5" fill="#1c1d20" strokeWidth="1.2" />
          {/* red cap: the side band shortens as the face goes down */}
          <path
            d={`M16 ${CAP_TOP + sink} L16 ${CAP_SEAT} A44 12.5 0 0 0 104 ${CAP_SEAT} L104 ${CAP_TOP + sink} Z`}
            fill={`url(#${uid}-side)`}
            strokeWidth="1.6"
          />
          <g style={{ transform: `translateY(${sink}px)`, transition: "transform 90ms ease-out" }}>
            <ellipse cx="60" cy={CAP_TOP} rx="44" ry="15" fill={`url(#${uid}-face)`} strokeWidth="1.6" />
            {/* gloss */}
            <path d="M26 36 Q34 27 54 25.5" stroke="#fff" strokeWidth="3" opacity="0.55" fill="none" />
            <ellipse cx="72" cy="30" rx="6" ry="2" fill="#fff" stroke="none" opacity="0.3" />
          </g>
          {/* status lamp on the ring */}
          <circle cx="60" cy="78" r="2.3" strokeWidth="1" fill={running ? "var(--amber)" : "var(--green)"} className={running ? "pulse" : ""} />
        </g>
      </svg>
      <span
        className={`pb-tag hand text-[13px] tracking-[0.12em] px-2.5 py-[1px] rounded-[3px] border-[1.5px] border-current bg-[var(--sheet)] shadow-[2px_2px_0_currentColor] group-active:translate-x-[1px] group-active:translate-y-[1px] group-active:shadow-[1px_1px_0_currentColor] ${running ? "pulse" : ""}`}
      >
        {running ? "TESTING…" : "RUN TEST"}
      </span>
    </button>
  );
}

/* ---------------------------------------------------------------- Stress gauge */

export function StressGauge({ ratio, label }: { ratio: number; label?: string }) {
  const r = clamp(Number.isFinite(ratio) ? ratio : 0, 0, 1.5);
  const deg = -90 + (r / 1.5) * 180;
  const color = r >= 1 ? "var(--red)" : r >= 0.8 ? "var(--amber)" : "var(--green)";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 72" className="w-[118px] h-[70px] text-ink">
        <g fill="none" stroke="currentColor" strokeLinecap="round">
          <path d={describeArc(60, 62, 48, -90, 30)} strokeWidth="1.5" />
          <path d={describeArc(60, 62, 48, 30, 54)} stroke="var(--amber)" strokeWidth="4" />
          <path d={describeArc(60, 62, 48, 54, 90)} stroke="var(--red)" strokeWidth="4" />
          {Array.from({ length: 16 }, (_, i) => {
            const d = -90 + i * 12;
            const a = polar(60, 62, 48, d),
              b = polar(60, 62, i % 5 === 0 ? 39 : 43, d);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={i % 5 === 0 ? 1.5 : 0.9} />;
          })}
          <g style={{ transition: "transform 0.4s cubic-bezier(.4,1.5,.6,1)", transformOrigin: "60px 62px", transform: `rotate(${deg}deg)` }}>
            <line x1="60" y1="62" x2="60" y2="20" stroke={color} strokeWidth="2.4" />
          </g>
          <circle cx="60" cy="62" r="4" fill="currentColor" />
        </g>
        <text x="16" y="70" fontSize="8" className="mono" fill="currentColor">0</text>
        <text x="96" y="70" fontSize="8" className="mono" fill="currentColor">1.5×</text>
      </svg>
      <span className="mono text-[12px]" style={{ color }}>
        {(r * 100).toFixed(0)}% of limit
      </span>
      {label && <span className="hand text-[12px] text-ink-3 text-center leading-tight max-w-[140px]">{label}</span>}
    </div>
  );
}
