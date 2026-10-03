/**
 * Builds Playbook's icon assets from Font Awesome Free (icons: CC BY 4.0, https://fontawesome.com/license/free).
 *
 *   node scripts/build-icons.mjs
 *
 * Outputs
 *   public/sims/icons.js        the "game asset" pack sims draw with D.icon(name, ...): window.PB_ICONS = { name: [w, h, d] }
 *   src/lib/icon-index.json     search map for the AI bench builder: name, label, categories, search terms
 *   src/components/ui-icons.ts  the handful of icons the app UI and landing page use
 *   docs/ICONS.md               the same map, human-readable, by category
 *
 * The pack is a curated "physical world" subset (people, animals, vehicles, buildings, food, energy, weather,
 * tools, money, medical, sport...) so it stays small enough to load in every sim iframe. Icons Font Awesome
 * Free doesn't have (elephant, popsicle stick, walrus, ...) are hand-drawn below in the same format, and the
 * sim-specific doodles (pulley, water tank, generator, parachute, keke, ...) live in doodle-sprites.mjs.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { SPRITE_ALIASES, SPRITES } from "./doodle-sprites.mjs";

const require = createRequire(import.meta.url);
const faDir = dirname(require.resolve("@fortawesome/fontawesome-free/package.json"));
const families = JSON.parse(readFileSync(join(faDir, "metadata/icon-families.json"), "utf8"));
const catYaml = readFileSync(join(faDir, "metadata/categories.yml"), "utf8");
const version = JSON.parse(readFileSync(join(faDir, "package.json"), "utf8")).version;

// categories.yml -> { category: [icon names] }
const categories = {};
let cur = null;
for (const l of catYaml.split("\n")) {
  let m = l.match(/^([a-z0-9-]+):\s*$/);
  if (m) {
    cur = m[1];
    categories[cur] = [];
    continue;
  }
  m = l.match(/^\s+-\s+([a-z0-9-]+)\s*$/);
  if (m && cur) categories[cur].push(m[1]);
}

const KEEP = [
  "users-people", "animals", "nature", "fruits-vegetables", "food-beverage", "household", "buildings", "construction",
  "transportation", "automotive", "maritime", "logistics", "moving", "energy", "weather", "disaster", "science",
  "astronomy", "medical-health", "money", "shopping", "sports-fitness", "childhood", "camping", "education",
  "devices-hardware", "accessibility", "travel-hotel", "charity", "time", "clothing-fashion", "gaming", "music-audio",
  "alert", "shapes", "mathematics",
];
// big categories where only the physical objects are useful as assets
const SKIP = new Set(["users-people:user-pen", "users-people:user-gear"]);

const solid = (n) => families[n]?.svgs?.classic?.solid;
const catsOf = {};
for (const [c, names] of Object.entries(categories)) for (const n of names) (catsOf[n] ??= []).push(c);

const pack = {};
const index = [];
for (const c of KEEP) {
  for (const n of categories[c] ?? []) {
    if (pack[n] || SKIP.has(`${c}:${n}`)) continue;
    const s = solid(n);
    if (!s) continue;
    pack[n] = [s.width, s.height, s.path];
    index.push({ n, l: families[n].label, c: catsOf[n].filter((x) => KEEP.includes(x)), t: families[n].search?.terms ?? [] });
  }
}

// ---- hand-drawn extras (viewBox w x h, filled like Font Awesome solids; arrays are filled one by one) ----
const ell = (cx, cy, rx, ry) => `M${cx - rx},${cy}A${rx},${ry} 0 1 0 ${cx + rx},${cy}A${rx},${ry} 0 1 0 ${cx - rx},${cy}Z`;
const box = (x, y, w, h) => `M${x},${y}H${x + w}V${y + h}H${x}Z`;
const EXTRA = {
  elephant: {
    l: "Elephant", c: ["animals"], t: ["elephant", "trunk", "tusk", "safari", "zoo", "heavy animal", "pachyderm", "mammoth"],
    svg: [640, 512, [
      ell(290, 250, 185, 135), ell(470, 205, 95, 92), ell(425, 215, 62, 92),
      box(150, 320, 52, 160), box(230, 340, 52, 140), box(335, 340, 52, 140), box(408, 320, 52, 160),
      "M520,240C585,290 600,380 585,470L625,470C640,375 625,280 560,212Z",
      "M108,215L72,330L92,334L128,236Z",
      "M498,262C520,300 545,312 575,306L572,290C548,292 532,282 520,256Z",
    ]],
  },
  "popsicle-stick": {
    l: "Popsicle stick", c: ["construction", "childhood"], t: ["stick", "popsicle", "lolly stick", "craft stick", "plank", "beam", "lumber", "timber", "member"],
    svg: [512, 200, ["M60,56H452A44,44 0 0 1 452,144H60A44,44 0 0 1 60,56Z"]],
  },
  walrus: {
    l: "Walrus", c: ["animals", "maritime"], t: ["walrus", "seal", "sea lion", "tusk", "arctic", "walrus memory"],
    svg: [640, 512, [
      ell(280, 330, 230, 130), ell(470, 230, 105, 100),
      "M120,420L40,470L60,410Z", "M330,430L300,500L390,490L380,430Z",
      "M445,285L458,440L478,290Z", "M495,285L510,440L528,290Z",
    ]],
  },
  "mug-coffee": { alias: "mug-hot" },
  ...SPRITES,
};
for (const [n, e] of Object.entries(EXTRA)) {
  if (e.alias) continue;
  pack[n] = e.svg;
  index.push({ n, l: e.l, c: e.c, t: e.t });
}

/** Common words that should land on a specific icon. Also used by D.icon at draw time. */
const ALIASES = {
  coffee: "mug-hot", tea: "mug-hot", cup: "mug-hot", "mug-coffee": "mug-hot",
  people: "users", crowd: "people-group", man: "person", woman: "person-dress", kid: "child", boy: "child", girl: "child-dress",
  stick: "popsicle-stick", lift: "elevator", steps: "stairs", staircase: "stairs",
  money: "money-bill", cash: "money-bill-wave", coin: "coins", bank: "building-columns",
  house: "house", home: "house", shop: "shop", store: "store", supermarket: "cart-shopping", cashier: "cash-register",
  fuel: "gas-pump", petrol: "gas-pump", diesel: "gas-pump", inverter: "car-battery", panel: "solar-panel", solar: "solar-panel",
  rain: "cloud-rain", rainwater: "cloud-rain", rainfall: "cloud-rain", roof: "house", dry: "sun", drought: "sun", sunny: "sun", wind: "wind", storm: "cloud-bolt", flood: "house-flood-water",
  boat: "ship", plane: "plane", train: "train", bus: "bus", bike: "bicycle", car: "car-side", lorry: "truck",
  hospital: "hospital", doctor: "user-doctor", nurse: "user-nurse", patient: "bed-pulse", germ: "virus", flu: "virus",
  tree: "tree", plant: "seedling", crop: "wheat-awn", farm: "tractor", cow: "cow", chicken: "kiwi-bird",
  weight: "weight-hanging", load: "weight-hanging", box: "box", parcel: "box", crate: "box",
  water: "droplet", fire: "fire", heat: "temperature-high", cold: "snowflake", battery: "battery-full",
  ...SPRITE_ALIASES,
};

writeFileSync(
  "public/sims/icons.js",
  `/* Playbook icon pack: ${Object.keys(pack).length} icons for sims to draw with D.icon(name, x, y, size).\n` +
    ` * Font Awesome Free ${version} by @fontawesome - https://fontawesome.com - License (icons): CC BY 4.0, https://fontawesome.com/license/free\n` +
    ` * plus hand-drawn extras (elephant, walrus, pulley, water-tank, generator, parachute, keke...). Generated by scripts/build-icons.mjs; do not edit. */\n` +
    `window.PB_ICON_ALIASES=${JSON.stringify(ALIASES)};\nwindow.PB_ICONS=${JSON.stringify(pack)};\n`,
);

writeFileSync("src/lib/icon-index.json", JSON.stringify({ aliases: ALIASES, icons: index }));

// ---- UI icons (React) ----
const UI = [
  "bars", "gear", "circle-question", "moon", "sun", "user", "plus", "rotate", "xmark", "paper-plane", "stop", "flask",
  "wand-magic-sparkles", "envelope", "arrow-right", "arrow-down", "bolt", "droplet", "bread-slice", "wheelchair",
  "circle-check", "circle-xmark", "users", "school", "cash-register", "solar-panel", "piggy-bank", "rocket", "car-side",
  "virus", "bridge", "sliders", "comments", "brain", "database", "cubes", "lock", "laptop", "mobile-screen", "power-off",
  "person-chalkboard", "store", "graduation-cap", "baseball", "lightbulb", "triangle-exclamation", "book-open",
  "right-from-bracket", "key", "palette", "heart", "elevator", "stairs", "mug-hot", "person-walking", "child", "trophy",
  "clock-rotate-left", "plug-circle-bolt", "list-check", "hand-pointer", "pen-ruler", "cow", "tree", "house", "truck", "cloud-rain",
  "bus", "fish", "dog", "cart-shopping", "hospital", "plane", "bicycle", "person-running", "chart-line", "seedling", "weight-hanging",
  "temperature-half", "gas-pump", "fire", "battery-half", "ship", "horse", "car-burst", "people-group", "user-doctor", "faucet",
  "arrow-up", "circle-play", "cube", "box-open", "pizza-slice", "cookie", "tractor", "volleyball",
  // bench presets and the bench picker
  "hammer", "coins", "ruler", "gift", "basket-shopping", "landmark", "basketball", "futbol", "mountain", "clock", "syringe", "city",
  "snowflake", "bed", "wind", "bottle-water", "gauge-high", "filter", "kitchen-set", "tv", "egg", "umbrella", "building", "road",
  "warehouse", "glass-water", "fan", "temperature-high", "shower", "percent", "wallet", "bowl-food", "scissors", "shirt", "church",
  "person-cane", "door-open", "magnifying-glass", "battery-half", "people-roof",
];
const brands = (n) => families[n]?.svgs?.classic?.brands;
const ui = {};
for (const n of UI) {
  const s = solid(n);
  if (!s) throw new Error(`no solid icon "${n}"`);
  ui[n] = [s.width, s.height, s.path];
}
for (const n of ["x-twitter", "github"]) {
  const s = brands(n);
  ui[n] = [s.width, s.height, s.path];
}
for (const n of ["elephant", "walrus", "popsicle-stick", ...Object.keys(SPRITES)]) ui[n] = pack[n];
writeFileSync(
  "src/components/ui-icons.ts",
  `/* Generated by scripts/build-icons.mjs; do not edit. Font Awesome Free ${version} (CC BY 4.0) + hand-drawn extras. */\n` +
    `export const UI_ICONS = ${JSON.stringify(ui)} as const satisfies Record<string, readonly [number, number, string | readonly string[]]>;\n` +
    `export type UiIconName = keyof typeof UI_ICONS;\n`,
);

// ---- human-readable map ----
const byCat = {};
for (const i of index) for (const c of i.c.length ? i.c : ["other"]) (byCat[c] ??= []).push(i.n);
let md = `# Icon map\n\nEvery icon a sim can draw with \`D.icon(name, x, y, size)\`. ${index.length} icons: Font Awesome Free ${version} ` +
  `(CC BY 4.0) plus hand-drawn extras. Generated by \`scripts/build-icons.mjs\`.\n\n` +
  `The AI bench builder doesn't read this whole list: \`src/lib/icons.ts\` searches the map (names, labels, Font Awesome's search terms and ` +
  `the aliases below) for the words in a request and shows the model only the best matches. People are drawn as stick figures with ` +
  `\`D.person(...)\`, and anything with no good icon becomes a labelled token, \`D.token(label, ...)\`.\n\n` +
  `## Aliases\n\n${Object.entries(ALIASES).map(([a, b]) => `\`${a}\` → \`${b}\``).join(", ")}\n\n`;
for (const c of Object.keys(byCat).sort()) md += `## ${c}\n\n${byCat[c].map((n) => `\`${n}\``).join(" ")}\n\n`;
writeFileSync("docs/ICONS.md", md);

const kb = (Buffer.byteLength(readFileSync("public/sims/icons.js")) / 1024).toFixed(0);
console.log(`icons.js: ${Object.keys(pack).length} icons, ${kb} KB; index: ${index.length}; ui: ${Object.keys(ui).length}`);
