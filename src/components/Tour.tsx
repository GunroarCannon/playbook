"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** A first-run walkthrough: spotlight a part of the screen, explain it simply, point at it with a loopy hand-drawn arrow. */

type Step = { target: string; title: string; body: string };

const STEPS: Step[] = [
  { target: "chat", title: "Say what you're working on", body: "Type your problem in plain words, like “my bridge can only use 40 sticks”. Playbook sets up the test for you." },
  // phones: the workbench lives behind a tab
  { target: "bench-tab", title: "Flip to the workbench", body: "Tap here to see your idea drawn out, turn the dials, and press the big red button to test it." },
  { target: "bench", title: "Watch it on the workbench", body: "Your idea gets drawn here. When you test it, you see it hold, bend, run dry or break." },
  { target: "controls", title: "Turn the dials", body: "Drag the dials and sliders to change things. Playbook can turn them for you too." },
  { target: "run", title: "Press the big red button", body: "It runs the test. Pass or fail, Playbook tells you why and what to try next." },
  {
    target: "memory",
    title: "Memory: on or off",
    body: "With Walrus Memory ON, Playbook remembers your limits, best results and mistakes, even on another phone or laptop. Flip it OFF to see the difference.",
  },
  // phones: sheets and the memory ledger live in the menu
  { target: "menu", title: "Your sheets and memories", body: "Open the menu to switch sheets, start a new one, or see everything Playbook remembers about you." },
  { target: "ledger", title: "What it remembers", body: "Everything Playbook saved about you is listed here. A green dot means it's safely stored on Walrus." },
  { target: "new-sheet", title: "Start fresh, or invent a bench", body: "Open a new sheet any time. Pick a bench, or describe your own idea and the AI will build a new simulation for it." },
];

type Rect = { x: number; y: number; w: number; h: number };
type Pt = { x: number; y: number };

const CARD_W = 300;
const GAP = 124;

function visibleRect(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  const vw = window.innerWidth, vh = window.innerHeight;
  if (r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** Where to put the card, and the two ends of the arrow. */
function layout(t: Rect, cardH: number) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const clampX = (x: number) => Math.max(12, Math.min(vw - CARD_W - 12, x));
  const clampY = (y: number) => Math.max(12, Math.min(vh - cardH - 12, y));
  const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
  const room = { right: vw - (t.x + t.w), left: t.x, below: vh - (t.y + t.h), above: t.y };
  const fitsH = (s: number) => s >= CARD_W + GAP + 12;
  const fitsV = (s: number) => s >= cardH + GAP + 12;
  const order = (Object.keys(room) as (keyof typeof room)[]).sort((a, b) => room[b] - room[a]);
  const side = order.find((s) => (s === "left" || s === "right" ? fitsH(room[s]) : fitsV(room[s])));

  let card: Pt, from: Pt, to: Pt;
  if (side === "right") {
    card = { x: t.x + t.w + GAP, y: clampY(cy - cardH / 2) };
    from = { x: card.x - 6, y: card.y + Math.min(cardH - 20, Math.max(20, cy - card.y)) };
    to = { x: t.x + t.w + 8, y: cy };
  } else if (side === "left") {
    card = { x: t.x - GAP - CARD_W, y: clampY(cy - cardH / 2) };
    from = { x: card.x + CARD_W + 6, y: card.y + Math.min(cardH - 20, Math.max(20, cy - card.y)) };
    to = { x: t.x - 8, y: cy };
  } else if (side === "below") {
    card = { x: clampX(cx - CARD_W / 2), y: t.y + t.h + GAP };
    from = { x: card.x + Math.min(CARD_W - 30, Math.max(30, cx - card.x)), y: card.y - 6 };
    to = { x: cx, y: t.y + t.h + 8 };
  } else if (side === "above") {
    card = { x: clampX(cx - CARD_W / 2), y: t.y - GAP - cardH };
    from = { x: card.x + Math.min(CARD_W - 30, Math.max(30, cx - card.x)), y: card.y + cardH + 6 };
    to = { x: cx, y: t.y - 8 };
  } else {
    // Target fills most of the screen: sit the card inside it, near the bottom, pointing up into it.
    card = { x: clampX(cx - CARD_W / 2), y: clampY(t.y + t.h - cardH - 24) };
    from = { x: card.x + CARD_W / 2, y: card.y - 6 };
    to = { x: cx + 40, y: Math.max(t.y + 30, card.y - GAP) };
  }
  return { card, from, to };
}

/** A hand-drawn arrow with a little loop in the middle, like a doodle in a notebook margin. */
function squiggle(s: Pt, e: Pt) {
  const dx = e.x - s.x, dy = e.y - s.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const r = Math.max(13, Math.min(28, len * 0.21));
  const p = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  const m = { x: s.x + dx * 0.42, y: s.y + dy * 0.42 };
  const c1 = p(s.x + dx * 0.15 + nx * r * 0.9, s.y + dy * 0.15 + ny * r * 0.9);
  const c2 = p(m.x - ux * r * 0.9 + nx * r * 0.7, m.y - uy * r * 0.9 + ny * r * 0.7);
  const l1 = p(m.x + ux * r * 1.9 - nx * r * 2.3, m.y + uy * r * 1.9 - ny * r * 2.3);
  const l2 = p(m.x - ux * r * 1.5 - nx * r * 2.3, m.y - uy * r * 1.5 - ny * r * 2.3);
  const c3 = p(m.x + ux * r * 1.3 + nx * r * 0.9, m.y + uy * r * 1.3 + ny * r * 0.9);
  const k = { x: e.x - ux * len * 0.22 - nx * r * 0.6, y: e.y - uy * len * 0.22 - ny * r * 0.6 };
  const d = `M ${p(s.x, s.y)} C ${c1} ${c2} ${p(m.x, m.y)} C ${l1} ${l2} ${p(m.x, m.y)} C ${c3} ${p(k.x, k.y)} ${p(e.x, e.y)}`;
  // arrowhead along the final tangent (k -> e)
  const a = Math.atan2(e.y - k.y, e.x - k.x), h = 15;
  const head = `M ${p(e.x - h * Math.cos(a - 0.5), e.y - h * Math.sin(a - 0.5))} L ${p(e.x, e.y)} L ${p(e.x - h * Math.cos(a + 0.5), e.y - h * Math.sin(a + 0.5))}`;
  return { d, head };
}

export default function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(190);
  const cardRef = useRef<HTMLDivElement>(null);
  const [, force] = useState(0);

  // only steps whose target is on screen right now (e.g. the sidebar is hidden on phones)
  const [steps] = useState(() => STEPS.filter((s) => visibleRect(s.target)));
  const step = steps[i];

  const measure = useCallback(() => {
    if (!step) return;
    setRect(visibleRect(step.target));
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [step]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [measure]);

  useEffect(() => {
    const onResize = () => {
      measure();
      force((n) => n + 1);
    };
    window.addEventListener("resize", onResize);
    const t = setInterval(measure, 600); // layout can shift while chat streams in
    return () => {
      window.removeEventListener("resize", onResize);
      clearInterval(t);
    };
  }, [measure]);

  const finish = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") setI((n) => Math.min(steps.length - 1, n + 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, steps.length]);

  if (!step || !rect) {
    if (steps.length === 0) return null;
    return null;
  }
  const { card, from, to } = layout(rect, cardH);
  const arrow = squiggle(from, to);
  const last = i === steps.length - 1;
  const pad = 8;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="How to use Playbook">
      {/* click-catcher */}
      <div className="absolute inset-0" onClick={() => (last ? finish() : setI(i + 1))} />
      {/* spotlight: a hole in a sheet of tracing paper */}
      <div
        className="absolute rounded-[6px] border-2 border-dashed border-ink pointer-events-none transition-all duration-300 ease-out"
        style={{
          left: rect.x - pad,
          top: rect.y - pad,
          width: rect.w + pad * 2,
          height: rect.h + pad * 2,
          boxShadow: "0 0 0 9999px color-mix(in srgb, var(--paper) 80%, transparent)",
        }}
      />
      {/* the loop arrow */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none text-ink" aria-hidden>
        <g key={i} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" filter="url(#pb-wobble)">
          <path d={arrow.d} strokeWidth="2.6" pathLength={1} className="pb-tour-draw" />
          <path d={arrow.head} strokeWidth="2.8" className="pb-tour-head" />
        </g>
      </svg>
      {/* the card */}
      <div
        ref={cardRef}
        key={`card-${i}`}
        className="absolute sheet ink-box p-4 pb-3 pb-tour-card"
        style={{ left: card.x, top: card.y, width: CARD_W }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="mono text-[11px] text-ink-3">
            {i + 1} / {steps.length}
          </span>
          <button onClick={finish} className="hand text-[13px] text-ink-3 hover:text-ink underline decoration-dotted">
            skip tour
          </button>
        </div>
        <h3 className="hand text-[21px] leading-tight mt-1">{step.title}</h3>
        <p className="text-[14.5px] text-ink-2 mt-1.5 leading-snug">{step.body}</p>
        <div className="flex items-center gap-2 mt-3">
          <div className="flex gap-1 flex-1">
            {steps.map((_, k) => (
              <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-navy" : "w-1.5 bg-ink/25"}`} />
            ))}
          </div>
          {i > 0 && (
            <button onClick={() => setI(i - 1)} className="btn-ink px-2.5 py-0.5 text-[14px]">
              back
            </button>
          )}
          <button autoFocus onClick={() => (last ? finish() : setI(i + 1))} className="btn-ink px-3 py-0.5 text-[15px] bg-note">
            {last ? "Got it!" : "next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
