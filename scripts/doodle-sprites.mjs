/**
 * Hand-drawn sprites for the sim icon pack: objects sims need that Font Awesome Free doesn't have
 * (pulleys, water tanks, generators, parachutes, kekes...). Same format as a Font Awesome solid:
 * [viewBox width, height, path | path[]]; each array entry is filled on its own.
 *
 * Shapes are built from a few primitives. Solids wind clockwise and holes anticlockwise, so a hole drawn in the
 * same path string as its solid cuts through it (canvas fills with the nonzero rule).
 */

const r = (n) => Math.round(n * 10) / 10;

/** Polygon. hole=true winds it the other way so it cuts the solid it shares a path with. */
export function P(pts, hole = false) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  const cw = a > 0; // y points down, so a positive area is clockwise on screen
  const ordered = cw !== hole ? pts : [...pts].reverse();
  return `M${ordered.map(([x, y]) => `${r(x)},${r(y)}`).join("L")}Z`;
}
/** Box. */
export const B = (x, y, w, h, hole = false) => P([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], hole);
/** Ellipse (as a 36-gon, so its winding is explicit). */
export function E(cx, cy, rx, ry = rx, hole = false, from = 0, to = Math.PI * 2, n = 36) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = from + ((to - from) * i) / n;
    pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  if (to - from >= Math.PI * 2 - 1e-6) pts.pop();
  return P(pts, hole);
}
/** Ring (a circle with a hole). */
export const ring = (cx, cy, rad, w) => E(cx, cy, rad) + E(cx, cy, rad - w, rad - w, true);
/** Thick straight stroke from (x1,y1) to (x2,y2). */
export function S(x1, y1, x2, y2, w) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (-(y2 - y1) / len) * (w / 2), ny = ((x2 - x1) / len) * (w / 2);
  return P([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]]);
}
/** Rounded box. */
export function RB(x, y, w, h, rad, hole = false) {
  const pts = [];
  const corner = (cx, cy, a0) => { for (let i = 0; i <= 6; i++) { const t = a0 + (i / 6) * (Math.PI / 2); pts.push([cx + Math.cos(t) * rad, cy + Math.sin(t) * rad]); } };
  corner(x + w - rad, y + rad, -Math.PI / 2);
  corner(x + w - rad, y + h - rad, 0);
  corner(x + rad, y + h - rad, Math.PI / 2);
  corner(x + rad, y + rad, Math.PI);
  return P(pts, hole);
}
/** A thick polyline (a stroke through several points). */
export const L = (pts, w) => pts.slice(1).map((p, i) => S(pts[i][0], pts[i][1], p[0], p[1], w)).join("");
/** A thick arc of an ellipse (a curved stroke), from angle a0 to a1. */
export function A(cx, cy, rx, ry, a0, a1, w, n = 18) {
  const outer = [], inner = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    outer.push([cx + Math.cos(t) * (rx + w / 2), cy + Math.sin(t) * (ry + w / 2)]);
    inner.push([cx + Math.cos(t) * (rx - w / 2), cy + Math.sin(t) * (ry - w / 2)]);
  }
  return P([...outer, ...inner.reverse()]);
}

const zig = (x0, x1, y0, y1, turns) => {
  const pts = [];
  for (let i = 0; i <= turns * 2; i++) pts.push([i % 2 ? x1 : x0, y0 + ((y1 - y0) * i) / (turns * 2)]);
  return pts;
};

/** name -> { l: label, c: categories, t: search terms, svg: [w, h, paths] } */
export const SPRITES = {
  pulley: {
    l: "Pulley", c: ["construction", "science"], t: ["pulley", "block and tackle", "hoist", "winch", "rope", "lift", "sheave", "simple machine"],
    svg: [512, 512, [
      B(206, 0, 100, 44), B(238, 40, 36, 150),
      ring(256, 210, 118, 34) + E(256, 210, 26),
      B(126, 210, 22, 302), B(364, 210, 22, 190),
      ring(375, 430, 34, 14),
    ]],
  },
  "water-tank": {
    l: "Water tank", c: ["household", "buildings", "energy"], t: ["tank", "water tank", "overhead tank", "storage tank", "reservoir", "cistern", "geepee", "poly tank", "rainwater"],
    svg: [512, 512, [
      RB(126, 44, 260, 236, 46) + B(118, 118, 276, 12, true) + B(118, 196, 276, 12, true),
      B(206, 18, 100, 30),
      B(92, 280, 328, 26),
      S(128, 306, 104, 508, 24), S(384, 306, 408, 508, 24), S(116, 384, 396, 476, 14), S(396, 384, 116, 476, 14),
    ]],
  },
  generator: {
    l: "Generator", c: ["energy", "construction"], t: ["generator", "gen", "genset", "kva", "petrol generator", "diesel generator", "nepa", "power", "i better pass my neighbour"],
    svg: [640, 512, [
      RB(84, 126, 472, 250, 26) + B(122, 176, 170, 18, true) + B(122, 214, 170, 18, true) + B(122, 252, 170, 18, true) + E(440, 228, 56, 56, true),
      E(440, 228, 34),
      B(56, 84, 528, 24), B(56, 84, 24, 300), B(560, 84, 24, 300),
      B(404, 96, 70, 30),
      ring(160, 428, 58, 22), B(470, 376, 70, 80),
      B(584, 196, 56, 24),
    ]],
  },
  parachute: {
    l: "Parachute", c: ["transportation", "childhood"], t: ["parachute", "chute", "skydive", "canopy", "drop", "egg drop", "glide", "air drop"],
    svg: [512, 512, [
      P([...Array.from({ length: 25 }, (_, i) => { const t = Math.PI + (i / 24) * Math.PI; return [256 + Math.cos(t) * 230, 210 + Math.sin(t) * 180]; }),
         [432, 196], [372, 214], [314, 196], [256, 214], [198, 196], [140, 214], [80, 196]]),
      S(36, 212, 240, 404, 10), S(146, 210, 248, 404, 10), S(366, 210, 264, 404, 10), S(476, 212, 272, 404, 10),
      RB(214, 396, 84, 84, 14),
    ]],
  },
  "egg-cracked": {
    l: "Cracked egg", c: ["food-beverage", "childhood"], t: ["egg", "cracked egg", "broken egg", "egg drop", "splat", "fragile", "break"],
    svg: [384, 512, [
      E(192, 290, 152, 206) + P([[38, 262], [104, 228], [150, 286], [210, 236], [272, 290], [348, 246], [350, 266], [274, 312], [212, 260], [152, 310], [102, 252], [40, 284]], true),
      E(80, 470, 60, 18), E(300, 478, 50, 14),
    ]],
  },
  "truss-bridge": {
    l: "Truss bridge", c: ["construction", "transportation"], t: ["bridge", "truss", "warren", "pratt", "girder", "span", "footbridge", "railway bridge", "steel bridge"],
    svg: [640, 384, [
      B(20, 246, 600, 26), B(70, 104, 500, 20),
      L([[80, 252], [140, 114], [200, 252], [260, 114], [320, 252], [380, 114], [440, 252], [500, 114], [560, 252]], 16),
      B(20, 272, 66, 112), B(554, 272, 66, 112),
    ]],
  },
  "tower-crane": {
    l: "Tower crane", c: ["construction"], t: ["crane", "tower crane", "construction", "building site", "lift", "hoist", "jib", "site"],
    svg: [512, 512, [
      B(146, 112, 16, 400), B(200, 112, 16, 400),
      L(zig(154, 208, 140, 500, 6), 9),
      B(30, 96, 470, 22), S(174, 96, 174, 22, 16), S(174, 22, 40, 96, 8), S(174, 22, 494, 96, 8),
      B(36, 118, 74, 52), B(150, 118, 62, 44),
      B(410, 118, 6, 200), B(392, 316, 42, 22), B(380, 338, 66, 56),
      B(110, 496, 140, 16),
    ]],
  },
  "ac-unit": {
    l: "Air conditioner", c: ["household", "weather"], t: ["ac", "air conditioner", "air conditioning", "aircon", "split unit", "cooling", "hvac", "cold air"],
    svg: [640, 384, [
      RB(40, 40, 560, 190, 44) + B(96, 178, 448, 18, true) + E(520, 96, 12, 12, true),
      S(150, 262, 126, 344, 16), S(320, 262, 320, 356, 16), S(490, 262, 514, 344, 16),
    ]],
  },
  "prepaid-meter": {
    l: "Prepaid meter", c: ["energy", "household", "devices-hardware"], t: ["meter", "prepaid meter", "electricity meter", "units", "kwh", "token", "light bill", "disco"],
    svg: [384, 512, [
      RB(40, 20, 304, 472, 30) + B(80, 66, 224, 96, true)
        + [0, 1, 2].flatMap((col) => [0, 1, 2, 3].map((row) => B(86 + col * 76, 214 + row * 58, 60, 40, true))).join("")
        + E(110, 456, 14, 14, true),
      B(104, 92, 176, 14), B(104, 120, 120, 14),
    ]],
  },
  shelf: {
    l: "Shelf with books", c: ["household", "education"], t: ["shelf", "bookshelf", "books", "plank", "bracket", "shelving", "library", "storage"],
    svg: [640, 384, [
      B(40, 196, 560, 28),
      P([[92, 224], [112, 224], [112, 340], [210, 224], [236, 224], [92, 384]]), P([[548, 224], [528, 224], [528, 340], [430, 224], [404, 224], [548, 384]]),
      B(92, 96, 44, 100), B(142, 76, 52, 120), B(200, 108, 38, 88), B(244, 86, 46, 110), P([[298, 196], [338, 196], [404, 112], [366, 92]]), B(436, 116, 64, 80), B(436, 96, 64, 14),
    ]],
  },
  ramp: {
    l: "Ramp", c: ["construction", "accessibility"], t: ["ramp", "incline", "slope", "wheelchair ramp", "inclined plane", "loading ramp", "gradient"],
    svg: [640, 384, [
      P([[20, 350], [610, 350], [610, 130]]), B(0, 350, 640, 22),
      P([[298, 238], [373, 210], [345, 135], [270, 163]]),
    ]],
  },
  lever: {
    l: "Lever / seesaw", c: ["science", "childhood"], t: ["lever", "seesaw", "fulcrum", "pivot", "crowbar", "balance", "simple machine", "see-saw", "teeter"],
    svg: [640, 384, [
      P([[32, 208], [604, 120], [608, 146], [36, 234]]),
      P([[320, 174], [258, 334], [382, 334]]), B(200, 334, 240, 20),
      E(104, 160, 62, 46),
    ]],
  },
  spring: {
    l: "Spring", c: ["science", "construction"], t: ["spring", "coil", "elastic", "suspension", "shock absorber", "hooke", "stretch", "bounce"],
    svg: [384, 512, [
      B(70, 24, 244, 26), B(70, 462, 244, 26),
      L([[192, 50], [192, 70], ...zig(84, 300, 90, 422, 5), [192, 442], [192, 462]], 20),
    ]],
  },
  pendulum: {
    l: "Pendulum", c: ["science", "time"], t: ["pendulum", "swing", "clock", "bob", "oscillation", "period", "metronome"],
    svg: [512, 512, [
      B(60, 18, 392, 28), S(256, 44, 362, 372, 10), E(372, 404, 60), E(256, 46, 14),
      ...[0.25, 0.4, 0.55, 0.7, 0.85].map((f) => { const t = Math.PI * (0.3 + f * 0.4); return E(256 + Math.cos(t) * 360, 46 + Math.sin(t) * 360, 9); }),
    ]],
  },
  "bottle-rocket": {
    l: "Bottle rocket", c: ["science", "childhood"], t: ["rocket", "bottle rocket", "water rocket", "launch", "science fair", "fins", "projectile"],
    svg: [384, 512, [
      P([[132, 130], [192, 14], [252, 130]]),
      RB(132, 116, 120, 280, 30),
      P([[132, 290], [56, 420], [132, 398]]), P([[252, 290], [328, 420], [252, 398]]),
      B(170, 394, 44, 34),
      E(160, 466, 12, 18), E(222, 480, 12, 18), E(192, 504, 10, 8),
    ]],
  },
  "hand-pump": {
    l: "Hand pump", c: ["household", "construction"], t: ["pump", "hand pump", "borehole", "well", "water pump", "village pump", "tap"],
    svg: [512, 512, [
      B(204, 112, 74, 340), B(110, 222, 100, 30), B(110, 222, 30, 64),
      S(262, 140, 476, 70, 24), E(262, 140, 28),
      B(150, 452, 180, 40), P([[64, 340], [176, 340], [162, 452], [78, 452]]),
    ]],
  },
  keke: {
    l: "Keke (auto rickshaw)", c: ["transportation", "automotive"], t: ["keke", "keke napep", "tricycle", "auto rickshaw", "rickshaw", "tuk tuk", "tuktuk", "three wheeler", "taxi"],
    svg: [640, 512, [
      RB(116, 54, 404, 44, 18),
      B(128, 96, 18, 160), B(486, 96, 18, 140),
      P([[90, 250], [470, 250], [470, 210], [520, 96], [552, 104], [506, 250], [592, 330], [592, 392], [90, 392]]) + B(170, 300, 140, 50, true),
      ring(170, 420, 58, 22), ring(540, 420, 54, 20),
    ]],
  },
  "market-stall": {
    l: "Market stall", c: ["shopping", "buildings", "food-beverage"], t: ["stall", "market stall", "kiosk", "stand", "vendor", "shop", "market", "trader", "roadside stall"],
    svg: [640, 512, [
      B(56, 60, 528, 56),
      ...[0, 1, 2, 3, 4, 5].map((k) => E(100 + k * 88, 116, 44, 26, false, 0, Math.PI)),
      B(80, 140, 22, 360), B(538, 140, 22, 360),
      B(60, 318, 520, 120) + B(60, 366, 520, 12, true),
      E(160, 300, 36, 24), E(236, 300, 36, 24), E(198, 270, 34, 24), E(380, 296, 52, 28), E(480, 300, 36, 24),
    ]],
  },
  jerrycan: {
    l: "Jerrycan", c: ["automotive", "household"], t: ["jerrycan", "jerry can", "fuel can", "petrol can", "gallon", "keg", "fuel", "water can", "container"],
    svg: [384, 512, [
      RB(48, 110, 288, 384, 28) + P([[110, 200], [274, 410], [274, 388], [128, 200]], true) + P([[274, 200], [110, 410], [110, 388], [256, 200]], true),
      B(70, 40, 194, 76) + B(98, 62, 40, 32, true) + B(158, 62, 40, 32, true) + B(218, 62, 30, 32, true),
      P([[282, 112], [282, 60], [330, 40], [342, 62], [306, 78], [306, 112]]),
    ]],
  },
  wheelbarrow: {
    l: "Wheelbarrow", c: ["construction", "nature"], t: ["wheelbarrow", "barrow", "cart", "construction", "garden", "sand", "cement", "haul"],
    svg: [640, 384, [
      P([[150, 92], [480, 92], [430, 236], [204, 236]]),
      S(160, 120, 24, 70, 18), S(214, 236, 230, 340, 16), S(430, 220, 512, 292, 16),
      ring(512, 296, 66, 24),
    ]],
  },
  goat: {
    l: "Goat", c: ["animals"], t: ["goat", "ram", "sheep", "livestock", "farm animal", "billy goat", "nanny goat", "kid"],
    svg: [640, 512, [
      E(300, 260, 180, 96), S(430, 220, 488, 156, 60), E(510, 150, 64, 44),
      P([[478, 116], [452, 62], [418, 42], [440, 72], [462, 122]]),
      P([[548, 186], [574, 250], [532, 196]]),
      B(160, 320, 30, 170), B(220, 330, 30, 160), B(360, 330, 30, 160), B(420, 320, 30, 170),
      P([[128, 236], [80, 200], [96, 244]]),
    ]],
  },
  hen: {
    l: "Hen", c: ["animals", "food-beverage"], t: ["hen", "chicken", "poultry", "fowl", "rooster", "layer", "broiler", "bird", "egg"],
    svg: [512, 512, [
      E(236, 298, 168, 136), E(370, 160, 64, 62), S(320, 220, 370, 160, 70),
      E(352, 94, 18, 22), E(380, 88, 18, 24), E(406, 98, 16, 20),
      P([[428, 150], [480, 170], [428, 186]]), E(420, 210, 12, 20),
      P([[90, 260], [24, 150], [70, 172], [74, 112], [120, 190]]),
      S(210, 420, 196, 500, 14), S(270, 420, 284, 500, 14), S(150, 500, 230, 500, 12), S(244, 500, 320, 500, 12),
    ]],
  },
  barrel: {
    l: "Drum (barrel)", c: ["household", "construction", "energy"], t: ["barrel", "drum", "oil drum", "water drum", "keg", "storage", "container", "diesel drum"],
    svg: [384, 512, [
      RB(60, 30, 264, 452, 36) + B(56, 150, 272, 16, true) + B(56, 340, 272, 16, true),
      E(120, 64, 18, 12),
    ]],
  },
  "cement-bag": {
    l: "Bag of cement", c: ["construction"], t: ["cement", "bag", "sack", "cement bag", "bag of cement", "sand bag", "rice bag", "50kg", "dangote"],
    svg: [512, 384, [
      P([[48, 92], [256, 64], [464, 92], [478, 192], [464, 300], [256, 326], [48, 300], [34, 192]]) + B(146, 140, 220, 110, true),
      B(176, 170, 160, 20), B(176, 206, 110, 20),
    ]],
  },
  "power-pole": {
    l: "Electric pole", c: ["energy", "buildings"], t: ["pole", "electric pole", "power line", "utility pole", "wires", "transmission", "grid", "nepa pole", "cable"],
    svg: [384, 512, [
      B(180, 30, 26, 470), B(60, 76, 264, 22),
      B(76, 54, 18, 24), B(184, 54, 18, 24), B(290, 54, 18, 24),
      L([[0, 150], [40, 110], [84, 70]], 6), L([[300, 70], [344, 110], [384, 150]], 6),
      B(140, 496, 106, 16),
    ]],
  },
  "cinder-block": {
    l: "Building block", c: ["construction"], t: ["block", "cinder block", "sandcrete block", "brick", "masonry", "wall", "concrete block", "breeze block"],
    svg: [512, 384, [
      B(36, 100, 440, 200) + B(84, 140, 152, 120, true) + B(276, 140, 152, 120, true),
      P([[36, 100], [86, 56], [506, 56], [476, 100]]),
    ]],
  },
  "cooking-pot": {
    l: "Cooking pot", c: ["food-beverage", "household"], t: ["pot", "cooking pot", "stew", "soup", "boil", "cook", "kitchen", "jollof", "saucepan"],
    svg: [512, 384, [
      RB(80, 140, 352, 220, 46), E(256, 132, 196, 28), E(256, 98, 26, 18),
      B(30, 180, 56, 26), B(426, 180, 56, 26),
      A(184, 44, 22, 30, Math.PI * 0.5, Math.PI * 1.5, 12), A(256, 30, 22, 30, Math.PI * 0.5, Math.PI * 1.5, 12), A(328, 44, 22, 30, Math.PI * 0.5, Math.PI * 1.5, 12),
    ]],
  },
};

/** Words that should land on one of these sprites (merged into the pack's aliases). */
export const SPRITE_ALIASES = {
  generator: "generator", genset: "generator", tank: "water-tank", "overhead-tank": "water-tank", crane: "tower-crane",
  rickshaw: "keke", tricycle: "keke", tuktuk: "keke", chicken: "hen", poultry: "hen", drum: "barrel", seesaw: "lever", fulcrum: "lever",
  meter: "prepaid-meter", ac: "ac-unit", aircon: "ac-unit", pump: "hand-pump", borehole: "hand-pump", stall: "market-stall",
  market: "market-stall", kiosk: "market-stall", cement: "cement-bag", sack: "cement-bag", block: "cinder-block", pole: "power-pole",
  incline: "ramp", slope: "ramp", coil: "spring", chute: "parachute", barrow: "wheelbarrow", pot: "cooking-pot",
};
