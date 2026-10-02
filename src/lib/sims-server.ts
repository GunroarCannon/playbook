import "server-only";
import { nanoid } from "nanoid";
import { db, type CustomSim, type User } from "./db";
import { remember } from "./memory";
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

/** Every bench this person can use: the built-ins plus their own. */
export async function userSims(user: User): Promise<SimDef[]> {
  const mine = await db.listCustomSims(user.id);
  return [...SIMS, ...mine.map(customToDef)];
}

/** Build a new bench from a plain-language request, save it, and note it in Walrus Memory. */
export async function createCustomSim(user: User, request: string, opts: { context?: string; memoryOn?: boolean } = {}) {
  const started = Date.now();
  const gen = await generateSim({ mode: "create", request, context: opts.context });
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
  return { sim: customToDef(row), code: row.code, version: row.version, ms: Date.now() - started, attempts: gen.attempts };
}

/** Repair a crashing bench (runtime error from the browser) or apply a requested change. */
export async function reviseCustomSim(user: User, id: string, how: { error?: string; change?: string }) {
  const row = await db.getCustomSim(user.id, id);
  if (!row) throw new Error("Bench not found");
  const base: GeneratedSim = {
    spec: { name: row.title, tagline: row.description, brief: row.brief, params: row.params as ParamSpec[], keywords: [] },
    code: row.code,
  };
  const gen = await generateSim(how.error ? { mode: "repair", base, error: how.error } : { mode: "revise", base, change: how.change });
  const next = await db.updateCustomSim(user.id, id, {
    title: gen.spec.name,
    description: gen.spec.tagline,
    brief: gen.spec.brief,
    code: gen.code,
    params: gen.spec.params,
  });
  if (!next) throw new Error("Bench not found");
  return { sim: customToDef(next), code: next.code, version: next.version, attempts: gen.attempts };
}
