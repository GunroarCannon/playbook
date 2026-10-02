import "server-only";
import { MemWal, MemWalMock, type RecallMemory } from "@mysten-incubation/memwal";
import { after } from "next/server";
import { nanoid } from "nanoid";
import { db, type User } from "./db";
import { decryptSecret } from "./auth";
import { getSim, type ParamValue } from "./sims";

/**
 * Walrus Memory integration.
 *
 * Every memory is ONE short tagged sentence, optionally followed by a compact JSON payload:
 *
 *   [WIN · truss] Pratt truss, 40cm span held 6.2kg using 44 sticks. score=6.2 params={"design":"pratt",...}
 *
 * - The tag lets the model (and us) tell constraints from results from failures.
 * - The sentence is what gets embedded, so it is written to be found by natural questions.
 * - params={...} lets a new thread restore dials straight from recalled memory — no local cache involved.
 *
 * Namespacing: shared-account users get namespace `pb-<username>` on the app's MemWal account.
 * Bring-your-own-key users write to their OWN MemWal account, namespace `playbook`.
 */

export const MEMORY_KINDS = ["CONSTRAINT", "GOAL", "PREF", "PROFILE", "WIN", "FAILURE", "INSIGHT", "SIM"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export type ParsedMemory = {
  blobId: string;
  text: string;
  kind: MemoryKind | "NOTE";
  simId: string | null;
  sentence: string;
  params: Record<string, ParamValue> | null;
  score: number | null;
  relevance: number;
  createdAt: string | null;
};

type Client = Pick<
  MemWal,
  "remember" | "recall" | "getRememberStatus" | "waitForRememberJob" | "listNamespaces" | "health"
>;

type Handle = { client: Client; namespace: string; mode: "shared" | "own" | "mock" };

const SERVER_URL = process.env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz";

let sharedClient: MemWal | null = null;
let mockClient: MemWalMock | null = null;

export function memwalConfigured() {
  return Boolean(process.env.MEMWAL_PRIVATE_KEY && process.env.MEMWAL_ACCOUNT_ID);
}

function namespaceFor(user: User) {
  return `pb-${user.username}`;
}

/** Resolve which MemWal client + namespace a user's memories live in. */
export async function memoryFor(user: User): Promise<Handle> {
  if (user.memwal_account_id && user.memwal_key_enc) {
    return {
      client: MemWal.create({
        key: decryptSecret(user.memwal_key_enc),
        accountId: user.memwal_account_id,
        serverUrl: SERVER_URL,
        namespace: "playbook",
      }),
      namespace: "playbook",
      mode: "own",
    };
  }
  if (memwalConfigured()) {
    sharedClient ??= MemWal.create({
      key: process.env.MEMWAL_PRIVATE_KEY!,
      accountId: process.env.MEMWAL_ACCOUNT_ID!,
      serverUrl: SERVER_URL,
    });
    return { client: sharedClient, namespace: namespaceFor(user), mode: "shared" };
  }
  // Local dev without credentials: SDK's in-memory mock, re-seeded from our audit log so restarts don't wipe it.
  mockClient ??= MemWalMock.create();
  const ns = namespaceFor(user);
  const seededKey = `seeded:${ns}`;
  const g = globalThis as unknown as Record<string, boolean>;
  if (!g[seededKey]) {
    g[seededKey] = true;
    const rows = await db.listMemLog(user.id, 500);
    for (const r of rows.reverse()) await mockClient.remember(r.text, ns);
  }
  return { client: mockClient as unknown as Client, namespace: ns, mode: "mock" };
}

export function formatMemory(kind: MemoryKind, simId: string | null, sentence: string, extra?: { score?: number; params?: Record<string, ParamValue> }) {
  const tag = simId ? `[${kind} · ${simId}]` : `[${kind}]`;
  let text = `${tag} ${sentence.trim().replace(/\s+/g, " ")}`;
  if (extra?.score != null && Number.isFinite(extra.score)) text += ` score=${+extra.score.toFixed(3)}`;
  if (extra?.params && Object.keys(extra.params).length) text += ` params=${JSON.stringify(extra.params)}`;
  return text;
}

export function parseMemory(m: RecallMemory): ParsedMemory {
  const text = m.text ?? "";
  const tag = text.match(/^\[([A-Z]+)(?:\s*·\s*([a-z0-9_-]+))?\]\s*/i);
  const kind = (tag && (MEMORY_KINDS as readonly string[]).includes(tag[1].toUpperCase()) ? tag[1].toUpperCase() : "NOTE") as ParsedMemory["kind"];
  let rest = tag ? text.slice(tag[0].length) : text;
  let params: ParsedMemory["params"] = null;
  const pm = rest.match(/\sparams=(\{.*\})\s*$/);
  if (pm) {
    try {
      params = JSON.parse(pm[1]);
    } catch {
      params = null;
    }
    rest = rest.slice(0, pm.index);
  }
  let score: number | null = null;
  const sm = rest.match(/\sscore=(-?[0-9.]+)\s*$/);
  if (sm) {
    score = parseFloat(sm[1]);
    rest = rest.slice(0, sm.index);
  }
  return {
    blobId: m.blob_id,
    text,
    kind,
    simId: tag?.[2]?.toLowerCase() ?? null,
    sentence: rest.trim(),
    params,
    score,
    relevance: Math.max(0, Math.min(1, 1 - (m.distance ?? 1))),
    createdAt: m.created_at ?? null,
  };
}

/**
 * Store one memory without blocking the reply.
 *
 * Measured on the mainnet relayer (2026-10-02): the remember request takes ~3s to be accepted and
 * ~22s until the memory is embedded, encrypted, uploaded and recallable. Small models like to save
 * several facts in one turn, so awaiting each one would add 10s+ to a chat reply. Instead we write
 * the audit-log row, return immediately, and submit + poll the job after the response is sent
 * (next/server `after`). The memory ledger shows submitting → pending → done / failed.
 */
export async function remember(
  user: User,
  input: { kind: MemoryKind; simId?: string | null; sentence: string; score?: number; params?: Record<string, ParamValue>; source: "agent" | "sim" | "user" },
) {
  const { client, namespace, mode } = await memoryFor(user);
  const text = formatMemory(input.kind, input.simId ?? null, input.sentence, { score: input.score, params: input.params });
  const logId = nanoid();
  await db.addMemLog({
    id: logId,
    user_id: user.id,
    kind: input.kind,
    sim_id: input.simId ?? null,
    text,
    job_id: null,
    blob_id: null,
    status: "submitting",
    source: input.source,
  });

  const submit = async () => {
    let jobId: string | null = null;
    try {
      const accepted = await client.remember(text, namespace, { idempotencyKey: logId });
      jobId = accepted.job_id;
      await db.updateMemLog(logId, { job_id: jobId, status: "pending" });
      const res = await client.waitForRememberJob(jobId, { timeoutMs: 50_000, pollIntervalMs: 2000 });
      await db.updateMemLog(logId, { status: "done", blob_id: res.blob_id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // If we have a job id the relayer accepted it; the ledger will re-check its status later.
      console.error("[memwal] remember", jobId ? "still pending" : "failed", logId, msg);
      if (!jobId) await db.updateMemLog(logId, { status: "failed" });
    }
  };
  try {
    after(submit);
  } catch {
    void submit(); // outside a request scope (scripts)
  }
  return { ok: true, text, logId, mode, error: undefined as string | undefined };
}

export async function recall(user: User, query: string, opts: { limit?: number; sort?: "relevance" | "recent"; maxDistance?: number } = {}) {
  const { client, namespace } = await memoryFor(user);
  const res = await client.recall({
    query,
    namespace,
    limit: opts.limit ?? 6,
    sort: opts.sort,
    maxDistance: opts.maxDistance,
  });
  return res.results.map(parseMemory);
}

function dedupe(list: ParsedMemory[]) {
  const seen = new Map<string, ParsedMemory>();
  for (const m of list) {
    const key = m.blobId || m.text;
    const prev = seen.get(key);
    if (!prev || m.relevance > prev.relevance) seen.set(key, m);
  }
  return [...seen.values()];
}

/**
 * Opening a new thread: pull what matters for this bench from Walrus Memory.
 * Several narrow queries beat one broad one for small open models — each returns a focused slice.
 */
export async function bootstrapMemories(user: User, simId: string) {
  const sim = getSim(simId);
  const domain = sim ? sim.name.replace(" Bench", "") : simId;
  const queries: { q: string; limit: number; sort?: "recent" }[] = [
    { q: `My constraints, limits, budget and rules for ${domain}`, limit: 6 },
    { q: `Best configuration that worked and passed on ${domain}`, limit: 5 },
    { q: `What failed, broke, snapped or ran out on ${domain}`, limit: 5 },
    { q: `About me: who I am, my goals and preferences`, limit: 4 },
    { q: `${domain} recent session`, limit: 5, sort: "recent" },
  ];
  const settled = await Promise.allSettled(queries.map((x) => recall(user, x.q, { limit: x.limit, sort: x.sort })));
  const errors = settled.filter((s) => s.status === "rejected").map((s) => String((s as PromiseRejectedResult).reason));
  const all = dedupe(settled.flatMap((s) => (s.status === "fulfilled" ? s.value : [])));

  // Only keep memories that belong to this bench or are about the person in general.
  const relevant = all.filter((m) => !m.simId || m.simId === simId || m.kind === "PROFILE" || m.kind === "PREF");
  const order: Record<string, number> = { CONSTRAINT: 0, PROFILE: 1, GOAL: 2, PREF: 3, FAILURE: 4, WIN: 5, INSIGHT: 6, SIM: 7, NOTE: 8 };
  relevant.sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9) || b.relevance - a.relevance);

  // Dial preset: the best scoring WIN for this bench; ties go to the newest.
  const wins = relevant.filter((m) => m.kind === "WIN" && m.simId === simId && m.params);
  wins.sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity) || (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const preset = wins[0] ?? null;

  return { memories: relevant.slice(0, 14), preset, errors };
}

/** Number of memories in this user's namespace, as reported by the relayer. */
export async function memoryCount(user: User): Promise<number | null> {
  try {
    const { client, namespace, mode } = await memoryFor(user);
    if (mode === "mock") return (await db.listMemLog(user.id, 1000)).filter((m) => m.status !== "failed").length;
    let cursor: string | undefined;
    for (let i = 0; i < 10; i++) {
      const page = await client.listNamespaces({ cursor });
      const hit = page.namespaces.find((n) => n.name === namespace);
      if (hit) return hit.memory_count;
      if (!page.has_more) return 0;
      cursor = page.next_cursor ?? undefined;
    }
    return null;
  } catch (e) {
    console.warn("[memwal] listNamespaces failed", e);
    return null;
  }
}

/** Wrap recalled memories for the prompt. Recalled text is data, never instructions (same idea as the SDK's middleware). */
export function memoriesForPrompt(memories: ParsedMemory[]) {
  if (!memories.length) return "(no stored memories matched)";
  return memories
    .map((m) => {
      const p = m.params ? ` | dials: ${Object.entries(m.params).map(([k, v]) => `${k}=${v}`).join(", ")}` : "";
      return `- [${m.kind}${m.simId ? " · " + m.simId : ""}] ${m.sentence}${m.score != null ? ` (score ${m.score})` : ""}${p}`;
    })
    .join("\n");
}
