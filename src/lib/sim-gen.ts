import "server-only";
import { Script } from "node:vm";
import { generateText } from "ai";
import { iconHint } from "./icons";
import { CODEGEN_MODEL_ID, chatModel } from "./llm";
import { smokeRun } from "./sim-check";
import type { ParamSpec, SimDef } from "./sims";

/**
 * AI-built benches. The model writes a bench spec (dials, brief, pass rule) plus a small canvas script
 * against the same postMessage protocol and drawing kit the hand-built sims use (public/sims/bench.js).
 *
 * Reliability for a 27B open model comes from: one tight contract, one complete worked example,
 * strict parsing and clamping of the spec, a syntax check before saving, and a repair loop that
 * feeds real errors (syntax here, runtime from the browser) back to the model.
 */

export type GeneratedSim = { spec: Omit<SimDef, "id" | "src">; code: string };

const EXAMPLE_SPEC = {
  name: "Water Tank Bench",
  tagline: "Rooftop tank: inflow vs use, does it run dry?",
  brief:
    "A tank starts half full. Each minute it gains inflowLpm and loses useLpm litres, capped between empty and full. " +
    "A test PASSES when the level never drops below minPct of the tank. Score = lowest level %.",
  keywords: ["tank", "water", "borehole", "pump"],
  params: [
    { key: "tankL", label: "Tank size", control: "dial", min: 200, max: 5000, step: 50, unit: "L", default: 1000 },
    { key: "inflowLpm", label: "Pump inflow", control: "fader", min: 0, max: 40, step: 0.5, unit: "L/min", default: 8 },
    { key: "useLpm", label: "Household use", control: "fader", min: 0, max: 40, step: 0.5, unit: "L/min", default: 10 },
    { key: "hours", label: "Hours", control: "fader", min: 1, max: 24, step: 1, unit: "h", default: 6 },
    { key: "minPct", label: "Never below", control: "fader", min: 0, max: 60, step: 1, unit: "%", default: 10 },
  ],
};

const EXAMPLE_CODE = `let R = null, run = null;

function simulate(p) {
  const cap = +p.tankL, mins = Math.round(+p.hours * 60), series = [];
  let level = cap / 2, low = level;
  for (let m = 0; m <= mins; m++) {
    level = Math.min(cap, Math.max(0, level + +p.inflowLpm - +p.useLpm));
    low = Math.min(low, level);
    if (m % 5 === 0) series.push(level / cap);
  }
  return { series, lowPct: (low / cap) * 100 };
}

function update(p) {
  R = simulate(p);
  Bench.metrics({ stressRatio: Math.min(1.5, (+p.minPct || 1) / Math.max(1, R.lowPct)), label: "lowest level " + R.lowPct.toFixed(0) + "%" });
}

Bench.init({
  params: PARAMS,
  onParams(p) { run = null; update(p); },
  onRun(p) { update(p); run = { t0: null, done: false }; },
  draw(D, p, dt, t) {
    if (!R) update(p);
    const { C, W, H, ctx } = D;
    D.grid();
    if (run && run.t0 === null) run.t0 = t;
    const u = run ? Math.min(1, (t - run.t0) / 4) : 1;
    const i = Math.floor(u * (R.series.length - 1));
    const lvl = R.series[i];

    D.text("in " + p.inflowLpm + " L/min, out " + p.useLpm + " L/min, " + p.tankL + " L tank", 18, 28, { size: 14 });
    const tx = 50, ty = 70, tw = Math.min(160, D.W * 0.25), th = H - 120;
    D.rect(tx, ty, tw, th);
    ctx.fillStyle = C.blue; ctx.globalAlpha = 0.35;
    ctx.fillRect(tx + 3, ty + th - 3 - (th - 6) * lvl, tw - 6, (th - 6) * lvl);
    ctx.globalAlpha = 1;
    const minY = ty + th * (1 - +p.minPct / 100);
    D.line(tx - 10, minY, tx + tw + 10, minY, { color: C.red, dash: [5, 4], single: true });
    D.text(Math.round(lvl * 100) + "%", tx + tw / 2, ty - 10, { size: 16, align: "center", mono: true });
    D.icon("cloud-rain", tx + tw + 25, ty + 14, 24, { color: +p.inflowLpm > 0 ? C.blue : C.ink3 });
    D.person(tx + tw + 25, ty + th, 44, { pose: run && u < 1 ? "walk" : "stand", t, label: "use" });

    const gx = tx + tw + 50, gw = W - gx - 30;
    D.line(gx, ty + th, gx + gw, ty + th);
    D.line(gx, ty, gx, ty + th);
    ctx.strokeStyle = C.navy; ctx.lineWidth = 2; ctx.beginPath();
    for (let k = 0; k <= i; k++) {
      const x = gx + (k / (R.series.length - 1)) * gw, y = ty + th - R.series[k] * th;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();

    if (run && u >= 1 && !run.done) {
      run.done = true;
      const ok = R.lowPct >= +p.minPct;
      Bench.result({
        passed: ok,
        summary: p.tankL + " L tank, " + p.inflowLpm + " L/min in, " + p.useLpm + " L/min out for " + p.hours + " h: lowest level " + R.lowPct.toFixed(0) + "%.",
        failureReason: ok ? undefined : "level fell below " + p.minPct + "%",
        score: ok ? Math.round(R.lowPct) : undefined,
        scoreLabel: "lowest level %",
        metrics: { lowPct: Math.round(R.lowPct) },
      });
    }
    if (run && run.done) D.stamp(R.lowPct >= +p.minPct ? "PASSED" : "RAN DRY", W / 2 + 60, 70, R.lowPct >= +p.minPct ? C.green : C.red);
    if (!run) D.text("(projection: press RUN TEST)", 18, H - 12, { size: 11, color: C.ink3 });
  },
});`;

const SYSTEM = `You build small interactive simulations ("benches") for Playbook, an engineering notebook app.
Reply with EXACTLY two fenced code blocks and nothing else: first \`\`\`json (the bench spec), then \`\`\`js (the sim code).

## Spec (json)
{"name": "<Thing> Bench" (max 40 chars), "tagline": "max 60 chars", "keywords": ["3-8 words"],
 "brief": "2-4 sentences: the model and equations with units, EXACTLY when a test passes, and what the score means",
 "params": [3 to 9 controls]}
Each param: {"key": camelCase, "label": short, "control": "dial"|"fader"|"toggle"|"select", "default": value,
 numbers only for dial/fader: "min", "max", "step", "unit"; select only: "options": [{"value": "string", "label": "..."}]}
Use a dial for the 1-3 most important numbers, faders for other numbers, toggles for on/off, selects for 2-5 choices.
Always include a target or limit dial so a test can pass or fail.

## Code (js)
Runs in a sandboxed iframe with one full-size <canvas>. Available globals: PARAMS (the defaults) and Bench. No DOM, no fetch, no libraries, no imports.
Call Bench.init exactly once:
Bench.init({ params: PARAMS, onParams(p) {...}, onRun(p) {...}, draw(D, p, dt, t) {...} })
- p holds the current dial values. Numbers can arrive as strings, so always use +p.key for numbers. Select values are strings. Toggles are booleans.
- onParams(p): recompute a projection and call Bench.metrics({ stressRatio, label }). stressRatio is 0..1.5, >= 1 means it would fail. label is one short line.
- onRun(p): start an animated test that lasts 3-6 seconds (t is seconds). When it ends, call Bench.result exactly once:
  { passed, summary: "one sentence with the settings and the outcome, with numbers and units", failureReason: "why it failed" (omit if passed),
    score: number where higher is better (when passed), scoreLabel: "what the score measures", metrics: { name: number } }
- draw(D, p, dt, t): runs every frame. Start with D.grid(). Draw the real thing as a simple hand-drawn line diagram, animate it during a test,
  show the key numbers, and when the test is done call D.stamp("SHORT VERDICT", x, y, color).
Drawing kit: D.W, D.H (canvas px), D.C colors {ink, ink2, ink3, navy, red, blue, amber, green, paper, fill}, D.ctx (2D context),
D.grid(), D.line(x1,y1,x2,y2,{color,width,dash,single}), D.rect(x,y,w,h,{fill,hatch,color}), D.circle(cx,cy,r,{fill,color}),
D.text(str,x,y,{size,color,align:"left"|"center"|"right",mono}), D.dim(x1,y1,x2,y2,label), D.stamp(text,x,y,color), D.ground(x1,x2,y),
D.lerp(a,b,u), D.clamp(v,lo,hi), D.ease(u), D.rng(seed) returns a function giving 0..1 (use it instead of Math.random for anything simulated).
Sprites (use them like game assets: draw the real objects of the problem and move them during a test, instead of plain boxes):
- D.icon(name, x, y, size, {color, flip, rotate, label, anchor:"bottom"}): an object from the icon pack, x,y = centre (or bottom-centre), size = height px.
  Only use names from the icon list given with the request. An unknown name just draws a labelled circle.
- D.person(x, y, h, {pose:"stand"|"walk"|"run"|"wave"|"sit"|"carry"|"lie"|"fall", t, facing:1|-1, label}): a stick figure standing at x,y. Use it for every human.
- D.token(label, x, y, size): a labelled circle for anything with no fitting icon.
Fit everything to D.W x D.H, keep text >= 11px, and keep the code under 220 lines. Use real, simple physics or maths. Name it in the brief.

## Complete example
\`\`\`json
${JSON.stringify(EXAMPLE_SPEC, null, 1)}
\`\`\`
\`\`\`js
${EXAMPLE_CODE}
\`\`\``;

function stripThinking(text: string) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

function extract(text: string) {
  const clean = stripThinking(text);
  const json = clean.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const js = clean.match(/```(?:javascript|js)\b\s*([\s\S]*?)```/i)?.[1]; // \b so ```json doesn't match
  if (!json) throw new Error("no ```json spec block in the reply");
  if (!js) throw new Error("no ```js code block in the reply");
  let spec: unknown;
  try {
    spec = JSON.parse(json);
  } catch (e) {
    throw new Error(`spec is not valid JSON: ${e instanceof Error ? e.message : e}`);
  }
  return { spec, code: js.trim() };
}

const str = (v: unknown, max: number, fallback = "") => (typeof v === "string" ? v.trim().slice(0, max) : fallback);
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN);

/** Clamp whatever the model produced into a valid bench spec, or explain what's wrong. */
export function validateSpec(raw: unknown): GeneratedSim["spec"] {
  if (!raw || typeof raw !== "object") throw new Error("spec must be a JSON object");
  const r = raw as Record<string, unknown>;
  const name = str(r.name, 40) || "Custom Bench";
  const rawParams = Array.isArray(r.params) ? r.params : [];
  const seen = new Set<string>();
  const params: ParamSpec[] = [];
  for (const p0 of rawParams.slice(0, 10)) {
    const p = p0 as Record<string, unknown>;
    const key = str(p.key, 32).replace(/[^a-zA-Z0-9_]/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const label = str(p.label, 32) || key;
    const control = ["dial", "fader", "toggle", "select"].includes(p.control as string) ? (p.control as ParamSpec["control"]) : "fader";
    if (control === "toggle") {
      params.push({ key, label, control, default: p.default === true || p.default === "true" });
    } else if (control === "select") {
      const options = (Array.isArray(p.options) ? p.options : [])
        .map((o) => (typeof o === "object" && o ? { value: String((o as { value: unknown }).value), label: str((o as { label: unknown }).label, 30) || String((o as { value: unknown }).value) } : { value: String(o), label: String(o) }))
        .slice(0, 6);
      if (options.length < 2) continue;
      const def = options.find((o) => o.value === String(p.default))?.value ?? options[0].value;
      params.push({ key, label, control, options, default: def });
    } else {
      let min = num(p.min), max = num(p.max);
      if (!Number.isFinite(min)) min = 0;
      if (!Number.isFinite(max) || max <= min) max = min + 100;
      let step = num(p.step);
      if (!Number.isFinite(step) || step <= 0 || step > max - min) step = (max - min) / 100;
      let def = num(p.default);
      if (!Number.isFinite(def)) def = min + (max - min) / 2;
      def = Math.min(max, Math.max(min, def));
      params.push({ key, label, control, min, max, step: +step.toPrecision(3), unit: str(p.unit, 12) || undefined, default: def });
    }
  }
  if (params.length < 2) throw new Error("spec needs at least 2 valid params");
  return {
    name: /bench$/i.test(name) ? name : `${name} Bench`.slice(0, 46),
    tagline: str(r.tagline, 70) || "Built by AI for you",
    brief: str(r.brief, 900) || "AI-generated bench.",
    keywords: (Array.isArray(r.keywords) ? r.keywords : []).map((k) => String(k).toLowerCase().slice(0, 24)).slice(0, 10),
    params,
  };
}

/** Cheap static checks before the code ever reaches a browser. */
export function checkCode(code: string, spec: GeneratedSim["spec"]) {
  try {
    // Compiles only; never runs. Catches syntax errors and tells the model which line.
    new Script(`(function (Bench, PARAMS) {\n${code}\n})`, { filename: "sim.js" });
  } catch (e) {
    const lineNo = Number(String((e as Error).stack ?? "").match(/sim\.js:(\d+)/)?.[1] ?? 0) - 1;
    const line = lineNo > 0 ? code.split("\n")[lineNo - 1]?.trim().slice(0, 160) : "";
    throw new Error(`syntax error: ${e instanceof Error ? e.message : e}${line ? ` on line ${lineNo}: ${line}` : ""}`);
  }
  if (!/Bench\.init\s*\(/.test(code)) throw new Error("the code never calls Bench.init(...)");
  if (!/Bench\.result\s*\(/.test(code)) throw new Error("the code never calls Bench.result(...) at the end of a test");
  if (/\b(fetch|XMLHttpRequest|WebSocket|importScripts|document\.cookie|localStorage)\b/.test(code))
    throw new Error("the code uses network or storage APIs, which are not allowed");
  const missing = spec.params.filter((p) => !code.includes(p.key)).map((p) => p.key);
  if (missing.length > spec.params.length / 2) throw new Error(`the code ignores most dials (${missing.join(", ")})`);
}

type GenInput =
  | { mode: "create"; request: string; context?: string }
  | { mode: "repair" | "revise"; base: GeneratedSim; error?: string; change?: string };

function userPrompt(input: GenInput) {
  if (input.mode === "create") {
    return (
      `Build a bench for this request:\n"""${input.request.slice(0, 1200)}"""\n` +
      (input.context ? `\nWhat we know about the person (use it for sensible defaults and targets):\n${input.context.slice(0, 1200)}\n` : "") +
      `\n${iconHint(input.request)}`
    );
  }
  const current = "```json\n" + JSON.stringify(input.base.spec, null, 1) + "\n```\n```js\n" + input.base.code + "\n```";
  const icons = iconHint(`${input.base.spec.name} ${input.base.spec.keywords.join(" ")} ${input.change ?? ""}`);
  if (input.mode === "repair")
    return `This bench crashed or misbehaved:\n${input.error}\n\nCurrent bench:\n${current}\n\nFix the problem. Keep the same idea and dial keys unless a dial is the cause. Reply with the full corrected json and js blocks.\n${icons}`;
  return `Change this bench as requested: "${(input.change ?? "").slice(0, 800)}"\n\nCurrent bench:\n${current}\n\nReply with the full updated json and js blocks.\n${icons}`;
}

/**
 * Second opinion on the numbers. Generated sims usually run fine but get units wrong (mm vs m, kg vs N), so a
 * separate short call hand-checks the sim's own reported result for its default settings.
 * Returns null when plausible, or a one-line description of what's wrong.
 */
async function physicsReview(spec: GeneratedSim["spec"], defaults: Record<string, unknown>, summary: string, metrics: unknown) {
  try {
    const { text } = await generateText({
      model: chatModel(CODEGEN_MODEL_ID),
      temperature: 0,
      maxRetries: 4,
      maxOutputTokens: 400,
      system:
        "You check simulation results for physical and mathematical plausibility with a quick back-of-envelope calculation for the given settings. " +
        "Be terse: at most 5 short plain-text lines of arithmetic, no LaTeX, no markdown, no headings. " +
        'The LAST line must be exactly "VERDICT: OK" or "VERDICT: WRONG - <roughly what the key number should be, and the likely bug, e.g. a unit mix-up>". ' +
        "Only say WRONG if the key number is off by more than 3x (a unit or formula bug). Differences under 3x are OK, " +
        "and so is a pass/fail that flips because the value is close to the target. Never say WRONG just because your own estimate differs a little.",
      prompt: `Bench: ${spec.name}\nModel: ${spec.brief}\nSettings: ${JSON.stringify(defaults)}\nThe simulation reported: ${summary}\nMetrics: ${JSON.stringify(metrics ?? {})}`,
    });
    const verdict = stripThinking(text).match(/VERDICT:\s*(OK|WRONG[^\n]*)/i)?.[1] ?? "OK";
    return /^WRONG/i.test(verdict) ? verdict.replace(/^WRONG\s*[-:]\s*/i, "").slice(0, 400) : null;
  } catch (e) {
    console.warn("[sim-gen] physics review skipped:", e instanceof Error ? e.message : e);
    return null; // a reviewer outage shouldn't block building
  }
}

/** Generate (or repair / revise) a bench. Retries with the concrete error up to `attempts` times. */
export async function generateSim(input: GenInput, attempts = 3): Promise<GeneratedSim & { attempts: number; errors: string[]; check?: string }> {
  const errors: string[] = [];
  const messages: { role: "user" | "assistant"; content: string }[] = [{ role: "user", content: userPrompt(input) }];
  let reviewed = false;
  for (let i = 0; i < attempts; i++) {
    const { text } = await generateText({
      model: chatModel(CODEGEN_MODEL_ID),
      system: SYSTEM,
      messages,
      temperature: i === 0 ? 0.3 : 0.2,
      maxRetries: 5,
      maxOutputTokens: 8000,
    });
    try {
      const { spec: raw, code } = extract(text);
      const spec = validateSpec(raw);
      checkCode(code, spec);
      const defaults = Object.fromEntries(spec.params.map((p) => [p.key, p.default]));
      const smoke = smokeRun(code, defaults);
      if (!smoke.ok) throw new Error(smoke.error);
      // One physics review per build (it costs a model call; the free tier is tight).
      if (!reviewed) {
        reviewed = true;
        const wrong = await physicsReview(spec, defaults, smoke.result.summary, smoke.result.metrics);
        if (wrong && i < attempts - 1) throw new Error(`a physics check of the default settings says the numbers are wrong: ${wrong}`);
      }
      return { spec, code, attempts: i + 1, errors, check: smoke.result.summary };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
      console.warn("[sim-gen] attempt", i + 1, "failed:", msg, "| reply starts:", stripThinking(text).slice(0, 300).replace(/\s+/g, " "));
      messages.push({ role: "assistant", content: stripThinking(text).slice(0, 12000) });
      messages.push({ role: "user", content: `That didn't work: ${msg}. Reply again with the complete corrected json and js blocks.` });
    }
  }
  throw new Error(`Couldn't build a working bench after ${attempts} tries: ${errors.at(-1)}`);
}
