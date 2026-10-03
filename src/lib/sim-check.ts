import "server-only";
import { createContext, Script } from "node:vm";
import type { ParamValue } from "./sims";

/**
 * Headless smoke test for an AI-written sim, before anyone sees it.
 *
 * Runs the script in a Node vm with a fake canvas (every drawing call is a no-op), a fake clock and a hard
 * CPU timeout, then drives it like the browser would: init -> onParams -> RUN TEST -> ~13 s of frames.
 * It must start, publish metrics and report a result. Crashes and infinite loops fail here instead of in a
 * person's browser, and the reported numbers feed the physics review in sim-gen.ts.
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
    }
  | { ok: false; error: string };

const PRELUDE = `
var __state = { opts: null, result: null, metrics: null, now: 0 };
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
var Bench = {
  D: {
    W: 820, H: 480, ctx: __any, rng: __rng, hash: function () { return 1; },
    C: { ink: "#000", ink2: "#333", ink3: "#888", navy: "#228", red: "#d33", blue: "#06c", amber: "#c80", green: "#282", paper: "#fff", fill: "#eee", minor: "#eee", major: "#ddd" },
    grid: __noop, line: __noop, rect: __noop, circle: __noop, hatch: __noop, text: __noop, dim: __noop, stamp: __noop, ground: __noop,
    icon: function (_n, _x, _y, s) { return { w: s || 32, h: s || 32 }; }, token: function (_n, _x, _y, s) { return { w: s || 32, h: s || 32 }; },
    person: __noop, hasIcon: function () { return true; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    clamp: function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); },
    ease: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  },
  init: function (o) { __state.opts = o; },
  metrics: function (m) { __state.metrics = m; },
  result: function (r) { if (!__state.result) __state.result = r; }
};
var console = { log: __noop, warn: __noop, error: __noop, info: __noop };
var performance = { now: function () { return __state.now; } };
var requestAnimationFrame = function () { return 0; }, cancelAnimationFrame = __noop;
var setTimeout = function () { return 0; }, clearTimeout = __noop, setInterval = function () { return 0; }, clearInterval = __noop;
var window = globalThis, self = globalThis, parent = globalThis;
`;

const DRIVER = `
;(function () {
  var o = __state.opts;
  if (!o) throw new Error("the code never called Bench.init(...)");
  if (typeof o.draw !== "function") throw new Error("Bench.init needs a draw(D, p, dt, t) function");
  var p = Object.assign({}, PARAMS);
  if (o.onParams) o.onParams(p);
  var t = 0;
  for (var f = 0; f < 400 && !__state.result; f++) {
    if (f === 3) { if (!o.onRun) throw new Error("Bench.init needs an onRun(p) function"); o.onRun(p); }
    __state.now = t * 1000;
    o.draw(Bench.D, p, 1 / 30, t);
    t += 1 / 30;
  }
})();
JSON.stringify({ result: __state.result, metrics: __state.metrics });`;

export function smokeRun(code: string, defaults: Record<string, ParamValue>): SmokeResult {
  const head = `${PRELUDE}var PARAMS = ${JSON.stringify(defaults)};\n`;
  const offset = head.split("\n").length - 1; // lines before the AI's code
  let out: { result: unknown; metrics: { label?: string } | null };
  try {
    const ctx = createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false }, microtaskMode: "afterEvaluate" });
    const json = new Script(`${head}${code}\n${DRIVER}`, { filename: "sim.js" }).runInContext(ctx, { timeout: 1500 });
    out = JSON.parse(String(json));
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).slice(0, 300);
    if (/timed out/i.test(msg)) return { ok: false, error: "the code ran too long (an infinite loop, or a simulation that is far too slow)" };
    const n = Number(String((e as Error)?.stack ?? "").match(/sim\.js:(\d+)/)?.[1] ?? 0) - offset;
    const text = n > 0 ? code.split("\n")[n - 1]?.trim().slice(0, 140) : "";
    return { ok: false, error: `runtime error: ${msg}${text ? ` at line ${n}: ${text}` : ""}` };
  }
  if (!out.metrics) return { ok: false, error: "onParams never called Bench.metrics({ stressRatio, label })" };
  const r = out.result as { passed?: unknown; summary?: unknown } | null;
  if (!r) return { ok: false, error: "RUN TEST never finished: Bench.result(...) was not called within 13 seconds of animation" };
  if (typeof r.passed !== "boolean" || typeof r.summary !== "string" || !r.summary.trim())
    return { ok: false, error: "Bench.result must get { passed: boolean, summary: string, ... }" };
  if (/NaN|undefined|Infinity/.test(r.summary)) return { ok: false, error: `the result summary contains NaN/undefined/Infinity: "${r.summary.slice(0, 160)}"` };
  return { ok: true, result: r as never, metricsLabel: out.metrics.label };
}
