import "server-only";
import { nanoid } from "nanoid";
import { db, type CustomSim, type User } from "./db";
import { memoriesForPrompt, recall, remember, type ParsedMemory } from "./memory";
import { generateSim, type GeneratedSim } from "./sim-gen";
import { SIMS, type ParamSpec, type SimDef } from "./sims";

export const isCustomId = (id: string) => id.startsWith("c-");

export function customToDef(row: Omit<CustomSim, "code">): SimDef {
  return {
    id: row.id,
    name: row.title,
    tagline: row.description,
    brief: row.brief,
    params: row.params as ParamSpec[],
    keywords: [],
    src: "",
    custom: true,
  };
}

/** Built-in bench, or one of this person's AI-built benches. Never another user's. */
export async function resolveSim(user: User, id: string | null | undefined): Promise<SimDef | null> {
  if (!id) return null;
  const builtin = SIMS.find((s) => s.id === id);
  if (builtin) return builtin;
  if (!isCustomId(id)) return null;
  const row = await db.getCustomSim(user.id, id);
  return row ? customToDef(row) : null;
}

/**
 * A sheet is named after its bench. While it still has that automatic name (or the old "New sheet"), it follows the
 * bench when the chat switches to or builds another one. Returns the title to store, or null to keep the current one.
 */
export function autoTitle(current: string, oldSim: SimDef | null | undefined, nextSim: SimDef) {
  const automatic = current === "New sheet" || current === oldSim?.name;
  return automatic && current !== nextSim.name ? nextSim.name : null;
}

/** Every bench this person can use: the built-ins plus their own. */
export async function userSims(user: User): Promise<SimDef[]> {
  const mine = await db.listCustomSims(user.id);
  return [...SIMS, ...mine.map(customToDef)];
}

/**
 * What Walrus Memory knows that should shape a new or changed bench: the request itself, plus who the person is
 * (location, currency, level), their preferences, and the limits and equipment they have. Facts about the person
 * always count; results and lessons from other benches only when they're clearly about this request.
 */
export async function memoriesForBuild(user: User, text: string): Promise<ParsedMemory[]> {
  const queries = [
    { q: text.slice(0, 500), limit: 6 },
    { q: "About me: who I am, where I live, my currency, units, level and preferences", limit: 4 },
    { q: "My limits, budget, equipment, tools and materials I have", limit: 4 },
  ];
  const settled = await Promise.allSettled(queries.map((x) => recall(user, x.q, { limit: x.limit })));
  const seen = new Set<string>();
  const personal = new Set(["PROFILE", "PREF", "GOAL", "CONSTRAINT"]);
  return settled
    .flatMap((s) => (s.status === "fulfilled" ? s.value : []))
    .sort((a, b) => b.relevance - a.relevance)
    .filter((m) => {
      const key = m.blobId || m.text;
      if (seen.has(key)) return false;
      seen.add(key);
      // a constraint tied to another bench (e.g. a stick budget) only counts if it's clearly about this request
      if (personal.has(m.kind) && !m.simId) return m.relevance > 0.25;
      return m.relevance > 0.55;
    })
    .slice(0, 8);
}

async function buildContext(user: User, text: string, memoryOn: boolean | undefined, extra?: string) {
  if (memoryOn === false) return { context: undefined, used: [] as string[] };
  const mems = await memoriesForBuild(user, text).catch((e) => {
    console.warn("[sims] memory recall for build failed", e instanceof Error ? e.message : e);
    return [] as ParsedMemory[];
  });
  const lines = mems.length ? memoriesForPrompt(mems).split("\n") : [];
  // memories the chat already recalled for this turn, minus duplicates
  for (const l of extra?.split("\n") ?? []) if (l.trim() && !lines.includes(l) && !l.startsWith("(no stored")) lines.push(l);
  return { context: lines.length ? lines.join("\n") : undefined, used: mems.map((m) => m.sentence) };
}

/** Build a new bench from a plain-language request, shaped by what Walrus Memory knows, save it, and note it in memory. */
export async function createCustomSim(user: User, request: string, opts: { context?: string; memoryOn?: boolean } = {}) {
  const started = Date.now();
  const { context, used } = await buildContext(user, request, opts.memoryOn, opts.context);
  const gen = await generateSim({ mode: "create", request, context });
  const row = await db.createCustomSim({
    id: `c-${nanoid(10)}`,
    user_id: user.id,
    title: gen.spec.name,
    description: gen.spec.tagline,
    brief: gen.spec.brief,
    prompt: request.slice(0, 2000),
    code: gen.code,
    params: gen.spec.params,
  });
  if (opts.memoryOn !== false) {
    await remember(user, {
      kind: "SIM",
      simId: row.id,
      sentence: `${user.username} had the AI build a custom "${row.title}" (${row.description}) for: ${request.slice(0, 200)}`,
      source: "agent",
    }).catch(() => undefined);
  }
  return {
    sim: customToDef(row),
    code: row.code,
    version: row.version,
    ms: Date.now() - started,
    attempts: gen.attempts,
    /** Walrus memories that shaped this build (shown to the person, so they can see memory doing the work). */
    memories: used,
    /** Problems the builder couldn't fix within its attempts (usually empty). */
    issues: gen.issues,
  };
}

/** Repair a crashing bench (runtime error from the browser) or apply a requested change. */
export async function reviseCustomSim(user: User, id: string, how: { error?: string; change?: string; memoryOn?: boolean }) {
  const row = await db.getCustomSim(user.id, id);
  if (!row) throw new Error("Bench not found");
  const base: GeneratedSim = {
    spec: { name: row.title, tagline: row.description, brief: row.brief, params: row.params as ParamSpec[], keywords: [] },
    code: row.code,
  };
  // a crash repair is about the code; a requested change can use what memory knows about the person
  const { context, used } = how.error ? { context: undefined, used: [] as string[] } : await buildContext(user, `${row.title}: ${how.change ?? ""}`, how.memoryOn);
  const gen = await generateSim(how.error ? { mode: "repair", base, error: how.error } : { mode: "revise", base, change: how.change, context });
  const next = await db.updateCustomSim(user.id, id, {
    title: gen.spec.name,
    description: gen.spec.tagline,
    brief: gen.spec.brief,
    code: gen.code,
    params: gen.spec.params,
  });
  if (!next) throw new Error("Bench not found");
  return { sim: customToDef(next), code: next.code, version: next.version, attempts: gen.attempts, memories: used, issues: gen.issues };
}
