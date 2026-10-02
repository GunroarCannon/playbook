/**
 * Shared simulation registry. Used by the UI (to render dials) and by the server
 * (to describe sims to the model and validate the `set_dials` tool).
 *
 * Every sim — hand-built or AI-generated — speaks the same postMessage protocol (see src/lib/protocol.ts).
 */

export type ParamValue = number | string | boolean;

export type ParamSpec = {
  key: string;
  label: string;
  /** dial = rotary knob, fader = slider, toggle = knife switch, select = rotary selector */
  control: "dial" | "fader" | "toggle" | "select";
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { value: string; label: string }[];
  default: ParamValue;
  /** Only show this control when another param equals a value. */
  showIf?: { key: string; equals: ParamValue };
  hint?: string;
};

export type SimDef = {
  id: string;
  name: string;
  tagline: string;
  /** Where the sandboxed sim lives. Hand-built sims are static files in /public/sims. */
  src: string;
  /** What the model needs to know to reason about this sim. */
  brief: string;
  params: ParamSpec[];
  /** Words people use for this domain, used to route new chats to the right bench. */
  keywords: string[];
  /** True for benches the AI wrote for one person (code lives in the database, not /public). */
  custom?: boolean;
};

export const SIMS: SimDef[] = [
  {
    id: "truss",
    name: "Bridge Truss Bench",
    tagline: "Popsicle-stick bridges, load tests, snapping joints",
    src: "/sims/truss.html",
    keywords: ["bridge", "truss", "popsicle", "stick", "beam", "span", "load", "crane", "structure", "warren", "pratt", "howe"],
    brief:
      "2D pin-jointed truss solved with the method of joints under a centre point load. Members are popsicle sticks " +
      "(11.4cm long, ~25kgf tension capacity per layer, Euler buckling in compression so long compression members are weak). " +
      "Glue joints cap member force (wood glue ~18kgf, hot glue ~7kgf). 'beam' is a flat deck with no web (fails in bending fast). " +
      "Stick count = members split into stick lengths x layers; going over stickBudget is a constraint violation. " +
      "A test PASSES when the bridge holds loadKg without any member exceeding capacity and stays within budget.",
    params: [
      {
        key: "design",
        label: "Truss design",
        control: "select",
        default: "pratt",
        options: [
          { value: "beam", label: "Flat beam" },
          { value: "pratt", label: "Pratt" },
          { value: "howe", label: "Howe" },
          { value: "warren", label: "Warren" },
        ],
      },
      { key: "spanCm", label: "Span", control: "dial", min: 20, max: 80, step: 1, unit: "cm", default: 40 },
      { key: "heightCm", label: "Truss height", control: "fader", min: 4, max: 20, step: 0.5, unit: "cm", default: 8 },
      { key: "panels", label: "Panels", control: "fader", min: 2, max: 10, step: 1, default: 6 },
      { key: "loadKg", label: "Test load", control: "dial", min: 0, max: 25, step: 0.1, unit: "kg", default: 3 },
      { key: "stickBudget", label: "Stick budget", control: "fader", min: 10, max: 150, step: 1, unit: "sticks", default: 50 },
      { key: "doubled", label: "Double-layer members", control: "toggle", default: false },
      {
        key: "glue",
        label: "Glue",
        control: "select",
        default: "wood",
        options: [
          { value: "wood", label: "Wood glue" },
          { value: "hot", label: "Hot glue" },
        ],
      },
    ],
  },
  {
    id: "queue",
    name: "Checkout Rush Bench",
    tagline: "Cashier staffing, wait times, walkouts, payroll",
    src: "/sims/queue.html",
    keywords: ["queue", "cashier", "checkout", "shop", "store", "market", "customers", "wait", "staff", "retail", "line"],
    brief:
      "Discrete-event M/M/s checkout simulation over a rush window. Customers arrive (Poisson, arrivalRate per hour), " +
      "join the shortest line, and walk out (renege) if they wait longer than patienceMin. Express lane: one cashier only serves " +
      "small baskets (40% of customers) at 40% of the normal service time. Profit = served x marginPerCustomer - cashiers x wagePerHr x shiftHours. " +
      "A test PASSES when average wait <= targetWaitSec AND walkouts <= 2% of arrivals AND profit > 0.",
    params: [
      { key: "arrivalRate", label: "Arrivals", control: "dial", min: 5, max: 150, step: 1, unit: "cust/hr", default: 45 },
      { key: "cashiers", label: "Cashiers", control: "fader", min: 1, max: 6, step: 1, default: 2 },
      { key: "serviceMin", label: "Service time", control: "dial", min: 0.5, max: 8, step: 0.1, unit: "min", default: 2.5 },
      { key: "expressLane", label: "Express lane", control: "toggle", default: false },
      { key: "patienceMin", label: "Patience", control: "fader", min: 1, max: 20, step: 0.5, unit: "min", default: 6 },
      { key: "targetWaitSec", label: "Target wait", control: "fader", min: 30, max: 900, step: 10, unit: "s", default: 180 },
      { key: "shiftHours", label: "Rush length", control: "fader", min: 1, max: 4, step: 0.5, unit: "h", default: 2 },
      { key: "wagePerHr", label: "Wage", control: "fader", min: 200, max: 6000, step: 50, unit: "/hr", default: 1200 },
      { key: "marginPerCustomer", label: "Margin", control: "fader", min: 50, max: 3000, step: 10, unit: "/cust", default: 400 },
    ],
  },
  {
    id: "solar",
    name: "Off-Grid Solar Bench",
    tagline: "Battery bank, panels, night loads, cloudy days",
    src: "/sims/solar.html",
    keywords: ["solar", "battery", "inverter", "panel", "power", "lifepo4", "off-grid", "fridge", "blackout", "nepa", "generator", "load"],
    brief:
      "Hour-by-hour energy balance over 1-3 days. Battery energy = systemVoltage x batteryAh. Usable energy is limited by maxDoD; " +
      "the inverter cuts out when state of charge drops below (100 - maxDoD)%. Solar output follows a bell curve over sunHours, " +
      "scaled by (1 - cloudPct/100) and 80% system efficiency. Loads: baseLoadW at night, dayLoadW during the day, fridge adds ~120W average. " +
      "shedHour cuts 40% of non-essential load from that hour until 6am. A test PASSES when there is no cut-out over the simulated days.",
    params: [
      {
        key: "systemVoltage",
        label: "System voltage",
        control: "select",
        default: "24",
        options: [
          { value: "12", label: "12 V" },
          { value: "24", label: "24 V" },
          { value: "48", label: "48 V" },
        ],
      },
      { key: "batteryAh", label: "Battery", control: "dial", min: 50, max: 800, step: 10, unit: "Ah", default: 200 },
      { key: "maxDoD", label: "Max depth of discharge", control: "fader", min: 20, max: 95, step: 1, unit: "%", default: 80 },
      { key: "panelW", label: "Panels", control: "dial", min: 0, max: 5000, step: 50, unit: "W", default: 1200 },
      { key: "sunHours", label: "Sun hours", control: "fader", min: 0, max: 9, step: 0.1, unit: "h", default: 5.2 },
      { key: "cloudPct", label: "Cloud cover", control: "fader", min: 0, max: 95, step: 1, unit: "%", default: 0 },
      { key: "dayLoadW", label: "Day load", control: "dial", min: 0, max: 3000, step: 10, unit: "W", default: 600 },
      { key: "baseLoadW", label: "Night load", control: "dial", min: 0, max: 2000, step: 10, unit: "W", default: 320 },
      { key: "fridge", label: "Fridge on", control: "toggle", default: true },
      {
        key: "shedHour",
        label: "Load-shed from",
        control: "select",
        default: "none",
        options: [
          { value: "none", label: "Never" },
          { value: "21", label: "21:00" },
          { value: "22", label: "22:00" },
          { value: "23", label: "23:00" },
          { value: "0", label: "00:00" },
        ],
      },
      { key: "days", label: "Days simulated", control: "fader", min: 1, max: 3, step: 1, unit: "d", default: 2 },
    ],
  },
  {
    id: "projectile",
    name: "Launch & Swing Bench",
    tagline: "Projectiles, targets, pendulums, other planets",
    src: "/sims/projectile.html",
    keywords: ["projectile", "launch", "throw", "angle", "pendulum", "swing", "gravity", "physics", "cannon", "ball", "trajectory", "period"],
    brief:
      "Two modes. projectile: point mass launched at angleDeg and speed from heightM, optional quadratic air drag (sphere, Cd 0.47, " +
      "radius scales with massKg), PASSES if it lands within 5% (min 1m) of targetM. pendulum: simple pendulum integrated numerically " +
      "(not the small-angle formula) with lengthM and amplitudeDeg, PASSES if the measured period is within 2% of targetPeriodS. " +
      "gravity: earth 9.81, moon 1.62, mars 3.71 m/s^2.",
    params: [
      {
        key: "mode",
        label: "Mode",
        control: "select",
        default: "projectile",
        options: [
          { value: "projectile", label: "Projectile" },
          { value: "pendulum", label: "Pendulum" },
        ],
      },
      {
        key: "gravity",
        label: "Gravity",
        control: "select",
        default: "earth",
        options: [
          { value: "earth", label: "Earth" },
          { value: "moon", label: "Moon" },
          { value: "mars", label: "Mars" },
        ],
      },
      { key: "angleDeg", label: "Launch angle", control: "dial", min: 1, max: 89, step: 0.5, unit: "°", default: 45, showIf: { key: "mode", equals: "projectile" } },
      { key: "speed", label: "Launch speed", control: "dial", min: 1, max: 80, step: 0.5, unit: "m/s", default: 20, showIf: { key: "mode", equals: "projectile" } },
      { key: "heightM", label: "Launch height", control: "fader", min: 0, max: 50, step: 0.5, unit: "m", default: 0, showIf: { key: "mode", equals: "projectile" } },
      { key: "massKg", label: "Mass", control: "fader", min: 0.05, max: 20, step: 0.05, unit: "kg", default: 1, showIf: { key: "mode", equals: "projectile" } },
      { key: "drag", label: "Air drag", control: "toggle", default: false, showIf: { key: "mode", equals: "projectile" } },
      { key: "targetM", label: "Target distance", control: "fader", min: 2, max: 300, step: 1, unit: "m", default: 40, showIf: { key: "mode", equals: "projectile" } },
      { key: "lengthM", label: "String length", control: "fader", min: 0.1, max: 10, step: 0.05, unit: "m", default: 1, showIf: { key: "mode", equals: "pendulum" } },
      { key: "amplitudeDeg", label: "Release angle", control: "dial", min: 1, max: 85, step: 1, unit: "°", default: 15, showIf: { key: "mode", equals: "pendulum" } },
      { key: "targetPeriodS", label: "Target period", control: "fader", min: 0.3, max: 8, step: 0.05, unit: "s", default: 2, showIf: { key: "mode", equals: "pendulum" } },
    ],
  },
  {
    id: "outbreak",
    name: "Outbreak Bench",
    tagline: "Disease spread, vaccines, distancing, hospital beds",
    src: "/sims/outbreak.html",
    keywords: ["outbreak", "epidemic", "pandemic", "virus", "disease", "flu", "covid", "cholera", "vaccine", "infection", "hospital", "spread", "sir"],
    brief:
      "SIR epidemic model in quarter-day steps. beta = r0 / infectiousDays, cut by distancing (mild 30%, strict 60%) from distancingDay on. " +
      "vaccinatedPct start immune. Hospital demand = currently infected x hospitalPct. Capacity = bedsPer1000 per 1000 people. " +
      "A test PASSES when peak hospital demand never exceeds the beds. Score = % of people never infected.",
    params: [
      { key: "populationK", label: "Population", control: "dial", min: 1, max: 1000, step: 1, unit: "k people", default: 100 },
      { key: "r0", label: "R0 (spread)", control: "dial", min: 0.5, max: 8, step: 0.1, default: 2.5 },
      { key: "infectiousDays", label: "Sick for", control: "fader", min: 2, max: 21, step: 1, unit: "days", default: 7 },
      { key: "initialCases", label: "First cases", control: "fader", min: 1, max: 500, step: 1, default: 10 },
      { key: "vaccinatedPct", label: "Vaccinated", control: "fader", min: 0, max: 95, step: 1, unit: "%", default: 0 },
      {
        key: "distancing",
        label: "Distancing",
        control: "select",
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "mild", label: "Mild (-30%)" },
          { value: "strict", label: "Strict (-60%)" },
        ],
      },
      { key: "distancingDay", label: "Distancing from", control: "fader", min: 0, max: 120, step: 1, unit: "day", default: 20 },
      { key: "hospitalPct", label: "Need a bed", control: "fader", min: 0.5, max: 20, step: 0.5, unit: "%", default: 5 },
      { key: "bedsPer1000", label: "Beds", control: "fader", min: 0.5, max: 12, step: 0.1, unit: "/1000", default: 2.5 },
      { key: "days", label: "Days simulated", control: "fader", min: 30, max: 365, step: 5, unit: "d", default: 180 },
    ],
  },
  {
    id: "braking",
    name: "Stopping Distance Bench",
    tagline: "Speed, reaction time, wet roads, a child runs out",
    src: "/sims/braking.html",
    keywords: ["car", "brake", "braking", "stopping", "speed", "drive", "driving", "road", "crash", "tyre", "tire", "abs", "accident", "phone", "reaction"],
    brief:
      "A child runs into the road hazardM ahead. Stopping distance = speed x reaction time (+1.5 s if on the phone) + v^2 / (2a), " +
      "a = g (mu cos + sin of slope). mu: dry 0.8, wet 0.5, gravel 0.4, ice 0.1; worn tyres x0.75; no ABS (locked wheels) x0.75. " +
      "A test PASSES when the car stops before the hazard. Score = metres to spare. On failure it reports impact speed.",
    params: [
      { key: "speedKmh", label: "Speed", control: "dial", min: 10, max: 160, step: 1, unit: "km/h", default: 60 },
      { key: "reactionS", label: "Reaction time", control: "fader", min: 0.3, max: 3, step: 0.1, unit: "s", default: 1 },
      { key: "phone", label: "On the phone", control: "toggle", default: false },
      {
        key: "road",
        label: "Road",
        control: "select",
        default: "dry",
        options: [
          { value: "dry", label: "Dry tarmac" },
          { value: "wet", label: "Wet" },
          { value: "gravel", label: "Gravel" },
          { value: "ice", label: "Ice" },
        ],
      },
      {
        key: "tyres",
        label: "Tyres",
        control: "select",
        default: "new",
        options: [
          { value: "new", label: "New" },
          { value: "worn", label: "Worn" },
        ],
      },
      { key: "abs", label: "ABS brakes", control: "toggle", default: true },
      { key: "slopePct", label: "Slope (− downhill)", control: "fader", min: -15, max: 15, step: 1, unit: "%", default: 0 },
      { key: "hazardM", label: "Hazard distance", control: "fader", min: 5, max: 150, step: 1, unit: "m", default: 40 },
    ],
  },
  {
    id: "savings",
    name: "Savings Goal Bench",
    tagline: "Monthly saving vs interest, inflation and emergencies",
    src: "/sims/savings.html",
    keywords: ["save", "saving", "savings", "money", "interest", "inflation", "goal", "budget", "invest", "salary", "naira", "rent", "school fees", "deposit"],
    brief:
      "Month-by-month savings. Interest compounds monthly; the monthly deposit rises by raisePct once a year; inflation reduces buying power. " +
      "The goal is in TODAY's money, so the final balance is deflated before comparing. emergency=true withdraws 3 months of deposits halfway. " +
      "A test PASSES when the inflation-adjusted final balance >= goal. Score = % of goal.",
    params: [
      { key: "monthly", label: "Saved per month", control: "dial", min: 0, max: 1000000, step: 1000, default: 50000 },
      { key: "startAmount", label: "Starting amount", control: "fader", min: 0, max: 10000000, step: 10000, default: 0 },
      { key: "raisePct", label: "Raise deposit yearly", control: "fader", min: 0, max: 50, step: 1, unit: "%", default: 0 },
      { key: "interestPct", label: "Interest", control: "dial", min: 0, max: 40, step: 0.5, unit: "%/yr", default: 10 },
      { key: "inflationPct", label: "Inflation", control: "fader", min: 0, max: 50, step: 0.5, unit: "%/yr", default: 20 },
      { key: "years", label: "Years", control: "fader", min: 1, max: 30, step: 1, unit: "yr", default: 3 },
      { key: "goal", label: "Goal (today's money)", control: "dial", min: 10000, max: 100000000, step: 10000, default: 2000000 },
      { key: "emergency", label: "Emergency withdrawal", control: "toggle", default: false },
    ],
  },
  {
    id: "rocket",
    name: "Bottle Rocket Bench",
    tagline: "Water rockets: pressure, water fill, fins, apogee",
    src: "/sims/rocket.html",
    keywords: ["rocket", "bottle", "water rocket", "launch", "psi", "pressure", "fins", "apogee", "altitude", "nozzle", "science fair"],
    brief:
      "Water rocket. Thrust = 2 A (P - Patm) while water remains; the air expands adiabatically (gamma 1.4) so pressure drops as water leaves. " +
      "Then it coasts with quadratic drag (Cd 0.45 with fins, 1.4 tumbling without). Best water fill is usually 30-40%. " +
      "A test PASSES when the apogee reaches targetM. Score = apogee in metres.",
    params: [
      {
        key: "bottleL",
        label: "Bottle",
        control: "select",
        default: "2",
        options: [
          { value: "0.5", label: "0.5 L" },
          { value: "1.5", label: "1.5 L" },
          { value: "2", label: "2 L" },
        ],
      },
      { key: "waterPct", label: "Water fill", control: "fader", min: 0, max: 90, step: 1, unit: "%", default: 33 },
      { key: "pressurePsi", label: "Pressure", control: "dial", min: 10, max: 120, step: 1, unit: "psi", default: 60 },
      {
        key: "nozzleMm",
        label: "Nozzle",
        control: "select",
        default: "22",
        options: [
          { value: "9", label: "9 mm" },
          { value: "15", label: "15 mm" },
          { value: "22", label: "22 mm (open neck)" },
        ],
      },
      { key: "angleDeg", label: "Launch angle", control: "dial", min: 30, max: 90, step: 1, unit: "°", default: 85 },
      { key: "dryMassG", label: "Dry mass", control: "fader", min: 50, max: 500, step: 5, unit: "g", default: 150 },
      { key: "fins", label: "Fins", control: "toggle", default: true },
      { key: "targetM", label: "Target height", control: "fader", min: 5, max: 120, step: 1, unit: "m", default: 30 },
    ],
  },
];

/**
 * AI-built benches. The browser registers the signed-in person's custom sims here so the
 * synchronous getSim() works everywhere in the UI. Server code must use resolveSim() (sims-server.ts)
 * instead, because a module-level registry would be shared between users there.
 */
const customRegistry = new Map<string, SimDef>();
export function registerCustomSims(list: SimDef[]) {
  for (const s of list) customRegistry.set(s.id, { ...s, custom: true });
}

export const getSim = (id: string) => SIMS.find((s) => s.id === id) ?? customRegistry.get(id);

export function defaultParams(params: ParamSpec[]): Record<string, ParamValue> {
  return Object.fromEntries(params.map((p) => [p.key, p.default]));
}

/**
 * Coerce and clamp model-supplied params against a spec.
 * Open-weight models regularly send numbers as strings ("6.2") or booleans as "true" — accept those.
 */
export function sanitizeParams(
  specs: ParamSpec[],
  input: Record<string, unknown>,
): { params: Record<string, ParamValue>; rejected: string[] } {
  const params: Record<string, ParamValue> = {};
  const rejected: string[] = [];
  for (const [k, raw] of Object.entries(input ?? {})) {
    const spec = specs.find((s) => s.key === k || s.key.toLowerCase() === k.toLowerCase());
    if (!spec) {
      rejected.push(k);
      continue;
    }
    if (spec.control === "toggle") {
      params[spec.key] = raw === true || raw === "true" || raw === 1 || raw === "on" || raw === "1";
    } else if (spec.control === "select") {
      const v = String(raw).toLowerCase();
      const opt = spec.options?.find((o) => o.value.toLowerCase() === v || o.label.toLowerCase() === v);
      if (opt) params[spec.key] = opt.value;
      else rejected.push(k);
    } else {
      const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^0-9.\-]/g, ""));
      if (Number.isFinite(n)) {
        const lo = spec.min ?? -Infinity;
        const hi = spec.max ?? Infinity;
        params[spec.key] = Math.min(hi, Math.max(lo, n));
      } else rejected.push(k);
    }
  }
  return { params, rejected };
}

export function describeParams(specs: ParamSpec[]) {
  return specs
    .map((p) => {
      const range =
        p.control === "select"
          ? `one of ${p.options?.map((o) => `"${o.value}"`).join("|")}`
          : p.control === "toggle"
            ? "true|false"
            : `${p.min}–${p.max}${p.unit ? " " + p.unit : ""}`;
      return `- ${p.key} (${p.label}): ${range}, default ${JSON.stringify(p.default)}${p.showIf ? ` [only when ${p.showIf.key}=${p.showIf.equals}]` : ""}`;
    })
    .join("\n");
}

export function routeSim(text: string): string | null {
  const t = text.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const s of SIMS) {
    const score = s.keywords.reduce((acc, k) => acc + (t.includes(k) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { id: s.id, score };
  }
  return best?.id ?? null;
}
