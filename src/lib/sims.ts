/**
 * Shared simulation registry. Used by the UI (to render dials) and by the server
 * (to describe sims to the model and validate the `set_dials` tool).
 *
 * Every sim — hand-built or AI-generated — speaks the same postMessage protocol (see src/lib/protocol.ts).
 */

import type { UiIconName } from "@/components/ui-icons";

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

/** A ready-made scenario: one click sets these dials (everything else goes back to its default). */
export type SimPreset = {
  id: string;
  label: string;
  icon: UiIconName;
  /** One plain sentence: what this scenario is. Shown under the preset row when it's picked. */
  note: string;
  params: Record<string, ParamValue>;
};

export type SimCategory = "build" | "motion" | "home" | "money" | "people";

export const CATEGORIES: { id: SimCategory; label: string; icon: UiIconName }[] = [
  { id: "build", label: "Build & make", icon: "hammer" },
  { id: "motion", label: "Motion & travel", icon: "car-side" },
  { id: "home", label: "Home, water & power", icon: "house" },
  { id: "money", label: "Money & business", icon: "coins" },
  { id: "people", label: "People & health", icon: "people-group" },
];

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
  /** Hand-built benches only: which shelf of the bench picker it sits on. */
  category?: SimCategory;
  /** Hand-built benches only: one-click scenarios shown above the dials. */
  presets?: SimPreset[];
  /** True for benches the AI wrote for one person (code lives in the database, not /public). */
  custom?: boolean;
};

export const SIMS: SimDef[] = [
  {
    id: "truss",
    name: "Bridge Truss Bench",
    tagline: "Popsicle-stick bridges, load tests, snapping joints",
    src: "/sims/truss.html",
    category: "build",
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
    presets: [
      { id: "contest", label: "School contest", icon: "trophy", note: "The classic brief: 50 sticks, a 40 cm gap, and it has to hold 5 kg.", params: { design: "warren", spanCm: 40, heightCm: 8, panels: 6, loadKg: 5, stickBudget: 50, doubled: false, glue: "wood" } },
      { id: "flat", label: "Flat beam", icon: "triangle-exclamation", note: "No triangles at all, just a deck. Watch how early it gives up.", params: { design: "beam", spanCm: 40, loadKg: 3, stickBudget: 50 } },
      { id: "hotglue", label: "Hot glue only", icon: "fire", note: "Same Pratt truss, but the joints are hot glue, which lets go far sooner than wood glue.", params: { design: "pratt", glue: "hot", loadKg: 4 } },
      { id: "long", label: "Long 70 cm span", icon: "ruler", note: "A much wider gap with a deeper truss and a bigger stick budget.", params: { design: "warren", spanCm: 70, heightCm: 12, panels: 8, loadKg: 4, stickBudget: 100 } },
      { id: "heavy", label: "Heavy duty", icon: "weight-hanging", note: "Doubled members and a tall truss, aiming for 15 kg.", params: { design: "warren", heightCm: 12, doubled: true, loadKg: 15, stickBudget: 120 } },
      { id: "tight", label: "Only 30 sticks", icon: "popsicle-stick", note: "A shorter bridge on a tight budget. Can it still hold 3 kg?", params: { design: "warren", spanCm: 30, panels: 4, loadKg: 3, stickBudget: 30 } },
    ],
  },
  {
    id: "queue",
    name: "Checkout Rush Bench",
    tagline: "Cashier staffing, wait times, walkouts, payroll",
    src: "/sims/queue.html",
    category: "money",
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
    presets: [
      { id: "quiet", label: "Quiet weekday", icon: "mug-hot", note: "A slow morning: 15 customers an hour and two tills open.", params: { arrivalRate: 15, cashiers: 2 } },
      { id: "saturday", label: "Saturday rush", icon: "people-group", note: "110 customers an hour for three hours with only three tills open.", params: { arrivalRate: 110, cashiers: 3, shiftHours: 3 } },
      { id: "saturday-fixed", label: "Saturday, all tills", icon: "cash-register", note: "The same Saturday rush with all six tills open.", params: { arrivalRate: 110, cashiers: 6, shiftHours: 3, patienceMin: 10 } },
      { id: "xmas", label: "Christmas Eve", icon: "gift", note: "The busiest day of the year, impatient shoppers, every till open.", params: { arrivalRate: 150, cashiers: 6, patienceMin: 4, shiftHours: 4 } },
      { id: "express", label: "Express lane", icon: "basket-shopping", note: "70 an hour with five cashiers, one of them only taking small baskets.", params: { arrivalRate: 70, cashiers: 5, expressLane: true } },
      { id: "kiosk", label: "Small kiosk", icon: "store", note: "One person serving 20 quick sales an hour with a small margin on each.", params: { arrivalRate: 20, cashiers: 1, serviceMin: 1.5, patienceMin: 8, wagePerHr: 600, marginPerCustomer: 200 } },
      { id: "bank", label: "Banking hall", icon: "landmark", note: "Slow 6-minute transactions, six tellers, people willing to wait up to 30 minutes.", params: { arrivalRate: 40, cashiers: 6, serviceMin: 6, patienceMin: 30, targetWaitSec: 600, marginPerCustomer: 300 } },
    ],
  },
  {
    id: "solar",
    name: "Off-Grid Solar Bench",
    tagline: "Battery bank, panels, night loads, cloudy days",
    src: "/sims/solar.html",
    category: "home",
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
    presets: [
      { id: "flat", label: "Small flat", icon: "lightbulb", note: "Lights, a fan and a TV on a 12 V 200 Ah battery with 600 W of panels, no fridge.", params: { systemVoltage: "12", batteryAh: 200, panelW: 600, dayLoadW: 150, baseLoadW: 100, fridge: false } },
      { id: "family", label: "Family home", icon: "house", note: "24 V 300 Ah and 3 kW of panels for a home with a fridge.", params: { systemVoltage: "24", batteryAh: 300, panelW: 3000, dayLoadW: 400, baseLoadW: 250, fridge: true } },
      { id: "rainy", label: "Rainy-season week", icon: "cloud-rain", note: "The family home through three heavy-cloud days with short sun.", params: { systemVoltage: "24", batteryAh: 300, panelW: 3000, dayLoadW: 400, baseLoadW: 250, fridge: true, cloudPct: 70, sunHours: 4, days: 3 } },
      { id: "harmattan", label: "Harmattan haze", icon: "sun", note: "The family home on long dry days, with dust cutting what the panels get.", params: { systemVoltage: "24", batteryAh: 300, panelW: 3000, dayLoadW: 400, baseLoadW: 250, fridge: true, cloudPct: 35, sunHours: 6.5 } },
      { id: "shop", label: "Shop with freezer", icon: "store", note: "A busy shop on 48 V 300 Ah and 5 kW of panels.", params: { systemVoltage: "48", batteryAh: 300, panelW: 5000, dayLoadW: 900, baseLoadW: 400, fridge: true } },
      { id: "shed", label: "Load-shed at 22:00", icon: "power-off", note: "A 300 Ah bank that cuts non-essential loads from 10 pm to stretch the night.", params: { batteryAh: 300, panelW: 2500, dayLoadW: 400, shedHour: "22" } },
      { id: "leadacid", label: "Lead-acid battery", icon: "battery-half", note: "The family home on old-style batteries that should only be drained to 50%.", params: { systemVoltage: "24", batteryAh: 300, panelW: 3000, dayLoadW: 400, baseLoadW: 250, fridge: true, maxDoD: 50 } },
    ],
  },
  {
    id: "projectile",
    name: "Launch & Swing Bench",
    tagline: "Projectiles, targets, pendulums, other planets",
    src: "/sims/projectile.html",
    category: "motion",
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
    presets: [
      { id: "best", label: "45° throw", icon: "baseball", note: "The textbook best angle on flat ground with no air drag.", params: { mode: "projectile", gravity: "earth", angleDeg: 45, speed: 20, heightM: 0, drag: false, targetM: 40 } },
      { id: "basketball", label: "Basketball shot", icon: "basketball", note: "Released at 2 m, a 0.6 kg ball, aiming 5 m away with real air drag.", params: { mode: "projectile", angleDeg: 52, speed: 6.8, heightM: 2, massKg: 0.6, drag: true, targetM: 5 } },
      { id: "football", label: "Long football kick", icon: "futbol", note: "A 0.45 kg ball kicked at 28 m/s. Drag cuts the range a lot.", params: { mode: "projectile", angleDeg: 35, speed: 28, heightM: 0, massKg: 0.45, drag: true, targetM: 60 } },
      { id: "cliff", label: "Throw off a cliff", icon: "mountain", note: "From 30 m up, a lower angle can go further than 45°.", params: { mode: "projectile", heightM: 30, angleDeg: 30, speed: 15, targetM: 45 } },
      { id: "moon", label: "On the Moon", icon: "moon", note: "The same 20 m/s throw with a sixth of the gravity.", params: { mode: "projectile", gravity: "moon", angleDeg: 45, speed: 20, targetM: 245, drag: false } },
      { id: "clock", label: "Clock pendulum", icon: "clock", note: "A grandfather clock pendulum ticks once a second: 2 s for a full swing.", params: { mode: "pendulum", gravity: "earth", lengthM: 0.99, amplitudeDeg: 5, targetPeriodS: 2 } },
      { id: "mars", label: "Pendulum on Mars", icon: "rocket", note: "The same 1 m pendulum on Mars. Does it still keep time?", params: { mode: "pendulum", gravity: "mars", lengthM: 1, amplitudeDeg: 10, targetPeriodS: 2 } },
    ],
  },
  {
    id: "outbreak",
    name: "Outbreak Bench",
    tagline: "Disease spread, vaccines, distancing, hospital beds",
    src: "/sims/outbreak.html",
    category: "people",
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
    presets: [
      { id: "flu", label: "Seasonal flu", icon: "temperature-half", note: "A mild flu: R0 1.3, sick for 5 days, 1% need a bed.", params: { r0: 1.3, infectiousDays: 5, hospitalPct: 1, distancing: "none", vaccinatedPct: 0 } },
      { id: "measles", label: "Measles, no vaccines", icon: "virus", note: "One of the most contagious diseases there is, in a town with no one vaccinated.", params: { r0: 8, infectiousDays: 8, vaccinatedPct: 0, hospitalPct: 2, distancing: "none" } },
      { id: "measles-vax", label: "Measles, 90% vaccinated", icon: "syringe", note: "The same measles in a town where 9 in 10 people are vaccinated.", params: { r0: 8, infectiousDays: 8, vaccinatedPct: 90, hospitalPct: 2, distancing: "none" } },
      { id: "early", label: "Early strict lockdown", icon: "house", note: "A COVID-like virus with strict distancing from day 10.", params: { r0: 2.5, distancing: "strict", distancingDay: 10 } },
      { id: "late", label: "Late, mild response", icon: "clock", note: "The same virus, with only mild distancing from day 45.", params: { r0: 2.5, distancing: "mild", distancingDay: 45 } },
      { id: "cholera", label: "Cholera in a camp", icon: "droplet", note: "20,000 people, few beds, and 1 in 10 cases needs treatment.", params: { populationK: 20, r0: 2, infectiousDays: 5, hospitalPct: 10, bedsPer1000: 1, distancing: "none" } },
    ],
  },
  {
    id: "braking",
    name: "Stopping Distance Bench",
    tagline: "Speed, reaction time, wet roads, a child runs out",
    src: "/sims/braking.html",
    category: "motion",
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
    presets: [
      { id: "school", label: "School zone, 30 km/h", icon: "child", note: "A child steps out 15 m ahead outside a school.", params: { speedKmh: 30, hazardM: 15, road: "dry", phone: false } },
      { id: "city", label: "City street, 50 km/h", icon: "city", note: "Normal town driving, hazard 25 m ahead.", params: { speedKmh: 50, hazardM: 25, road: "dry", phone: false } },
      { id: "highway", label: "Highway at night", icon: "moon", note: "100 km/h, a tired 1.5 s reaction, something on the road 60 m ahead.", params: { speedKmh: 100, reactionS: 1.5, hazardM: 60, road: "dry" } },
      { id: "texting", label: "Texting at 80", icon: "mobile-screen", note: "On the phone at 80 km/h: an extra second and a half before braking.", params: { speedKmh: 80, phone: true, hazardM: 40 } },
      { id: "rain", label: "Rain and worn tyres", icon: "cloud-rain", note: "A wet road at 70 km/h on old tyres.", params: { speedKmh: 70, road: "wet", tyres: "worn", hazardM: 45 } },
      { id: "ice", label: "Downhill on ice", icon: "snowflake", note: "Only 40 km/h, but downhill on ice.", params: { speedKmh: 40, road: "ice", slopePct: -8, hazardM: 60 } },
    ],
  },
  {
    id: "savings",
    name: "Savings Goal Bench",
    tagline: "Monthly saving vs interest, inflation and emergencies",
    src: "/sims/savings.html",
    category: "money",
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
    presets: [
      { id: "fees", label: "School fees in 3 years", icon: "graduation-cap", note: "₦60,000 a month towards ₦2.5 million in today's money, 25% inflation.", params: { monthly: 60000, years: 3, goal: 2500000, interestPct: 12, inflationPct: 25 } },
      { id: "rent", label: "Rent in 1 year", icon: "house", note: "₦125,000 a month for a ₦1.2 million rent next year.", params: { monthly: 125000, years: 1, goal: 1200000, interestPct: 8, inflationPct: 25 } },
      { id: "car", label: "A car in 5 years", icon: "car-side", note: "₦250,000 a month, raised 10% each year, towards ₦10 million.", params: { monthly: 250000, years: 5, goal: 10000000, raisePct: 10, interestPct: 15, inflationPct: 20 } },
      { id: "retire", label: "Retirement pot", icon: "piggy-bank", note: "₦130,000 a month for 30 years, rising 8% a year, towards ₦50 million in today's money.", params: { monthly: 130000, years: 30, goal: 50000000, raisePct: 8, interestPct: 15, inflationPct: 12 } },
      { id: "mattress", label: "Under the mattress", icon: "bed", note: "No interest at all while prices rise 25% a year.", params: { interestPct: 0, inflationPct: 25 } },
      { id: "tbills", label: "Beat inflation", icon: "chart-line", note: "₦65,000 a month earning 30% (like treasury bills or a money-market fund) against 20% inflation.", params: { monthly: 65000, interestPct: 30, inflationPct: 20 } },
      { id: "emergency", label: "An emergency hits", icon: "triangle-exclamation", note: "Halfway through, three months of savings go on an emergency.", params: { emergency: true } },
    ],
  },
  {
    id: "rocket",
    name: "Bottle Rocket Bench",
    tagline: "Water rockets: pressure, water fill, fins, apogee",
    src: "/sims/rocket.html",
    category: "build",
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
    presets: [
      { id: "fair", label: "Science fair 2 L", icon: "trophy", note: "A 2 L bottle a third full at 60 psi, with fins.", params: { bottleL: "2", waterPct: 33, pressurePsi: 60, fins: true } },
      { id: "full", label: "Too much water", icon: "droplet", note: "70% water: more to push out, less air to push it.", params: { waterPct: 70 } },
      { id: "empty", label: "Air only", icon: "wind", note: "No water at all. Does air alone get it up?", params: { waterPct: 0 } },
      { id: "small", label: "Small 0.5 L bottle", icon: "bottle-water", note: "A little bottle at 50 psi.", params: { bottleL: "0.5", pressurePsi: 50 } },
      { id: "max", label: "Max pressure", icon: "gauge-high", note: "Pumped to 100 psi. Only with a bottle and launcher rated for it.", params: { pressurePsi: 100 } },
      { id: "nofins", label: "No fins", icon: "xmark", note: "Without fins it tumbles and drag shoots up.", params: { fins: false } },
      { id: "narrow", label: "Narrow 9 mm nozzle", icon: "filter", note: "A small nozzle: a longer, gentler push.", params: { nozzleMm: "9" } },
    ],
  },
  {
    id: "shelf",
    name: "Shelf Sag Bench",
    tagline: "Planks, brackets, books: does it sag or snap?",
    src: "/sims/shelf.html",
    category: "build",
    keywords: ["shelf", "shelves", "plank", "bookshelf", "bracket", "sag", "mdf", "plywood", "chipboard", "floating shelf", "cantilever", "deflection", "carpentry", "furniture", "wood"],
    brief:
      "A plank treated as a beam: I = b h^3/12, stress = M (h/2)/I. Two brackets = simply supported (even load d = 5wL^4/384EI, M = wL^2/8; " +
      "point load in the middle d = PL^3/48EI, M = PL/4). Floating shelf = cantilever (even d = wL^4/8EI, M = wL^2/2; point at the front d = PL^3/3EI, M = PL). " +
      "Its own weight is added. Materials (E, allowable stress, creep factor): pine 9 GPa 14 MPa x1.5, plywood 8 GPa 14 MPa x1.5, MDF 3.5 GPa 10 MPa x2.5, " +
      "chipboard 2.5 GPa 6 MPa x2.5, toughened glass 70 GPa 30 MPa, steel 200 GPa 160 MPa. Long-term sag = sag x creep. " +
      "A test PASSES when stress <= allowable AND long-term sag <= span/200 (brackets) or length/100 (floating). Score = kg it could safely take. " +
      "Sag goes with span^3 or ^4 and 1/thickness^3, so thickness and span are the strongest levers.",
    params: [
      {
        key: "material",
        label: "Board",
        control: "select",
        default: "pine",
        options: [
          { value: "pine", label: "Pine plank" },
          { value: "plywood", label: "Plywood" },
          { value: "mdf", label: "MDF" },
          { value: "chipboard", label: "Chipboard" },
          { value: "glass", label: "Toughened glass" },
          { value: "steel", label: "Steel sheet" },
        ],
      },
      {
        key: "supports",
        label: "Held by",
        control: "select",
        default: "simple",
        options: [
          { value: "simple", label: "Two brackets" },
          { value: "cantilever", label: "Wall only (floating)" },
        ],
      },
      { key: "spanCm", label: "Span / reach", control: "dial", min: 15, max: 200, step: 1, unit: "cm", default: 80, hint: "gap between brackets, or how far a floating shelf sticks out" },
      { key: "thickMm", label: "Thickness", control: "fader", min: 3, max: 50, step: 1, unit: "mm", default: 18 },
      { key: "depthCm", label: "Board width", control: "fader", min: 10, max: 100, step: 1, unit: "cm", default: 25, hint: "front-to-back for a bracket shelf; along the wall for a floating one" },
      { key: "loadKg", label: "Load", control: "dial", min: 0, max: 150, step: 1, unit: "kg", default: 30 },
      {
        key: "loadType",
        label: "Load is",
        control: "select",
        default: "even",
        options: [
          { value: "even", label: "Spread out (books)" },
          { value: "point", label: "One heavy thing, worst spot" },
        ],
      },
    ],
    presets: [
      { id: "books", label: "Pine bookshelf", icon: "book-open", note: "18 mm pine, 80 cm between brackets, 30 kg of books.", params: {} },
      { id: "mdf", label: "MDF bookshelf", icon: "triangle-exclamation", note: "The same shelf in 18 mm MDF, 90 cm wide, 35 kg of books. MDF creeps over months.", params: { material: "mdf", spanCm: 90, loadKg: 35 } },
      { id: "long", label: "Long 120 cm span", icon: "ruler", note: "Pine again, but the brackets are 120 cm apart.", params: { spanCm: 120, loadKg: 30 } },
      { id: "floating", label: "Floating shelf", icon: "house", note: "A chunky 38 mm floating shelf sticking out 25 cm, 80 cm along the wall, 20 kg on it.", params: { supports: "cantilever", spanCm: 25, thickMm: 38, depthCm: 80, loadKg: 20 } },
      { id: "glass", label: "Glass bathroom shelf", icon: "droplet", note: "8 mm toughened glass, 60 cm span, 5 kg of bottles.", params: { material: "glass", thickMm: 8, spanCm: 60, depthCm: 15, loadKg: 5 } },
      { id: "microwave", label: "Microwave on a shelf", icon: "kitchen-set", note: "15 kg in the middle of an 18 mm pine shelf, 70 cm span.", params: { spanCm: 70, depthCm: 40, loadKg: 15, loadType: "point" } },
      { id: "tv", label: "TV on chipboard", icon: "tv", note: "A 25 kg TV in the middle of a 16 mm chipboard shelf, 100 cm span.", params: { material: "chipboard", thickMm: 16, spanCm: 100, depthCm: 40, loadKg: 25, loadType: "point" } },
    ],
  },
  {
    id: "pulley",
    name: "Pulley, Lever & Ramp Bench",
    tagline: "Lift heavy things: ropes, crowbars and ramps",
    src: "/sims/pulley.html",
    category: "build",
    keywords: ["pulley", "lever", "ramp", "lift", "hoist", "block and tackle", "crowbar", "fulcrum", "mechanical advantage", "incline", "wheelchair ramp", "simple machine", "rope", "heavy"],
    brief:
      "Simple machines, forces in kilograms-force. Pulley (block and tackle): effort = load / (ropes x efficiency^ropes), smooth pulleys 96% each, " +
      "rusty 85%; rope pulled = lift x ropes. Lever: effort = load x (load arm / effort arm), load arm = fulcrumCm, effort arm = leverM - load arm. " +
      "Ramp: effort = load x (sin a + mu cos a), sin a = lift / ramp length; mu: trolley 0.03, rollers 0.08, sliding 0.4. " +
      "A test PASSES when effort <= strengthKg. Score = kg of strength to spare. A wheelchair ramp should be no steeper than 1 in 12.",
    params: [
      {
        key: "mode",
        label: "Machine",
        control: "select",
        default: "pulley",
        options: [
          { value: "pulley", label: "Pulleys" },
          { value: "lever", label: "Lever" },
          { value: "ramp", label: "Ramp" },
        ],
      },
      { key: "loadKg", label: "Load", control: "dial", min: 1, max: 500, step: 1, unit: "kg", default: 80 },
      { key: "strengthKg", label: "Your strength", control: "fader", min: 5, max: 80, step: 1, unit: "kg", default: 25, hint: "how hard you can pull or push, in kg-force" },
      { key: "liftM", label: "Lift height", control: "fader", min: 0.2, max: 10, step: 0.1, unit: "m", default: 2 },
      { key: "ropes", label: "Ropes holding the load", control: "fader", min: 1, max: 6, step: 1, default: 2, showIf: { key: "mode", equals: "pulley" } },
      {
        key: "pulleyType",
        label: "Pulleys",
        control: "select",
        default: "good",
        showIf: { key: "mode", equals: "pulley" },
        options: [
          { value: "good", label: "Smooth, oiled" },
          { value: "rusty", label: "Rusty, rough rope" },
        ],
      },
      { key: "leverM", label: "Lever length", control: "fader", min: 0.5, max: 4, step: 0.05, unit: "m", default: 2, showIf: { key: "mode", equals: "lever" } },
      { key: "fulcrumCm", label: "Load to pivot", control: "fader", min: 5, max: 150, step: 1, unit: "cm", default: 40, showIf: { key: "mode", equals: "lever" } },
      { key: "rampM", label: "Ramp length", control: "fader", min: 1, max: 20, step: 0.1, unit: "m", default: 6, showIf: { key: "mode", equals: "ramp" } },
      {
        key: "rampSurface",
        label: "Load on",
        control: "select",
        default: "trolley",
        showIf: { key: "mode", equals: "ramp" },
        options: [
          { value: "trolley", label: "Wheels" },
          { value: "rollers", label: "Rollers" },
          { value: "slide", label: "Sliding" },
        ],
      },
    ],
    presets: [
      { id: "cement", label: "Cement up a scaffold", icon: "weight-hanging", note: "A 50 kg bag hauled 4 m up on a single rope over one pulley.", params: { mode: "pulley", loadKg: 50, ropes: 1, liftM: 4 } },
      { id: "tackle", label: "Block and tackle", icon: "gear", note: "The same 50 kg bag with four ropes sharing the load.", params: { mode: "pulley", loadKg: 50, ropes: 4, liftM: 4 } },
      { id: "engine", label: "Car engine hoist", icon: "car-side", note: "A 150 kg engine on six ropes, but the pulleys are rusty.", params: { mode: "pulley", loadKg: 150, ropes: 6, pulleyType: "rusty", liftM: 1, strengthKg: 40 } },
      { id: "rock", label: "Lever a rock", icon: "cube", note: "A 120 kg rock, a 2 m pole, the pivot 30 cm from the rock.", params: { mode: "lever", loadKg: 120, leverM: 2, fulcrumCm: 30, liftM: 0.3 } },
      { id: "crowbar", label: "Crowbar", icon: "hammer", note: "200 kg shifted with a 1.2 m crowbar and the pivot 8 cm from the load.", params: { mode: "lever", loadKg: 200, leverM: 1.2, fulcrumCm: 8, liftM: 0.1 } },
      { id: "wheelchair", label: "Wheelchair ramp", icon: "wheelchair", note: "100 kg (person and chair) up a 1-in-12 ramp to a 60 cm step.", params: { mode: "ramp", loadKg: 100, liftM: 0.6, rampM: 7.2, rampSurface: "trolley", strengthKg: 15 } },
      { id: "drum", label: "Drum up a plank", icon: "box-open", note: "A 200 kg drum slid up a 3 m plank onto a 1 m truck bed.", params: { mode: "ramp", loadKg: 200, liftM: 1, rampM: 3, rampSurface: "slide", strengthKg: 40 } },
    ],
  },
  {
    id: "eggdrop",
    name: "Egg Drop Bench",
    tagline: "Parachutes and padding: will the egg survive?",
    src: "/sims/eggdrop.html",
    category: "build",
    keywords: ["egg", "egg drop", "parachute", "padding", "drop", "fall", "impact", "crash", "cushion", "science fair", "school project", "terminal velocity"],
    brief:
      "Fall with quadratic drag: m dv/dt = mg - 1/2 rho CdA v^2, parachute open from the start (Cd 1.4; small 0.15 m2, medium 0.4, large 0.9) " +
      "plus the package (Cd 0.6, area grows with padding). Landing: crush distance s = padding thickness x efficiency (paper 0.5, sponge 0.6, " +
      "bubble wrap 0.7, straw frame 0.8) + ground give (concrete 1.5 mm, grass 1 cm, sand 3 cm). Peak deceleration = 1.4 v^2 / (2 s). " +
      "A test PASSES when the egg feels <= 60 g. Score = g to spare. A parachute lowers the landing speed; padding lengthens the stop.",
    params: [
      { key: "heightM", label: "Drop height", control: "fader", min: 1, max: 30, step: 0.5, unit: "m", default: 6 },
      {
        key: "chute",
        label: "Parachute",
        control: "select",
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "small", label: "Small (plastic bag)" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large (bin bag)" },
        ],
      },
      {
        key: "padding",
        label: "Padding",
        control: "select",
        default: "sponge",
        options: [
          { value: "none", label: "None" },
          { value: "paper", label: "Crumpled paper" },
          { value: "sponge", label: "Sponge" },
          { value: "bubble", label: "Bubble wrap" },
          { value: "straws", label: "Straw frame" },
        ],
      },
      { key: "paddingCm", label: "Padding thickness", control: "fader", min: 0, max: 10, step: 0.5, unit: "cm", default: 3 },
      { key: "massG", label: "Package mass", control: "fader", min: 60, max: 500, step: 5, unit: "g", default: 150 },
      {
        key: "surface",
        label: "Lands on",
        control: "select",
        default: "grass",
        options: [
          { value: "grass", label: "Grass" },
          { value: "sand", label: "Sand" },
          { value: "concrete", label: "Concrete" },
        ],
      },
    ],
    presets: [
      { id: "bare", label: "Bare egg", icon: "egg", note: "No parachute, no padding, from a first-floor window.", params: { chute: "none", padding: "none", heightM: 6 } },
      { id: "chute", label: "Parachute only", icon: "umbrella", note: "A medium parachute but nothing around the egg.", params: { chute: "medium", padding: "none", heightM: 6 } },
      { id: "pad", label: "Padding only", icon: "box-open", note: "5 cm of sponge, no parachute.", params: { chute: "none", padding: "sponge", paddingCm: 5, heightM: 6 } },
      { id: "winner", label: "Contest build", icon: "trophy", note: "A medium chute and a 4 cm straw frame, dropped from the third floor.", params: { chute: "medium", padding: "straws", paddingCm: 4, heightM: 10, massG: 180 } },
      { id: "roof", label: "From the roof", icon: "building", note: "20 m up, a large chute and 3 cm of bubble wrap.", params: { heightM: 20, chute: "large", padding: "bubble", paddingCm: 3, massG: 200 } },
      { id: "concrete", label: "Onto concrete", icon: "triangle-exclamation", note: "A small chute and 2 cm of paper, landing on concrete.", params: { chute: "small", padding: "paper", paddingCm: 2, surface: "concrete" } },
    ],
  },
  {
    id: "roadtrip",
    name: "Road Trip Fuel Bench",
    tagline: "Distance, speed, fuel stations: will you make it?",
    src: "/sims/roadtrip.html",
    category: "motion",
    keywords: ["road trip", "trip", "journey", "travel", "fuel", "petrol", "diesel", "mileage", "km per litre", "consumption", "tank", "filling station", "highway", "expressway", "bus", "range"],
    brief:
      "Fuel use km by km. L/100 km = vehicle figure at 90 km/h (small car 5.5, saloon 7.5, SUV 10.5, 18-seater bus 13) x (0.55 + 0.45 (v/90)^2) " +
      "x (1 + 1.5% per extra passenger; bus 0.6%) x 1.08 with AC x 1.12 with a loaded roof rack. Filling stations every stationGapKm; the driver fills up " +
      "when under half a tank or when the fuel left won't safely reach the next stop. A test PASSES when the tank never runs empty. " +
      "Score = litres left at the lowest point. Going faster costs fuel fast: 130 km/h uses ~40% more than 90.",
    params: [
      { key: "distanceKm", label: "Distance", control: "dial", min: 20, max: 1500, step: 10, unit: "km", default: 520 },
      { key: "speedKmh", label: "Cruising speed", control: "dial", min: 40, max: 160, step: 5, unit: "km/h", default: 100 },
      {
        key: "car",
        label: "Vehicle",
        control: "select",
        default: "sedan",
        options: [
          { value: "small", label: "Small car" },
          { value: "sedan", label: "Saloon car" },
          { value: "suv", label: "SUV" },
          { value: "bus", label: "18-seater bus" },
        ],
      },
      { key: "tankL", label: "Tank size", control: "fader", min: 20, max: 120, step: 1, unit: "L", default: 50 },
      { key: "startPct", label: "Tank at the start", control: "fader", min: 5, max: 100, step: 5, unit: "%", default: 100 },
      { key: "passengers", label: "People on board", control: "fader", min: 1, max: 18, step: 1, default: 2 },
      { key: "ac", label: "AC on", control: "toggle", default: true },
      { key: "roofLoad", label: "Loaded roof rack", control: "toggle", default: false },
      { key: "stationGapKm", label: "Stations every", control: "fader", min: 20, max: 400, step: 10, unit: "km", default: 150 },
      { key: "priceL", label: "Fuel price", control: "fader", min: 200, max: 2500, step: 10, unit: "/L", default: 1000 },
    ],
    presets: [
      { id: "ibadan", label: "Lagos → Ibadan", icon: "car-side", note: "A 130 km run on a quarter tank.", params: { distanceKm: 130, startPct: 25, speedKmh: 100, stationGapKm: 60 } },
      { id: "abuja", label: "Lagos → Abuja", icon: "road", note: "About 750 km in a saloon car at 110 km/h.", params: { distanceKm: 750, speedKmh: 110, stationGapKm: 150 } },
      { id: "fast", label: "Flat out at 140", icon: "gauge-high", note: "650 km at 140 km/h with stations 200 km apart.", params: { distanceKm: 650, speedKmh: 140, stationGapKm: 200 } },
      { id: "bus", label: "Full bus", icon: "bus", note: "An 18-seater, every seat taken, 600 km at 90 km/h.", params: { car: "bus", passengers: 18, tankL: 70, distanceKm: 600, speedKmh: 90, stationGapKm: 200 } },
      { id: "empty", label: "Long empty stretch", icon: "triangle-exclamation", note: "An SUV at 140 km/h with no fuel for 400 km.", params: { car: "suv", tankL: 60, speedKmh: 140, stationGapKm: 400, distanceKm: 900 } },
      { id: "quarter", label: "Leaving on a quarter tank", icon: "gas-pump", note: "500 km, first station 200 km away, a quarter tank to start.", params: { distanceKm: 500, startPct: 25, stationGapKm: 200 } },
    ],
  },
  {
    id: "rainwater",
    name: "Rainwater Tank Bench",
    tagline: "Roof, rain and tank size: does it run dry?",
    src: "/sims/rainwater.html",
    category: "home",
    keywords: ["rain", "rainwater", "tank", "harvest", "roof", "gutter", "water", "dry season", "rainy season", "storage", "litres", "borehole", "well"],
    brief:
      "Daily water balance over a typical year from 1 January (after a warm-up year, so the tank starts the year with what it really holds). Inflow (L) = rain (mm) x roof area (m2) x run-off (metal 0.85, tile 0.75, thatch 0.5); " +
      "use = people x litres per person a day; overflow is lost when full. Monthly rain is a typical year spread evenly: Lagos 1,486 mm with two rainy " +
      "seasons, Abuja 1,340 mm one wet season, Kano 732 mm short wet season, Nairobi 975 mm long and short rains. " +
      "A test PASSES when the tank is empty on no more than allowDryDays days. Score = % of the year with water.",
    params: [
      {
        key: "climate",
        label: "Climate",
        control: "select",
        default: "lagos",
        options: [
          { value: "lagos", label: "Lagos" },
          { value: "abuja", label: "Abuja" },
          { value: "kano", label: "Kano" },
          { value: "nairobi", label: "Nairobi" },
        ],
      },
      { key: "roofM2", label: "Roof area", control: "dial", min: 10, max: 400, step: 5, unit: "m²", default: 80 },
      {
        key: "roof",
        label: "Roof",
        control: "select",
        default: "metal",
        options: [
          { value: "metal", label: "Metal sheet" },
          { value: "tile", label: "Tiles" },
          { value: "thatch", label: "Thatch" },
        ],
      },
      { key: "tankL", label: "Tank", control: "dial", min: 500, max: 50000, step: 500, unit: "L", default: 5000 },
      { key: "people", label: "People", control: "fader", min: 1, max: 20, step: 1, default: 5 },
      { key: "usePerPerson", label: "Use per person", control: "fader", min: 5, max: 150, step: 1, unit: "L/day", default: 40 },
      { key: "allowDryDays", label: "Dry days allowed", control: "fader", min: 0, max: 120, step: 1, unit: "days", default: 0 },
    ],
    presets: [
      { id: "lagos", label: "Lagos, 5,000 L tank", icon: "house", note: "A family of 5 on an 80 m² metal roof. Is a 5,000 L tank enough?", params: {} },
      { id: "lagos-big", label: "Lagos, 15,000 L tank", icon: "droplet", note: "The same family and roof with three times the storage.", params: { tankL: 15000 } },
      { id: "kano", label: "Kano dry season", icon: "sun", note: "Six months with almost no rain: 100 m² roof, 10,000 L, 6 people.", params: { climate: "kano", roofM2: 100, tankL: 10000, people: 6, usePerPerson: 30 } },
      { id: "kano-big", label: "Kano, built for it", icon: "warehouse", note: "A bigger roof and a 30,000 L tank for a family of 4 using 25 L each.", params: { climate: "kano", roofM2: 150, tankL: 30000, people: 4, usePerPerson: 25 } },
      { id: "drinking", label: "Drinking and cooking only", icon: "glass-water", note: "Just 8 L each a day in Abuja, from a 6,000 L tank.", params: { climate: "abuja", tankL: 6000, usePerPerson: 8 } },
      { id: "clinic", label: "Small clinic", icon: "hospital", note: "200 m² of roof, a 50,000 L tank, 15 people using 20 L each.", params: { climate: "abuja", roofM2: 200, tankL: 50000, people: 15, usePerPerson: 20 } },
      { id: "nairobi", label: "Nairobi home", icon: "cloud-rain", note: "Two rainy seasons, 100 m² roof, 15,000 L tank.", params: { climate: "nairobi", roofM2: 100, tankL: 15000, people: 4, usePerPerson: 40 } },
      { id: "thatch", label: "Thatched hut", icon: "tree", note: "40 m² of thatch (half the rain soaks in), 2,000 L tank, 4 people.", params: { roof: "thatch", roofM2: 40, tankL: 2000, people: 4, usePerPerson: 20 } },
    ],
  },
  {
    id: "generator",
    name: "Generator Fuel Bench",
    tagline: "kVA, load, outage hours, fuel per week",
    src: "/sims/generator.html",
    category: "home",
    keywords: ["generator", "gen", "kva", "petrol", "diesel", "fuel", "nepa", "outage", "light", "blackout", "power cut", "litres per hour", "i better pass my neighbour"],
    brief:
      "One night: the grid goes off at 18:00 for outageH hours. Rated power = kVA x 800 W (pf 0.8); running above 90% of it is an overload. " +
      "Fuel L/h = rated kW x k x (0.25 + 0.75 x load fraction), k = 0.6 + 0.4/sqrt(kW) for petrol, 0.32 + 0.2/sqrt(kW) for diesel (idle burns a quarter). " +
      "Weekly cost = L/h x outage hours x 7 x price. A test PASSES when it is not overloaded, one tank lasts the whole outage, and a week of fuel " +
      "fits the budget. Score = money left in the weekly budget.",
    params: [
      {
        key: "genKva",
        label: "Generator",
        control: "select",
        default: "2.5",
        options: [
          { value: "0.65", label: "0.65 kVA" },
          { value: "1.2", label: "1.2 kVA" },
          { value: "2.5", label: "2.5 kVA" },
          { value: "3.5", label: "3.5 kVA" },
          { value: "5", label: "5 kVA" },
          { value: "7.5", label: "7.5 kVA" },
          { value: "10", label: "10 kVA" },
        ],
      },
      {
        key: "fuel",
        label: "Fuel",
        control: "select",
        default: "petrol",
        options: [
          { value: "petrol", label: "Petrol" },
          { value: "diesel", label: "Diesel" },
        ],
      },
      { key: "loadW", label: "Load", control: "dial", min: 50, max: 10000, step: 50, unit: "W", default: 1200 },
      { key: "outageH", label: "Outage each night", control: "fader", min: 1, max: 24, step: 0.5, unit: "h", default: 8 },
      { key: "tankL", label: "Fuel tank", control: "fader", min: 2, max: 100, step: 1, unit: "L", default: 15 },
      { key: "priceL", label: "Fuel price", control: "fader", min: 200, max: 2500, step: 10, unit: "/L", default: 1000 },
      { key: "budget", label: "Weekly fuel budget", control: "dial", min: 5000, max: 500000, step: 5000, default: 80000 },
    ],
    presets: [
      { id: "flat", label: "Small flat", icon: "house", note: "A 2.5 kVA petrol gen running fans, lights and a TV (800 W) for 6 hours.", params: { genKva: "2.5", loadW: 800, outageH: 6, budget: 45000 } },
      { id: "tiger", label: "“I better pass my neighbour”", icon: "lightbulb", note: "The little 0.65 kVA: a fan, bulbs and phone charging (300 W).", params: { genKva: "0.65", loadW: 300, outageH: 6, tankL: 4, budget: 25000 } },
      { id: "ac", label: "AC on a 3.5 kVA", icon: "snowflake", note: "Fridge and a 1.5 HP AC overnight: 2,600 W for 10 hours.", params: { genKva: "3.5", loadW: 2600, outageH: 10, tankL: 20, budget: 120000 } },
      { id: "shop", label: "Shop with a freezer", icon: "store", note: "5 kVA petrol, 2 kW of load, 12 hours a day.", params: { genKva: "5", loadW: 2000, outageH: 12, tankL: 25, budget: 180000 } },
      { id: "diesel", label: "Big house on diesel", icon: "gas-pump", note: "10 kVA diesel carrying 4.5 kW for 14 hours.", params: { genKva: "10", fuel: "diesel", loadW: 4500, outageH: 14, tankL: 60, priceL: 1300, budget: 300000 } },
      { id: "price", label: "Fuel jumps to 1,400", icon: "chart-line", note: "The default setup after a fuel price rise.", params: { priceL: 1400 } },
    ],
  },
  {
    id: "cooling",
    name: "Room Cooling Bench",
    tagline: "Is that AC big enough? Roof, windows, people, heat",
    src: "/sims/cooling.html",
    category: "home",
    keywords: ["ac", "air conditioner", "air conditioning", "aircon", "cooling", "hot", "heat", "room", "temperature", "hp", "btu", "fan", "ceiling", "insulation", "roof"],
    brief:
      "Lumped heat balance for one room (3 m ceiling, two outside walls), 5-minute steps over three days, last day shown. Heat in: walls U 2.8 and " +
      "windows U 5.8 x (Tout - Tin); roof U x area x (Tout + sun boost - Tin) with bare zinc U 6 +28 K, zinc with ceiling U 2.2 +22 K, insulated U 0.5, " +
      "concrete slab U 2.8 +16 K, floor above none; sun through windows 350 W/m2 x SHGC (0.7, 0.3 shaded); air leaks; 80 W per person; appliances. " +
      "Outside swings 9 K a day, peaking at 15:00. AC cooling: 1 HP = 2.64 kW (0.75 HP 2.05, 1.5 HP 3.52, 2 HP 5.28, 2.5 HP 6.15), thermostat at target, " +
      "electricity = cooling / 3. A test PASSES when the room never goes over target + 1 °C. Score = comfortable hours a day.",
    params: [
      { key: "roomM2", label: "Room size", control: "dial", min: 6, max: 80, step: 1, unit: "m²", default: 16 },
      {
        key: "acHp",
        label: "AC",
        control: "select",
        default: "1",
        options: [
          { value: "0", label: "None (fan)" },
          { value: "0.75", label: "¾ HP" },
          { value: "1", label: "1 HP" },
          { value: "1.5", label: "1.5 HP" },
          { value: "2", label: "2 HP" },
          { value: "2.5", label: "2.5 HP" },
        ],
      },
      {
        key: "roof",
        label: "Above the room",
        control: "select",
        default: "ceiling",
        options: [
          { value: "zinc", label: "Bare zinc roof" },
          { value: "ceiling", label: "Roof + ceiling board" },
          { value: "insulated", label: "Insulated ceiling" },
          { value: "slab", label: "Concrete slab roof" },
          { value: "floor", label: "Another floor" },
        ],
      },
      { key: "windowM2", label: "Window area", control: "fader", min: 0, max: 12, step: 0.5, unit: "m²", default: 2 },
      { key: "shade", label: "Curtains / shade", control: "toggle", default: false },
      { key: "people", label: "People", control: "fader", min: 0, max: 12, step: 1, default: 2 },
      { key: "appliancesW", label: "Appliances", control: "fader", min: 0, max: 2000, step: 50, unit: "W", default: 200 },
      { key: "outsideMaxC", label: "Hottest outside", control: "fader", min: 25, max: 45, step: 0.5, unit: "°C", default: 34 },
      { key: "targetC", label: "Aim for", control: "fader", min: 18, max: 30, step: 0.5, unit: "°C", default: 26 },
    ],
    presets: [
      { id: "bedroom", label: "Bedroom, 1 HP", icon: "bed", note: "A 16 m² bedroom with a ceiling board and a 1 HP split unit.", params: {} },
      { id: "zinc", label: "Bare zinc roof", icon: "sun", note: "The same room with nothing between it and a hot zinc roof.", params: { roof: "zinc" } },
      { id: "fan", label: "Fan only", icon: "fan", note: "No AC at all, just air moving.", params: { acHp: "0" } },
      { id: "party", label: "Living room party", icon: "people-group", note: "30 m², 8 people, sound system and lights, a 1.5 HP AC.", params: { roomM2: 30, people: 8, appliancesW: 600, acHp: "1.5", windowM2: 4 } },
      { id: "shade", label: "Shade the windows", icon: "umbrella", note: "Big windows, but with curtains drawn against the sun.", params: { windowM2: 5, shade: true } },
      { id: "heat", label: "Heatwave, 40 °C", icon: "temperature-high", note: "A 40 °C afternoon outside.", params: { outsideMaxC: 40 } },
      { id: "shop", label: "Shop under a slab", icon: "store", note: "A 25 m² shop with a flat concrete roof, 4 people, fridges and lights, 2 HP.", params: { roomM2: 25, roof: "slab", acHp: "2", people: 4, appliancesW: 800 } },
    ],
  },
  {
    id: "powerbill",
    name: "Electricity Bill Bench",
    tagline: "Which appliance eats your prepaid units?",
    src: "/sims/powerbill.html",
    category: "home",
    keywords: ["electricity", "bill", "units", "prepaid", "meter", "kwh", "tariff", "band a", "power", "appliance", "nepa", "disco", "light bill", "energy"],
    brief:
      "A 30-day month. kWh = watts x hours a day / 1000 x 30; nothing runs when the grid is off, so hours are capped at supplyHours. " +
      "Fridge ~50 W average all day; 1.5 HP AC 900 W; fans 70 W for 10 h; LED bulbs 10 W for 6 h; TV + decoder 120 W; iron 1,200 W; " +
      "water heater 3,000 W; water pump 750 W. Bill = kWh x tariff x 1.075 (VAT). A test PASSES when the bill fits the monthly budget. " +
      "Score = money left. Anything with a heating element (heater, iron) or a compressor (AC) dominates.",
    params: [
      { key: "tariff", label: "Tariff", control: "dial", min: 20, max: 300, step: 1, unit: "/kWh", default: 209 },
      { key: "supplyHours", label: "Power each day", control: "fader", min: 1, max: 24, step: 1, unit: "h", default: 20 },
      { key: "budget", label: "Monthly budget", control: "dial", min: 1000, max: 300000, step: 1000, default: 60000 },
      { key: "fridge", label: "Fridge", control: "toggle", default: true },
      { key: "acHours", label: "AC", control: "fader", min: 0, max: 24, step: 0.5, unit: "h/day", default: 4 },
      { key: "fans", label: "Fans", control: "fader", min: 0, max: 8, step: 1, default: 2 },
      { key: "bulbs", label: "LED bulbs", control: "fader", min: 0, max: 30, step: 1, default: 8 },
      { key: "tvHours", label: "TV", control: "fader", min: 0, max: 18, step: 0.5, unit: "h/day", default: 6 },
      { key: "ironHours", label: "Pressing iron", control: "fader", min: 0, max: 3, step: 0.25, unit: "h/day", default: 0.5 },
      { key: "heaterHours", label: "Water heater", control: "fader", min: 0, max: 4, step: 0.25, unit: "h/day", default: 0 },
      { key: "pumpHours", label: "Water pump", control: "fader", min: 0, max: 6, step: 0.25, unit: "h/day", default: 0.5 },
    ],
    presets: [
      { id: "home", label: "Typical home", icon: "house", note: "Fridge, 2 fans, 8 bulbs, TV, 4 hours of AC, 20 hours of supply.", params: {} },
      { id: "basics", label: "Just the basics", icon: "lightbulb", note: "Fridge, fans, lights and TV. No AC or heater.", params: { acHours: 0, heaterHours: 0, pumpHours: 0, ironHours: 0.25, budget: 30000 } },
      { id: "acnight", label: "AC all night", icon: "snowflake", note: "The AC runs 10 hours a night.", params: { acHours: 10, budget: 60000 } },
      { id: "heater", label: "Hot-shower habit", icon: "shower", note: "The water heater on for 1.5 hours a day.", params: { heaterHours: 1.5 } },
      { id: "fewer", label: "Cheaper tariff, fewer hours", icon: "clock", note: "A lower tariff band but only 12 hours of power a day.", params: { tariff: 63, supplyHours: 12 } },
      { id: "big", label: "Big family + borehole", icon: "people-group", note: "4 fans, 15 bulbs, 8 hours of TV, 6 of AC, a 2-hour pump.", params: { fans: 4, bulbs: 15, tvHours: 8, acHours: 6, pumpHours: 2, budget: 100000 } },
    ],
  },
  {
    id: "loan",
    name: "Loan Repayment Bench",
    tagline: "Monthly payments, flat vs reducing rates, true cost",
    src: "/sims/loan.html",
    category: "money",
    keywords: ["loan", "borrow", "credit", "interest", "repayment", "mortgage", "car loan", "microfinance", "flat rate", "apr", "installment", "debt", "lender", "salary advance"],
    brief:
      "Fixed monthly repayments. Reducing balance: payment = P r / (1 - (1+r)^-n), interest only on what is still owed. Flat rate: interest = P x rate x years " +
      "on the FULL amount, so its true cost is much higher (a flat 30% is roughly a 50%+ true rate). An upfront fee comes off the money received. " +
      "True yearly rate = effective annual rate (IRR) of the money received against the repayments. A test PASSES when the monthly payment <= maxSharePct " +
      "of monthly income. Score = money left in the monthly budget.",
    params: [
      { key: "amount", label: "Amount", control: "dial", min: 10000, max: 50000000, step: 10000, default: 500000 },
      { key: "ratePct", label: "Interest", control: "dial", min: 0, max: 60, step: 0.5, unit: "%/yr", default: 24 },
      {
        key: "method",
        label: "Interest type",
        control: "select",
        default: "reducing",
        options: [
          { value: "reducing", label: "Reducing balance" },
          { value: "flat", label: "Flat rate" },
        ],
      },
      { key: "months", label: "Term", control: "fader", min: 1, max: 120, step: 1, unit: "months", default: 18 },
      { key: "feePct", label: "Upfront fee", control: "fader", min: 0, max: 10, step: 0.5, unit: "%", default: 1 },
      { key: "income", label: "Monthly income", control: "dial", min: 0, max: 5000000, step: 5000, default: 150000 },
      { key: "maxSharePct", label: "Most of income to repay", control: "fader", min: 5, max: 60, step: 1, unit: "%", default: 30 },
    ],
    presets: [
      { id: "phone", label: "Phone on credit", icon: "mobile-screen", note: "₦300,000 over 6 months at 36%, on a ₦120,000 income.", params: { amount: 300000, ratePct: 36, months: 6, feePct: 0, income: 120000 } },
      { id: "mfb-flat", label: "Microfinance, flat rate", icon: "percent", note: "₦500,000 for a year at 30% flat with a 2% fee.", params: { amount: 500000, ratePct: 30, method: "flat", months: 12, feePct: 2, income: 200000 } },
      { id: "mfb-reducing", label: "Same loan, reducing", icon: "chart-line", note: "The same 30% loan on a reducing balance, to compare the true cost.", params: { amount: 500000, ratePct: 30, method: "reducing", months: 12, feePct: 2, income: 200000 } },
      { id: "car", label: "Car loan", icon: "car-side", note: "₦8 million over 4 years at 28%, on ₦1 million a month.", params: { amount: 8000000, ratePct: 28, months: 48, feePct: 1, income: 1000000, maxSharePct: 35 } },
      { id: "payday", label: "Salary advance", icon: "wallet", note: "₦100,000 for one month at 5% a month (60% a year).", params: { amount: 100000, ratePct: 60, months: 1, feePct: 0, income: 150000, maxSharePct: 40 } },
      { id: "mortgage", label: "10-year mortgage", icon: "house", note: "₦30 million over 10 years at 18%, on ₦1.5 million a month.", params: { amount: 30000000, ratePct: 18, months: 120, feePct: 1, income: 1500000, maxSharePct: 33 } },
      { id: "stock", label: "Shop stock loan", icon: "store", note: "₦1 million for 6 months at 24% to buy stock, on ₦700,000 a month.", params: { amount: 1000000, ratePct: 24, months: 6, feePct: 1, income: 700000 } },
    ],
  },
  {
    id: "business",
    name: "Break-even Bench",
    tagline: "A small shop or stall: when do you make your money back?",
    src: "/sims/business.html",
    category: "money",
    keywords: ["business", "shop", "stall", "break even", "breakeven", "profit", "price", "pricing", "startup", "rent", "sales", "margin", "side hustle", "bakery", "barber", "salon", "food"],
    brief:
      "Month by month. Each sale earns price - unitCost. Fixed costs a month = rent + staff x wage + otherMonthly. Sales a day start at salesPerDay and " +
      "grow growthPct a month (capped at double), over daysOpen days a month. Cumulative profit starts at -startup. " +
      "A test PASSES when cumulative profit is back to zero by targetMonths. Score = money in the pocket at the target month. " +
      "Sales a day needed to cover fixed costs = fixed / (margin x daysOpen).",
    params: [
      { key: "price", label: "Price", control: "dial", min: 50, max: 50000, step: 50, unit: "/item", default: 1500 },
      { key: "unitCost", label: "Cost per item", control: "dial", min: 10, max: 40000, step: 10, unit: "/item", default: 900 },
      { key: "salesPerDay", label: "Sales a day", control: "dial", min: 1, max: 1000, step: 1, default: 20 },
      { key: "growthPct", label: "Sales growth", control: "fader", min: 0, max: 20, step: 0.5, unit: "%/mo", default: 3 },
      { key: "daysOpen", label: "Days open", control: "fader", min: 1, max: 31, step: 1, unit: "/mo", default: 26 },
      { key: "rent", label: "Rent", control: "fader", min: 0, max: 2000000, step: 5000, unit: "/mo", default: 50000 },
      { key: "staff", label: "Staff", control: "fader", min: 0, max: 10, step: 1, default: 1 },
      { key: "wage", label: "Wage each", control: "fader", min: 0, max: 500000, step: 5000, unit: "/mo", default: 40000 },
      { key: "otherMonthly", label: "Other costs", control: "fader", min: 0, max: 1000000, step: 5000, unit: "/mo", default: 30000 },
      { key: "startup", label: "Setup cost", control: "dial", min: 0, max: 20000000, step: 10000, default: 300000 },
      { key: "targetMonths", label: "Pay back by", control: "fader", min: 1, max: 36, step: 1, unit: "months", default: 12 },
    ],
    presets: [
      { id: "food", label: "Food stall", icon: "bowl-food", note: "Puff-puff and drinks: ₦200 each, 80 sales a day, tiny rent.", params: { price: 200, unitCost: 120, salesPerDay: 80, daysOpen: 28, rent: 15000, staff: 1, wage: 30000, otherMonthly: 20000, startup: 100000 } },
      { id: "barber", label: "Barbershop", icon: "scissors", note: "₦2,000 a cut, 8 cuts a day, generator fuel in the other costs.", params: { price: 2000, unitCost: 200, salesPerDay: 8, growthPct: 4, rent: 60000, staff: 1, wage: 50000, otherMonthly: 60000, startup: 800000 } },
      { id: "phones", label: "Phone accessories", icon: "mobile-screen", note: "₦3,500 items bought at ₦2,200, 10 sales a day, ₦1.5 million to set up.", params: { price: 3500, unitCost: 2200, salesPerDay: 10, rent: 80000, staff: 1, wage: 40000, otherMonthly: 25000, startup: 1500000, targetMonths: 18 } },
      { id: "bakery", label: "Bakery", icon: "bread-slice", note: "120 loaves a day at ₦1,200 (₦850 to make), 4 staff, ₦4 million of ovens.", params: { price: 1200, unitCost: 850, salesPerDay: 120, rent: 150000, staff: 4, wage: 45000, otherMonthly: 150000, startup: 4000000, targetMonths: 12 } },
      { id: "boutique", label: "Boutique in a mall", icon: "shirt", note: "₦15,000 dresses, 4 sales a day, mall rent and two staff.", params: { price: 15000, unitCost: 9000, salesPerDay: 4, growthPct: 2, rent: 350000, staff: 2, wage: 60000, otherMonthly: 80000, startup: 5000000 } },
      { id: "online", label: "Online store", icon: "laptop", note: "No shop rent: ₦8,000 items, 3 orders a day growing 10% a month.", params: { price: 8000, unitCost: 5500, salesPerDay: 3, growthPct: 10, rent: 0, staff: 0, wage: 0, otherMonthly: 25000, startup: 150000 } },
      { id: "below", label: "Selling below cost", icon: "triangle-exclamation", note: "Priced at ₦900 for items that cost ₦1,000.", params: { price: 900, unitCost: 1000 } },
    ],
  },
  {
    id: "evacuation",
    name: "Evacuation Bench",
    tagline: "Halls, exits, crowds: is everyone out in time?",
    src: "/sims/evacuation.html",
    category: "people",
    keywords: ["evacuation", "evacuate", "fire", "exit", "exits", "fire drill", "crowd", "hall", "church", "school", "event", "stadium", "emergency", "safety", "door", "stampede"],
    brief:
      "People spread through a hall (length hallM, width 0.6 x length). After alarmDelayS each walks to the nearest open exit (straight line + 20%) " +
      "at the crowd's speed; each door passes at most specific flow x width people a second, so crowds queue. Crowds (speed m/s, flow people/m/s): " +
      "adults 1.2, 1.3; school children 1.0, 1.4; older people 0.7, 0.9; mixed with wheelchair users 0.9, 1.0. blocked = one exit unusable. " +
      "A test PASSES when the last person is out within targetMin minutes (2.5 min is a common guide for halls). Score = seconds to spare.",
    params: [
      { key: "people", label: "People", control: "dial", min: 10, max: 3000, step: 10, default: 400 },
      { key: "hallM", label: "Hall length", control: "fader", min: 10, max: 120, step: 1, unit: "m", default: 30 },
      { key: "exits", label: "Exits", control: "fader", min: 1, max: 8, step: 1, default: 2 },
      { key: "exitWidthM", label: "Exit width", control: "fader", min: 0.6, max: 4, step: 0.1, unit: "m", default: 1.2 },
      {
        key: "crowd",
        label: "Crowd",
        control: "select",
        default: "adults",
        options: [
          { value: "adults", label: "Adults" },
          { value: "children", label: "School children" },
          { value: "elderly", label: "Older people" },
          { value: "mixed", label: "Mixed, wheelchairs" },
        ],
      },
      { key: "alarmDelayS", label: "Time to react", control: "fader", min: 0, max: 300, step: 5, unit: "s", default: 30 },
      { key: "blocked", label: "One exit blocked", control: "toggle", default: false },
      { key: "targetMin", label: "Target", control: "fader", min: 1, max: 10, step: 0.5, unit: "min", default: 2.5 },
    ],
    presets: [
      { id: "church", label: "Sunday service", icon: "church", note: "400 adults in a 30 m hall with two 1.2 m doors.", params: {} },
      { id: "assembly", label: "School assembly", icon: "school", note: "900 children in a 40 m hall, three 1.5 m doors, a quick fire drill.", params: { people: 900, crowd: "children", hallM: 40, exits: 3, exitWidthM: 1.5, alarmDelayS: 20 } },
      { id: "wedding", label: "Wedding, exit blocked", icon: "people-group", note: "600 guests, two doors, but one is chained shut.", params: { people: 600, hallM: 35, exits: 2, exitWidthM: 1.2, blocked: true } },
      { id: "care", label: "Care home", icon: "person-cane", note: "80 older residents, slow to react, two narrow doors.", params: { people: 80, crowd: "elderly", hallM: 25, exits: 2, exitWidthM: 1, alarmDelayS: 60, targetMin: 3 } },
      { id: "stadium", label: "Stadium stand", icon: "volleyball", note: "3,000 fans, eight 3 m gates, an 8-minute target.", params: { people: 3000, hallM: 100, exits: 8, exitWidthM: 3, targetMin: 8 } },
      { id: "wide", label: "Wider doors", icon: "door-open", note: "The Sunday service again, with double-width 2.4 m doors.", params: { exitWidthM: 2.4 } },
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
