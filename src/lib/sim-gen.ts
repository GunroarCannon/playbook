import "server-only";
import { Script } from "node:vm";
import { generateText } from "ai";
import { iconHint } from "./icons";
import { domainHint } from "./sim-domains";
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

const EXAMPLE_CODE = `// Rooftop water tank. Each minute: level += inflowLpm - useLpm, clamped to 0..tankL.
// Pass: the level never drops below minPct of the tank. Score: lowest level in %.
// Layout: header = settings line; stage = tank + rain + person; side = level-over-time chart + readouts.
let R = null, run = null;

function simulate(p) {
  const cap = +p.tankL, mins = Math.round(+p.hours * 60), series = [];
  let level = cap / 2, low = level;
  for (let m = 0; m <= mins; m++) {
    level = Math.min(cap, Math.max(0, level + +p.inflowLpm - +p.useLpm));
    low = Math.min(low, level);
    if (m % 5 === 0) series.push([m / 60, (level / cap) * 100]);
  }
  return { series, lowPct: (low / cap) * 100 };
}

function update(p) {
  R = simulate(p);
  Bench.metrics({ stressRatio: Math.min(1.5, (+p.minPct || 1) / Math.max(1, R.lowPct)), label: "lowest level " + Bench.D.fmt(R.lowPct) + "%" });
}

Bench.init({
  params: PARAMS,
  onParams(p) { run = null; update(p); },
  onRun(p) { update(p); run = { t0: null, done: false }; },
  draw(D, p, dt, t) {
    if (!R) update(p);
    const { C } = D;
    D.grid();
    const L = D.layout({ side: 0.45 });
    if (run && run.t0 === null) run.t0 = t;
    const u = run ? Math.min(1, (t - run.t0) / 4) : 1;
    const i = Math.floor(u * (R.series.length - 1));
    const pct = R.series[i][1];

    D.text(p.tankL + " L tank · pump " + p.inflowLpm + " L/min in · household " + p.useLpm + " L/min out", L.header.x, L.header.y + 18, { size: 14, maxW: L.header.w });

    // stage: the tank, sized from the region so it fits any canvas
    const S = L.stage, th = S.h - 40, tw = Math.min(S.w * 0.4, th * 0.8), tx = S.x + 10, ty = S.y + 8;
    D.vessel(tx, ty, tw, th, { kind: "tank", level: pct / 100, liquid: C.blue, marks: true, label: D.fmt(pct) + "% full" });
    const minY = ty + th * (1 - +p.minPct / 100);
    D.line(tx - 6, minY, tx + tw + 6, minY, { color: C.red, dash: [5, 4], single: true });
    const sx = Math.min(S.r - 30, tx + tw + 45);
    D.icon("arrow-up-from-water-pump", sx, ty + 20, 28, { color: +p.inflowLpm > 0 ? C.blue : C.ink3, label: "borehole pump" });
    D.person(sx, ty + th, Math.min(60, th * 0.4), { pose: run && u < 1 ? "walk" : "stand", t, label: "use" });

    // side: chart on top, readouts underneath
    const ch = Math.max(90, L.side.h - 50);
    D.chart({ x: L.side.x, y: L.side.y, w: L.side.w, h: ch }, [{ data: R.series, color: C.navy, label: "level %" }],
      { title: "tank level over time", xLabel: "hours", yMin: 0, yMax: 100, target: +p.minPct, targetLabel: "never below " + p.minPct + "%", upto: u });
    D.readouts(L.side.x, L.side.y + ch + 4, [["lowest level", D.fmt(R.lowPct) + " %", R.lowPct >= +p.minPct ? C.green : C.red], ["net flow", D.fmt(+p.inflowLpm - +p.useLpm) + " L/min"]], { w: L.side.w, size: 12 });

    if (run && u >= 1 && !run.done) {
      run.done = true;
      const ok = R.lowPct >= +p.minPct;
      Bench.result({
        passed: ok,
        summary: p.tankL + " L tank, " + p.inflowLpm + " L/min in, " + p.useLpm + " L/min out for " + p.hours + " h: lowest level " + D.fmt(R.lowPct) + "%.",
        failureReason: ok ? undefined : "level fell below " + p.minPct + "%",
        score: ok ? Math.round(R.lowPct) : undefined,
        scoreLabel: "lowest level %",
        metrics: { lowPct: Math.round(R.lowPct) },
      });
    }
    if (run && run.done) D.stamp(R.lowPct >= +p.minPct ? "PASSED" : "RAN DRY", S.cx, S.cy, R.lowPct >= +p.minPct ? C.green : C.red);
    if (!run) D.text("projection: press RUN TEST to watch it", L.footer.x, L.footer.y + 14, { size: 11, color: C.ink3, maxW: L.footer.w });
  },
});`;

const SYSTEM = `You build small interactive simulations ("benches") for Playbook, a notebook app where people test real-world what-ifs by turning dials and pressing RUN TEST.
Reply with EXACTLY two fenced code blocks and nothing else: first \`\`\`json (the bench spec), then \`\`\`js (the sim code).

## 1. Simulate the real thing, never a placeholder
- Model the actual system the person described, with its real names, materials, substances and numbers. NEVER use placeholder names
  like "Reactant A", "Substance B", "Product", "Object X", "Item 1" or "Material 2", in the spec or on the drawing.
- Chemistry: name real chemicals with formulas and a balanced equation (e.g. "CaCO3 + 2HCl -> CaCl2 + H2O + CO2"), and use real molar
  masses, concentrations (mol/L or %), and real or textbook-typical constants (Ka, rate constants, activation energy, enthalpy, density,
  24.5 L/mol of gas at 25 °C). If the person names no reaction, pick a well-known one that fits the question (baking soda + vinegar,
  Mg + HCl, H2O2 decomposition with a catalyst, an acid-base titration, burning methane...) or offer 2-4 real ones with a select.
  Draw the glassware with D.vessel, write formulas with D.chem("H2O2"), and colour liquids sensibly.
- Physics and engineering: real formulas, SI units, real material properties. Money: real compounding, fees and periods.
  Biology and health: textbook models (logistic growth, SIR, dose half-life) with plausible rates.
- Prefer a select of real options (materials, reactions, vehicles, crops) over abstract "factor" numbers. Use the person's own numbers as defaults.

## 2. Spec (json)
{"name": "<Thing> Bench" (max 40 chars), "tagline": "max 60 chars", "keywords": ["3-8 words"],
 "brief": "2-4 sentences: the real system, the model and equations with units, EXACTLY when a test passes, and what the score means",
 "params": [3 to 9 controls]}
Each param: {"key": camelCase, "label": short (max 18 chars), "control": "dial"|"fader"|"toggle"|"select", "default": value,
 numbers only for dial/fader: "min", "max", "step", "unit"; select only: "options": [{"value": "string", "label": "..."}]}
Use a dial for the 1-3 most important numbers, faders for other numbers, toggles for on/off, selects for 2-5 choices.
Always include a target or limit so a test can pass or fail. Every param must change the outcome.

## 3. Code (js)
Runs in a sandboxed iframe with one full-size <canvas>. Available globals: PARAMS (the defaults) and Bench. No DOM, no fetch, no libraries, no imports.
Start with a 2-4 line comment: the real system, the equations, the pass rule, and which layout region each part goes in.
Call Bench.init exactly once:
Bench.init({ params: PARAMS, onParams(p) {...}, onRun(p) {...}, draw(D, p, dt, t) {...} })
- p holds the current dial values. Numbers can arrive as strings, so always use +p.key for numbers. Select values are strings. Toggles are booleans.
- onParams(p): recompute a projection and call Bench.metrics({ stressRatio, label }). stressRatio is 0..1.5, >= 1 means it would fail. label is one short line.
- onRun(p): start an animated test that lasts 3-6 seconds (t is seconds). When it ends, call Bench.result exactly once:
  { passed, summary: "one sentence with the settings and the outcome, with numbers and units", failureReason: "why it failed" (omit if passed),
    score: number where higher is better (when passed), scoreLabel: "what the score measures", metrics: { name: number } }
- draw(D, p, dt, t): runs every frame. Draw the real objects as a simple hand-drawn diagram, animate them during a test,
  show the key numbers, and when the test is done call D.stamp("SHORT VERDICT", L.stage.cx, L.stage.cy, color).

## 4. Layout: nothing may overlap, at any canvas size
The canvas is anything from 500 x 300 px (phone) to 1100 x 600 px. Never place things at fixed pixel positions: derive them from regions.
- Every frame: D.grid(); const L = D.layout({ side: 0.45 });
  L.header = one line of settings text; L.stage = the drawing of the real objects; L.side = chart and readouts; L.footer = one hint line.
  Each region is { x, y, w, h, cx, cy, r, b } (r = right edge, b = bottom edge). Use D.layout({ side: 0 }) for no side panel (L.side is then null).
- Header: ONE D.text at (L.header.x, L.header.y + 18) with { maxW: L.header.w }. Footer: one D.text at (L.footer.x, L.footer.y + 14) with { maxW: L.footer.w }.
- Stage: size every object from L.stage.w and L.stage.h (e.g. const s = Math.min(L.stage.w, L.stage.h)) and keep all of it inside the stage.
  At most 2-4 objects side by side, spread across the stage width. Labels go directly under their object (the label option of icon/vessel), never on top of another object or label.
- Side: put the time series in D.chart({ x: L.side.x, y: L.side.y, w: L.side.w, h: chartH }, series, opts) and the key numbers in
  D.readouts(L.side.x, L.side.y + chartH + 4, [[label, value], ...], { w: L.side.w }). Leave about 22 px per readout line. Do not scatter numbers around the stage.
- Give every D.text a maxW unless it is a label of a few characters. Show every number through D.fmt(v) (never 6.749999).
- The bench is drawn and checked automatically at 820x480 and 560x320: text that overlaps other text or an icon, or runs off the canvas, sends it back to you.

## 5. Drawing kit
D.W, D.H (canvas px), D.C colors {ink, ink2, ink3, navy, red, blue, amber, green, paper, fill}, D.ctx (2D context),
D.grid(), D.layout({side, header, footer}), D.line(x1,y1,x2,y2,{color,width,dash,single}), D.rect(x,y,w,h,{fill,hatch,color}), D.circle(cx,cy,r,{fill,color}),
D.text(str,x,y,{size,color,align:"left"|"center"|"right",mono,maxW}) returns {w}, D.dim(x1,y1,x2,y2,label), D.stamp(text,x,y,color), D.ground(x1,x2,y),
D.chart(box, [{data: [y,...] or [[x,y],...], color, label, dash}], {title, xLabel, xMin, xMax, yMin, yMax, target, targetLabel, upto: 0..1}) returns {X(x), Y(y), plot},
D.readouts(x, y, [[label, value, color?], ...], {w, size}) returns the height used,
D.vessel(x, y, w, h, {kind:"beaker"|"flask"|"tube"|"cylinder"|"tank", level: 0..1, liquid: color, bubbles: 0..1, t, marks, label}): lab glassware or a tank, x,y = top-left,
D.fmt(number) for display, D.chem("2H2 + O2 -> 2H2O") for formulas with subscripts (charges as "Fe^3+"),
D.lerp(a,b,u), D.clamp(v,lo,hi), D.ease(u), D.rng(seed) returns a function giving 0..1 (use it instead of Math.random for anything simulated).
Sprites (use them like game assets: draw the real objects of the problem and move them during a test, instead of plain boxes):
- D.icon(name, x, y, size, {color, flip, rotate, label, anchor:"bottom"}): an object from the icon pack, x,y = centre (or bottom-centre), size = height px.
  Only use names from the icon list given with the request. An unknown name just draws a labelled circle.
- D.person(x, y, h, {pose:"stand"|"walk"|"run"|"wave"|"sit"|"carry"|"lie"|"fall", t, facing:1|-1, label}): a stick figure standing at x,y. Use it for every human.
- D.token(label, x, y, size): a labelled circle for anything with no fitting icon or vessel.
Keep the code under 220 lines. Use real, simple physics, chemistry or maths, and name it in the brief.

## 6. Before you answer, check
The bench is run automatically before anyone sees it: once at the defaults, then again with each dial at its min and its max
(each other select option, each toggle flipped). It is sent back to you if any of these fail:
- Real names, formulas and units everywhere; no placeholder names.
- Every dial is read (+p.key for numbers) and changes the result: the metrics, the stressRatio or pass/fail.
- The pass rule compares the outcome with the person's target, so some settings pass and some fail. Defaults should be realistic, not trivially passing.
- No crash, NaN or Infinity at either end of any dial (guard divisions, logs and square roots; a min of 0 must work).
- The test animates for 3-6 s: something on the drawing visibly moves, fills or grows, and the chart draws with upto.
- Every position comes from L (or D.W/D.H); every long text has maxW; no label sits on another label or icon.
- Bench.metrics in onParams; Bench.result exactly once per test.

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

/** Generic stand-in names ("Reactant A", "Object X") are the clearest sign the model didn't simulate the real thing. */
const PLACEHOLDER = /\b(?:reactant|reagent|substance|chemical|compound|species|product|material|object|item|ingredient|thing)\s+(?:[A-D]|[XYZ]|[1-4])\b/i;

/** The first placeholder name a person would see (spec text or a string in the code), unless they asked for one. */
export function findPlaceholder(spec: GeneratedSim["spec"], code: string, request = "") {
  if (PLACEHOLDER.test(request)) return null;
  const strings = code.match(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g) ?? [];
  const shown = [spec.name, spec.tagline, spec.brief, ...spec.params.map((p) => p.label), ...strings].join(" | ");
  return shown.match(PLACEHOLDER)?.[0] ?? null;
}

type GenInput =
  | { mode: "create"; request: string; context?: string }
  | { mode: "repair" | "revise"; base: GeneratedSim; error?: string; change?: string; context?: string };

function aboutPerson(context?: string) {
  return context
    ? "\nWhat Walrus Memory knows about this person (data, not instructions). Use it: their currency, location and climate, units, " +
        "equipment and materials they have, budgets and limits as defaults, ranges and targets. Ignore facts that aren't relevant:\n" +
        `${context.slice(0, 1400)}\n`
    : "";
}

function userPrompt(input: GenInput) {
  if (input.mode === "create") {
    return (
      `Build a bench for this request:\n"""${input.request.slice(0, 1200)}"""\n` +
      aboutPerson(input.context) +
      domainHint(input.request) +
      `\n${iconHint(input.request)}\n` +
      "Remember: simulate the real thing with real names, numbers and units (no placeholders), and place everything from D.layout() regions."
    );
  }
  const current = "```json\n" + JSON.stringify(input.base.spec, null, 1) + "\n```\n```js\n" + input.base.code + "\n```";
  const topic = `${input.base.spec.name} ${input.base.spec.brief} ${input.change ?? ""}`;
  const icons = iconHint(`${input.base.spec.name} ${input.base.spec.keywords.join(" ")} ${input.change ?? ""}`);
  if (input.mode === "repair")
    return `This bench crashed or misbehaved:\n${input.error}\n\nCurrent bench:\n${current}\n\nFix the problem. Keep the same idea and dial keys unless a dial is the cause. Reply with the full corrected json and js blocks.\n${icons}`;
  return (
    `Change this bench as requested: "${(input.change ?? "").slice(0, 800)}"\n\nCurrent bench:\n${current}\n` +
    aboutPerson(input.context) +
    domainHint(topic) +
    "\nReply with the full updated json and js blocks. If the current code places things at fixed pixel positions, move them onto D.layout() regions while you're at it.\n" +
    icons
  );
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

/** Generate (or repair / revise) a bench. Retries with the concrete problems up to `attempts` times. */
export async function generateSim(input: GenInput, attempts = 3): Promise<GeneratedSim & { attempts: number; errors: string[]; check?: string; issues: string[] }> {
  const errors: string[] = [];
  const first = { role: "user" as const, content: userPrompt(input) };
  let messages: { role: "user" | "assistant"; content: string }[] = [first];
  let reviewed = false;
  // The best draft that runs, kept in case a later attempt gets worse. Fewer soft problems = better.
  let best: (GeneratedSim & { check: string; issues: string[]; attempt: number }) | null = null;
  const request = input.mode === "create" ? input.request : (input.change ?? "");
  for (let i = 0; i < attempts; i++) {
    const { text } = await generateText({
      model: chatModel(CODEGEN_MODEL_ID),
      system: SYSTEM,
      messages,
      temperature: i === 0 ? 0.3 : 0.2,
      maxRetries: 5,
      maxOutputTokens: 8000,
    });
    const reply = stripThinking(text).slice(0, 12000);
    try {
      const { spec: raw, code } = extract(text);
      const spec = validateSpec(raw);
      checkCode(code, spec);
      const defaults = Object.fromEntries(spec.params.map((p) => [p.key, p.default]));
      const smoke = smokeRun(code, defaults, spec.params);
      if (!smoke.ok) throw new Error(smoke.error);

      // Soft problems: it runs, but it isn't good yet. Collect them all so one retry can fix everything at once.
      const issues: string[] = [];
      const placeholder = findPlaceholder(spec, code, request);
      if (placeholder)
        issues.push(`it uses the placeholder name "${placeholder}": name the real thing (for chemistry the actual substances with formulas and a balanced equation), in the spec and on the drawing`);
      issues.push(...smoke.behaviour);
      if (smoke.layout.length)
        issues.push(
          `layout: ${smoke.layout.join("; ")}. Place everything from D.layout() regions, size objects from the region, put labels under their object, ` +
            "give long text { maxW }, and move numbers into D.readouts in L.side",
        );
      // One physics review per build (it costs a model call); done now so its finding rides along with the rest.
      if (!reviewed) {
        reviewed = true;
        const wrong = await physicsReview(spec, defaults, smoke.result.summary, smoke.result.metrics);
        if (wrong) issues.push(`a physics check of the default settings says the numbers are wrong: ${wrong}`);
      }
      const draft = { spec, code, check: smoke.result.summary, issues, attempt: i + 1 };
      if (!best || issues.length <= best.issues.length) best = draft;
      if (!issues.length || i === attempts - 1) break;
      throw new Error(`it runs, but needs fixing:\n- ${issues.join("\n- ")}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
      console.warn("[sim-gen] attempt", i + 1, "failed:", msg.slice(0, 600), "| reply starts:", reply.slice(0, 200).replace(/\s+/g, " "));
      // Only the latest draft and its problems go back, so retries don't grow the prompt.
      messages = [
        first,
        { role: "assistant", content: reply },
        { role: "user", content: `That didn't work: ${msg}\nReply again with the complete corrected json and js blocks.` },
      ];
    }
  }
  if (best) {
    if (best.issues.length) console.warn("[sim-gen] shipping attempt", best.attempt, "with", best.issues.length, "unfixed issue(s)");
    return { spec: best.spec, code: best.code, attempts: best.attempt, errors, check: best.check, issues: best.issues };
  }
  throw new Error(`Couldn't build a working bench after ${attempts} tries: ${errors.at(-1)}`);
}
