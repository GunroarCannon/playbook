import "server-only";
import { createContext, Script } from "node:vm";
import type { ParamSpec, ParamValue } from "./sims";

/**
 * Headless smoke test for an AI-written sim, before anyone sees it.
 *
 * Runs the script in a Node vm with a fake canvas, a fake clock and a hard CPU timeout, then drives it like the
 * browser would: init -> onParams -> RUN TEST -> ~13 s of frames. It must start, publish metrics and report a
 * result. Crashes and infinite loops fail here instead of in a person's browser, and the reported numbers feed the
 * physics review in sim-gen.ts.
 *
 * Layout lint: the fake drawing kit records where every label, sprite and chart lands (with estimated text widths),
 * at a desktop size and a small phone-ish size, before and after a test. Overlapping or off-canvas text comes back
 * as `layout` problems so the model can fix them.
 *
 * Isolation: node:vm is not a security boundary if host objects leak in (fn.constructor('return process')).
 * So no host object is passed: the context's global has a null prototype, every stub is defined from source
 * inside the context, string code generation is disabled, and the only thing that comes out is a JSON string.
 */

export type SmokeResult =
  | {
      ok: true;
      result: { passed: boolean; summary: string; failureReason?: string; score?: number; metrics?: Record<string, unknown> };
      metricsLabel?: string;
      /** Human-readable layout problems (overlaps, off-canvas text). Empty when the drawing is clean. */
      layout: string[];
      /** Behaviour problems: no animation, dials that do nothing, crashes at a dial's extremes, a pass rule that never flips. */
      behaviour: string[];
    }
  | { ok: false; error: string };

/** Canvas sizes the layout is checked at: a laptop bench and a small one (phone / narrow window). */
const SIZES: [number, number][] = [
  [820, 480],
  [560, 320],
];

// The D stub mirrors public/sims/bench.js: layout/fmt/chem are real copies, drawing calls only record boxes.
const PRELUDE = `
var __state = { opts: null, result: null, metrics: null, now: 0, W: 820, H: 480, rec: [], fh: 0, shapes: 0 };
// fingerprint of everything drawn this frame (positions and text), to see whether a test animates anything
function __h() {
  for (var i = 0; i < arguments.length; i++) {
    var a = arguments[i];
    if (typeof a === "number") __state.fh = (Math.imul(__state.fh, 31) + (Math.round(a * 2) | 0)) | 0;
    else if (typeof a === "string") for (var j = 0; j < a.length; j++) __state.fh = (Math.imul(__state.fh, 31) + a.charCodeAt(j)) | 0;
  }
}
function __shape() { __state.shapes++; __h.apply(null, arguments); }
var __noop = function () {};
var __any = new Proxy(function () {}, {
  get: function (_t, k) { return k === Symbol.toPrimitive ? function () { return 0; } : k === "width" ? 10 : k === "then" ? undefined : __any; },
  apply: function () { return __any; },
  set: function () { return true; }
});
function __rng(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// ---- fake 2D context: tracks font, alignment and translation so ctx.fillText lands where it would on screen
var __cs = { font: "10px sans-serif", textAlign: "left", textBaseline: "alphabetic", tx: 0, ty: 0, odd: 0, stack: [] };
function __px(font) { var m = /(\\d+(?:\\.\\d+)?)px/.exec(String(font)); return m ? +m[1] : 10; }
function __tw(s, size, mono) { return String(s).length * size * (mono ? 0.6 : 0.5); }
function __rec(k, s, x, y, w, h) {
  if (__cs.odd || !isFinite(x) || !isFinite(y) || !isFinite(w) || !isFinite(h)) return;
  __h(k, String(s), x + __cs.tx, y + __cs.ty, w, h);
  __state.rec.push({ k: k, s: String(s).slice(0, 60), x: x + __cs.tx, y: y + __cs.ty, w: w, h: h });
}
function __recText(s, x, y, size, mono, align, base, k) {
  s = String(s); if (!s.trim()) return;
  var w = __tw(s, size, mono), left = align === "center" ? x - w / 2 : align === "right" || align === "end" ? x - w : x;
  var top = base === "middle" ? y - size * 0.5 : base === "top" || base === "hanging" ? y : base === "bottom" ? y - size : y - size * 0.75;
  __rec(k || "text", s, left, top, w, size * 0.95);
}
var __ctxBase = {
  measureText: function (s) { var z = __px(__cs.font); return { width: __tw(s, z, /mono/i.test(__cs.font)), actualBoundingBoxAscent: z * 0.75, actualBoundingBoxDescent: z * 0.2 }; },
  fillText: function (s, x, y) { __recText(s, x, y, __px(__cs.font), /mono/i.test(__cs.font), __cs.textAlign, __cs.textBaseline); },
  strokeText: function (s, x, y) { __recText(s, x, y, __px(__cs.font), /mono/i.test(__cs.font), __cs.textAlign, __cs.textBaseline); },
  save: function () { __cs.stack.push([__cs.tx, __cs.ty, __cs.odd, __cs.font, __cs.textAlign, __cs.textBaseline]); },
  restore: function () { var s = __cs.stack.pop(); if (s) { __cs.tx = s[0]; __cs.ty = s[1]; __cs.odd = s[2]; __cs.font = s[3]; __cs.textAlign = s[4]; __cs.textBaseline = s[5]; } },
  translate: function (x, y) { __cs.tx += +x || 0; __cs.ty += +y || 0; },
  rotate: function (a) { if (+a) __cs.odd = 1; },
  scale: function (a, b) { if (+a !== 1 || +b !== 1) __cs.odd = 1; },
  transform: function () { __cs.odd = 1; }, setTransform: function () { __cs.odd = 1; }, resetTransform: function () { __cs.odd = 1; },
  moveTo: __h, lineTo: __h, arc: __h, arcTo: __h, ellipse: __h, rect: __h, quadraticCurveTo: __h, bezierCurveTo: __h,
  fill: function () { __shape(); }, stroke: function () { __shape(); }, fillRect: __shape, strokeRect: __shape, clearRect: __noop
};
var __ctx = new Proxy(__ctxBase, {
  get: function (t, k) { if (k === "font" || k === "textAlign" || k === "textBaseline") return __cs[k]; return Object.prototype.hasOwnProperty.call(t, k) ? t[k] : __any; },
  set: function (_t, k, v) { if (k === "font" || k === "textAlign" || k === "textBaseline") __cs[k] = String(v); return true; }
});
var D = {
  get W() { return __state.W; }, get H() { return __state.H; }, ctx: __ctx, rng: __rng, hash: function () { return 1; },
  C: { ink: "#000", ink2: "#333", ink3: "#888", navy: "#228", red: "#d33", blue: "#06c", amber: "#c80", green: "#282", paper: "#fff", fill: "#eee", minor: "#eee", major: "#ddd" },
  grid: __noop, line: __shape, rect: __shape, circle: __shape, hatch: __shape, dim: __shape, ground: __shape,
  text: function (str, x, y, o) {
    o = o || {}; str = String(str); var size = o.size || 14, mono = !!o.mono;
    if (o.maxW > 0 && __tw(str, size, mono) > o.maxW) {
      var min = Math.max(9, Math.round(size * 0.7));
      while (size > min && __tw(str, size, mono) > o.maxW) size--;
      if (__tw(str, size, mono) > o.maxW) { while (str.length > 1 && __tw(str + "…", size, mono) > o.maxW) str = str.slice(0, -1); str += "…"; }
    }
    if (!o.rotate) __recText(str, x, y, size, mono, o.align || "left", o.baseline || "alphabetic");
    return { w: __tw(str, size, mono), size: size };
  },
  stamp: function (s, x, y) { var w = __tw(s, 26, false) + 26; __rec("stamp", s, x - w / 2, y - 20, w, 40); },
  icon: function (n, x, y, s, o) {
    s = s || 32; o = o || {}; var cy = o.anchor === "bottom" ? y - s / 2 : y;
    __rec("sprite", "icon " + n, x - s / 2, cy - s / 2, s, s);
    if (o.label) D.text(o.label, x, cy + s / 2 + 13, { size: 11, align: "center" });
    return { w: s, h: s };
  },
  token: function (n, x, y, s, o) {
    s = s || 32; o = o || {}; __rec("sprite", "token " + n, x - s / 2, y - s / 2, s, s);
    if (o.caption !== false && n) D.text(o.label || String(n), x, y + s / 2 + 13, { size: 11, align: "center" });
    return { w: s, h: s };
  },
  person: function (x, y, h, o) {
    h = h || 40; o = o || {};
    __h(String(o.pose || ""), +o.t || 0);
    if (o.pose === "lie" || o.pose === "fall") __rec("sprite", "person", x - h * 0.2, y - h * 0.4, h * 1.1, h * 0.4);
    else __rec("sprite", "person", x - h * 0.3, y - h, h * 0.6, h);
    if (o.label) D.text(o.label, x, y + 14, { size: 11, align: "center" });
  },
  vessel: function (x, y, w, h, o) {
    o = o || {}; __h(+o.level || 0); __rec("vessel", o.kind || "beaker", x, y, w, h);
    if (o.label) D.text(o.label, x + w / 2, y + h + (o.kind === "cylinder" ? 22 : 18), { size: 12, align: "center", maxW: Math.max(w + 40, 60) });
    return { w: w, h: h };
  },
  layout: function (o) {
    o = o || {};
    var R = function (x, y, w, h) { return { x: x, y: y, w: w, h: h, cx: x + w / 2, cy: y + h / 2, r: x + w, b: y + h }; };
    var W = __state.W, H = __state.H, side = D.clamp(o.side == null ? 0.42 : o.side, 0, 0.7), gap = 18, x0 = 20, x1 = W - 14;
    var headH = o.header === false ? 0 : 28, footH = o.footer === false ? 0 : 20;
    var header = R(x0, 14, x1 - x0, headH), top = 14 + headH + 6, bottom = H - footH - 6, footer = R(x0, H - footH - 2, x1 - x0, footH);
    var bw = x1 - x0, bh = Math.max(40, bottom - top);
    if (side <= 0) return { header: header, stage: R(x0, top, bw, bh), side: null, footer: footer };
    if (W / H >= 1.15) { var sw = Math.round((bw - gap) * side); return { header: header, stage: R(x0, top, bw - gap - sw, bh), side: R(x1 - sw, top, sw, bh), footer: footer }; }
    var sh = Math.round((bh - gap) * side);
    return { header: header, stage: R(x0, top, bw, bh - gap - sh), side: R(x0, bottom - sh, bw, sh), footer: footer };
  },
  fmt: function (v, sig) {
    sig = sig || 3; v = +v; if (!isFinite(v)) return "–"; var a = Math.abs(v);
    if (a !== 0 && (a < 1e-3 || a >= 1e7)) return v.toExponential(Math.max(0, sig - 1)).replace("e+", "e");
    if (a >= 1000) return Math.round(v).toLocaleString("en-US");
    return String(+v.toPrecision(sig));
  },
  chem: function (s) { return String(s); },
  readouts: function (x, y, items, o) {
    o = o || {}; var size = o.size || 13, lh = size + 7, n = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i]; if (!it) continue;
      var a = Array.isArray(it) ? it : [String(it), ""], by = y + size + n * lh;
      if (o.w) {
        var vw = a[1] === "" || a[1] == null ? 0 : D.text(String(a[1]), x + o.w, by, { size: size, mono: true, align: "right", maxW: o.w * 0.6 }).w;
        D.text(a[0], x, by, { size: size - 1, maxW: Math.max(24, o.w - vw - 8) });
      } else D.text(a[1] === "" || a[1] == null ? a[0] : a[0] + ": " + a[1], x, by, { size: size, maxW: o.maxW });
      n++;
    }
    return n * lh;
  },
  chart: function (b, series, o) {
    o = o || {}; __h(o.upto == null ? 1 : +o.upto); __rec("chart", o.title || "chart", b.x, b.y, b.w, b.h);
    (series || []).forEach(function (s) { var d = s.data || [], last = d[d.length - 1]; __h(d.length, Array.isArray(last) ? +last[1] : +last); });
    var head = o.title ? 18 : 6, plot = { x: b.x + 40, y: b.y + head, w: Math.max(20, b.w - 48), h: Math.max(20, b.h - head - (o.xLabel ? 32 : 18)) };
    var n = 1, ymax = o.target == null ? 1e-9 : +o.target;
    (series || []).forEach(function (s) { (s.data || []).forEach(function (d) { var v = Array.isArray(d) ? +d[1] : +d; if (isFinite(v) && v > ymax) ymax = v; }); n = Math.max(n, (s.data || []).length - 1); });
    var x0 = o.xMin || 0, x1 = o.xMax == null ? n : +o.xMax, y0 = o.yMin || 0, y1 = o.yMax == null ? ymax * 1.08 : +o.yMax;
    return {
      X: function (v) { return plot.x + ((+v - x0) / ((x1 - x0) || 1)) * plot.w; },
      Y: function (v) { return plot.y + plot.h - ((+v - y0) / ((y1 - y0) || 1)) * plot.h; },
      plot: plot
    };
  },
  hasIcon: function () { return true; },
  lerp: function (a, b, t) { return a + (b - a) * t; },
  clamp: function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); },
  ease: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
};
var Bench = {
  D: D,
  init: function (o) { __state.opts = o; },
  metrics: function (m) { __state.metrics = m; },
  result: function (r) { if (!__state.result) __state.result = r; }
};
var console = { log: __noop, warn: __noop, error: __noop, info: __noop };
var performance = { now: function () { return __state.now; } };
var requestAnimationFrame = function () { return 0; }, cancelAnimationFrame = __noop;
var setTimeout = function () { return 0; }, clearTimeout = __noop, setInterval = function () { return 0; }, clearInterval = __noop;
var window = globalThis, self = globalThis, parent = globalThis;
var Path2D = function () { return __any; };
`;

const DRIVER = `
;(function () {
  var o = __state.opts;
  if (!o) throw new Error("the code never called Bench.init(...)");
  if (typeof o.draw !== "function") throw new Error("Bench.init needs a draw(D, p, dt, t) function");
  var p = Object.assign({}, o.params || {}, PARAMS), t = 0, snaps = [], runHash = [], runFrames = 0;
  function frame() {
    __state.rec = []; __state.fh = 0; __state.shapes = 0; __cs.tx = 0; __cs.ty = 0; __cs.odd = 0; __cs.stack = [];
    __state.now = t * 1000;
    o.draw(Bench.D, p, 1 / 30, t);
    t += 1 / 30;
  }
  function snap(view) { snaps.push({ W: __state.W, H: __state.H, view: view, rec: __state.rec, shapes: __state.shapes }); }
  __state.W = ${SIZES[0][0]}; __state.H = ${SIZES[0][1]};
  if (o.onParams) o.onParams(p);
  var stress = __state.metrics && +__state.metrics.stressRatio;
  for (var f = 0; f < 3; f++) frame();
  if (!__FAST) snap("before a test");
  if (!o.onRun) throw new Error("Bench.init needs an onRun(p) function");
  o.onRun(p);
  for (var g = 0; g < 400 && !__state.result; g++) {
    frame();
    if (g === 2) runHash[0] = __state.fh;
    else if (g > 2 && !__state.result) runHash[1] = __state.fh;
    runFrames = g + 1;
  }
  if (__state.result && !__FAST) {
    for (var h = 0; h < 3; h++) frame();
    snap("after a test");
    __state.W = ${SIZES[1][0]}; __state.H = ${SIZES[1][1]};
    frame(); snap("after a test");
    if (o.onParams) o.onParams(p);
    frame(); frame(); snap("before a test");
  }
  __state.snaps = snaps; __state.runHash = runHash; __state.runFrames = runFrames; __state.stress = stress;
})();
JSON.stringify({ result: __state.result, metrics: __state.metrics, snaps: __state.snaps, runHash: __state.runHash, runFrames: __state.runFrames, stress: __state.stress });`;

type Box = { k: "text" | "sprite" | "vessel" | "chart" | "stamp"; s: string; x: number; y: number; w: number; h: number };
type Snap = { W: number; H: number; view: string; rec: Box[] };

const inter = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const q = (b: Box) => (b.k === "text" ? `"${b.s.length > 40 ? b.s.slice(0, 40) + "…" : b.s}"` : b.k === "chart" ? `the chart` : b.k === "stamp" ? `the "${b.s}" stamp` : `the ${b.s}`);

/** Find text that collides with other text, sits on a sprite, straddles a chart, or runs off the canvas. */
export function lintLayout(snaps: Snap[]): string[] {
  // problem -> the canvas sizes / views it showed up in
  const found = new Map<string, Set<string>>();
  const add = (msg: string, at: string) => {
    if (!found.has(msg) && found.size >= 6) return;
    (found.get(msg) ?? found.set(msg, new Set()).get(msg)!).add(at);
  };
  for (const { W, H, view, rec } of snaps) {
    const at = `${W}x${H} ${view}`;
    const where = (b: Box) => `(spans x ${Math.round(b.x)}..${Math.round(b.x + b.w)}, y ${Math.round(b.y)}..${Math.round(b.y + b.h)} on a ${W}x${H} canvas)`;
    // the same thing drawn twice in one spot (redraws, double strokes) is not a collision
    const seen = new Set<string>();
    const items = rec.filter((b) => {
      const key = `${b.k}|${b.s}|${Math.round(b.x)}|${Math.round(b.y)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return b.w > 0 && b.h > 0;
    });
    for (const b of items) {
      const off = b.x < -2 ? "left" : b.x + b.w > W + 2 ? "right" : b.y < -2 ? "top" : b.y + b.h > H + 2 ? "bottom" : null;
      if (!off) continue;
      if (b.k === "text" || b.k === "stamp") add(`${q(b)} runs off the ${off} edge ${where(b)}`, at);
      else if (b.k === "chart" ? b.x < -4 || b.y < -4 || b.x + b.w > W + 4 || b.y + b.h > H + 4 : inter(b, { k: "chart", s: "", x: 0, y: 0, w: W, h: H }) < b.w * b.h * 0.75)
        add(`${q(b)} is partly outside the canvas ${where(b)}`, at);
    }
    const texts = items.filter((b) => b.k === "text");
    for (let i = 0; i < texts.length; i++)
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i], b = texts[j];
        if (inter(a, b) > 0.25 * Math.min(a.w * a.h, b.w * b.h)) add(`${q(a)} overlaps ${q(b)}`, at);
      }
    for (const t of texts)
      for (const s of items) if (s.k === "sprite" && inter(t, s) > 0.3 * Math.min(t.w * t.h, s.w * s.h)) add(`${q(t)} is drawn on top of ${q(s)}`, at);
    const solids = items.filter((b) => b.k === "sprite" || b.k === "vessel");
    for (const c of items.filter((b) => b.k === "chart")) {
      for (const s of solids) if (inter(c, s) > 0.3 * s.w * s.h) add(`${q(s)} is drawn on top of the chart`, at);
      // text fully inside the chart is an annotation; text straddling its edge is a collision
      for (const t of texts) {
        const i = inter(t, c);
        if (i > 0.15 * t.w * t.h && i < 0.9 * t.w * t.h) add(`${q(t)} sticks into the chart's edge`, at);
      }
    }
  }
  return [...found].map(([msg, ats]) => `${msg} (${[...ats].join("; ")})`);
}

type Raw = {
  result: { passed?: unknown; summary?: unknown; score?: unknown; metrics?: unknown } | null;
  metrics: { label?: string; stressRatio?: number } | null;
  snaps?: (Snap & { shapes: number })[];
  runHash?: number[];
  runFrames?: number;
  stress?: number;
};

/** Run the sim once in a fresh sandbox. fast = no layout snapshots (used for the dial sweep). */
function runOnce(code: string, params: Record<string, ParamValue>, fast: boolean): { ok: true; out: Raw } | { ok: false; error: string } {
  const head = `${PRELUDE}var __FAST = ${fast};\nvar PARAMS = ${JSON.stringify(params)};\n`;
  const offset = head.split("\n").length - 1; // lines before the AI's code
  try {
    const ctx = createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false }, microtaskMode: "afterEvaluate" });
    const json = new Script(`${head}${code}\n${DRIVER}`, { filename: "sim.js" }).runInContext(ctx, { timeout: 2500 });
    return { ok: true, out: JSON.parse(String(json)) };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).slice(0, 300);
    if (/timed out/i.test(msg)) return { ok: false, error: "the code ran too long (an infinite loop, or a simulation that is far too slow)" };
    const n = Number(String((e as Error)?.stack ?? "").match(/sim\.js:(\d+)/)?.[1] ?? 0) - offset;
    const text = n > 0 ? code.split("\n")[n - 1]?.trim().slice(0, 140) : "";
    return { ok: false, error: `runtime error: ${msg}${text ? ` at line ${n}: ${text}` : ""}` };
  }
}

/** What a test produced, minus the wording: used to tell whether a dial changed anything. */
function outcomeKey(out: Raw) {
  const round = (v: unknown): unknown =>
    typeof v === "number" ? +v.toPrecision(4) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : v;
  return JSON.stringify(round({ passed: out.result?.passed, score: out.result?.score, metrics: out.result?.metrics, stress: out.stress }));
}

const SWEEP_BUDGET_MS = 4000;

/**
 * Turn each dial to its extremes (min and max, the other select options, the toggle flipped) one at a time and re-run
 * the test. Catches dials the code ignores, crashes at the ends of a range, and pass rules that can never flip.
 */
function sweepDials(code: string, defaults: Record<string, ParamValue>, specs: ParamSpec[], base: Raw) {
  const issues: string[] = [];
  const started = Date.now();
  const baseKey = outcomeKey(base);
  const outcomes = new Set<boolean>([base.result?.passed === true]);
  let minStress = Number.isFinite(base.stress) ? (base.stress as number) : Infinity;
  const ignored: string[] = [];
  let crashes = 0;
  for (const p of specs) {
    // a dial that only shows in another mode can't change anything from the defaults
    if (p.showIf && defaults[p.showIf.key] !== p.showIf.equals) continue;
    const values: ParamValue[] =
      p.control === "toggle"
        ? [!p.default]
        : p.control === "select"
          ? (p.options ?? []).map((o) => o.value).filter((v) => v !== p.default).slice(0, 3)
          : [p.min, p.max].filter((v): v is number => typeof v === "number" && v !== p.default);
    let changed = values.length === 0;
    for (const v of values) {
      if (Date.now() - started > SWEEP_BUDGET_MS) return { issues, outcomes, minStress };
      const run = runOnce(code, { ...defaults, [p.key]: v }, true);
      const at = `with ${p.key} = ${JSON.stringify(v)}`;
      changed ||= !run.ok || !run.out.result;
      if (!run.ok) {
        if (crashes++ < 2) issues.push(`${at} the bench breaks: ${run.error}`);
        continue;
      }
      const r = run.out.result;
      if (!r) {
        if (crashes++ < 2) issues.push(`${at} RUN TEST never finishes (Bench.result is not called)`);
        continue;
      }
      if (typeof r.summary === "string" && /NaN|undefined|Infinity/.test(r.summary) && crashes++ < 2)
        issues.push(`${at} the result says "${r.summary.slice(0, 120)}": guard against dividing by zero or empty data at the ends of the range`);
      outcomes.add(r.passed === true);
      if (Number.isFinite(run.out.stress)) minStress = Math.min(minStress, run.out.stress as number);
      if (outcomeKey(run.out) !== baseKey) changed = true;
    }
    if (!changed) ignored.push(`${p.key} ("${p.label}")`);
  }
  // one dial at a time may never be enough to flip the verdict: also try everything low and everything high at once
  for (const end of ["min", "max"] as const) {
    if (outcomes.size > 1 || Date.now() - started > SWEEP_BUDGET_MS) break;
    const combo = { ...defaults };
    for (const p of specs) if (typeof p[end] === "number") combo[p.key] = p[end] as number;
    const run = runOnce(code, combo, true);
    if (run.ok && run.out.result) outcomes.add(run.out.result.passed === true);
  }
  if (ignored.length)
    issues.push(`turning ${ignored.join(", ")} from one end to the other changes nothing in the result, metrics or stressRatio: make each dial matter or remove it`);
  return { issues, outcomes, minStress };
}

/** Run the sim like a browser would. With the spec's params it also checks behaviour (animation, dials, pass rule). */
export function smokeRun(code: string, defaults: Record<string, ParamValue>, specs?: ParamSpec[]): SmokeResult {
  const run = runOnce(code, defaults, false);
  if (!run.ok) return run;
  const out = run.out;
  if (!out.metrics) return { ok: false, error: "onParams never called Bench.metrics({ stressRatio, label })" };
  const r = out.result;
  if (!r) return { ok: false, error: "RUN TEST never finished: Bench.result(...) was not called within 13 seconds of animation" };
  if (typeof r.passed !== "boolean" || typeof r.summary !== "string" || !r.summary.trim())
    return { ok: false, error: "Bench.result must get { passed: boolean, summary: string, ... }" };
  if (/NaN|undefined|Infinity/.test(r.summary)) return { ok: false, error: `the result summary contains NaN/undefined/Infinity: "${r.summary.slice(0, 160)}"` };
  const snaps = out.snaps ?? [];
  const drawn = snaps.flatMap((s) => s.rec).filter((b) => b.k === "text");
  const bad = drawn.find((b) => /\bNaN\b|undefined|Infinity|\[object Object\]/.test(b.s));
  if (bad) return { ok: false, error: `the drawing shows "${bad.s}": a value is NaN/undefined. Check every number is computed before it is drawn` };

  const behaviour: string[] = [];
  const secs = (out.runFrames ?? 0) / 30;
  if (secs < 1.5) behaviour.push(`the test finishes after ${secs.toFixed(1)} s: animate it for 3-6 s (use t from draw) before calling Bench.result`);
  else if (out.runHash?.length === 2 && out.runHash[0] === out.runHash[1])
    behaviour.push("nothing on the drawing moves or changes during the test: animate the real objects (levels, positions, the chart's upto) as the test runs");
  const done = snaps.find((s) => s.view === "after a test");
  if (done && done.rec.every((b) => b.k !== "sprite" && b.k !== "vessel") && done.shapes < 8)
    behaviour.push("the stage has no real objects, only text: draw the things being simulated with D.icon / D.vessel / D.person or simple shapes");
  if (specs?.length) {
    const swept = sweepDials(code, defaults, specs, out);
    behaviour.push(...swept.issues);
    // always passing is the usual sign of a lazy pass rule; always failing only counts if the gauge agrees nothing ever gets close
    if (swept.outcomes.size === 1 && (r.passed || swept.minStress >= 1))
      behaviour.push(
        `the test ${r.passed ? "PASSES" : "FAILS"} whatever the dials are set to (each dial was tried at its min and max): the pass rule must depend on the dials, e.g. compare the result with the target dial`,
      );
  }
  return { ok: true, result: r as never, metricsLabel: out.metrics.label, layout: lintLayout(snaps), behaviour: behaviour.slice(0, 6) };
}
