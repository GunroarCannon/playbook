import "server-only";
import data from "./icon-index.json";

/**
 * The icon map: finds which icons in the sim pack (public/sims/icons.js) best fit a piece of text, so the AI bench
 * builder sees ~20 relevant names instead of all 900. Matches icon names, labels, Font Awesome's search terms and
 * our aliases. See docs/ICONS.md for the full list.
 */

type Entry = { n: string; l: string; c: string[]; t: string[] };
const ICONS = (data as { icons: Entry[] }).icons;
const ALIASES = (data as { aliases: Record<string, string> }).aliases;

const STOP = new Set(
  "a an the and or of for to in on at by with from my our your their is are was were be it this that these those how what when which who " +
    "does do did can could would should will i we you he she they them me us much many more most less per into over under about than then " +
    "if not no yes some any each every bench sim simulation test build make made want need like using use have has get set up down out off day daily size".split(" "),
);

const singular = (w: string) => (w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 3 && w.endsWith("es") && /(s|x|ch|sh)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(singular);

// Precomputed word sets per icon
const PREPARED = ICONS.map((i) => ({
  ...i,
  name: new Set(i.n.split("-").map(singular)),
  label: new Set(words(i.l)),
  terms: new Set(i.t.filter((t) => !/\s/.test(t)).flatMap(words)), // one-word terms: strong
  phrase: new Set(i.t.filter((t) => /\s/.test(t)).flatMap(words)), // words inside phrases ("house of worship"): weak
}));
const ALIAS_WORDS = new Map(Object.entries(ALIASES).map(([k, v]) => [singular(k), v]));

export function suggestIcons(text: string, k = 20): { name: string; label: string }[] {
  const q = [...new Set(words(text))].slice(0, 60);
  if (!q.length) return [];
  const scores = new Map<string, number>();
  const add = (n: string, s: number) => scores.set(n, (scores.get(n) ?? 0) + s);
  for (const w of q) {
    const alias = ALIAS_WORDS.get(w);
    if (alias) add(alias, 9);
    for (const i of PREPARED) {
      let s = 0;
      if (i.n === w) s += 10;
      else if (i.name.has(w)) s += 5;
      if (i.label.has(w)) s += 3;
      if (i.terms.has(w)) s += 3;
      else if (i.phrase.has(w)) s += 1;
      if (!s && w.length >= 5) for (const t of i.terms) if (t.length >= 5 && (t.startsWith(w) || w.startsWith(t))) { s += 1; break; }
      if (s) add(i.n, s - i.n.split("-").length * 0.15); // prefer the plain icon over decorated variants
    }
  }
  // At most 2 per family (house, house-user, house-fire...) so different objects make the list.
  const perFamily = new Map<string, number>();
  const out: { name: string; label: string }[] = [];
  for (const [n, score] of [...scores.entries()].sort((a, b) => b[1] - a[1])) {
    if (score < 2.5) break; // only fuzzy prefix matches left: noise
    const fam = n.split("-")[0];
    const c = perFamily.get(fam) ?? 0;
    if (c >= 2) continue;
    perFamily.set(fam, c + 1);
    out.push({ name: n, label: ICONS.find((i) => i.n === n)?.l ?? n });
    if (out.length >= k) break;
  }
  return out;
}

/** One line for the code-gen prompt: icons that fit this request. */
export function iconHint(text: string) {
  const hits = suggestIcons(text, 22);
  return hits.length
    ? `Icons in the pack that fit this request (use the exact names): ${hits.map((h) => h.name).join(", ")}.`
    : "No pack icon clearly fits this request: draw the objects with D.token(label, ...) and the people with D.person(...).";
}
