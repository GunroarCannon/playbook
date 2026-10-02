import { z } from "zod";
import { errorResponse, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MEMORY_KINDS, memoryCount, memoryFor, remember } from "@/lib/memory";
import { getSim, sanitizeParams } from "@/lib/sims";

/** Audit log of what this user has sent to Walrus Memory, plus the relayer's own count. */
export async function GET() {
  try {
    const user = await requireUser();
    const rows = await db.listMemLog(user.id, 300);

    // Refresh any jobs that were still pending when their request ended.
    const pending = rows.filter((r) => r.job_id && r.status !== "done" && r.status !== "failed").slice(0, 10);
    if (pending.length) {
      const { client, mode } = await memoryFor(user);
      if (mode !== "mock") {
        await Promise.allSettled(
          pending.map(async (r) => {
            const s = await client.getRememberStatus(r.job_id!);
            if (s.status !== r.status || s.blob_id) {
              r.status = s.status === "done" ? "done" : s.status;
              r.blob_id = s.blob_id ?? r.blob_id;
              await db.updateMemLog(r.id, { status: r.status, blob_id: r.blob_id ?? undefined });
            }
          }),
        );
      }
    }

    return Response.json({ memories: rows, walrusCount: await memoryCount(user) });
  } catch (e) {
    return errorResponse(e);
  }
}

const SimResultBody = z.object({
  kind: z.literal("sim_result"),
  simId: z.string(),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
  result: z.object({
    passed: z.boolean(),
    summary: z.string().max(400),
    failureReason: z.string().max(300).optional(),
    score: z.number().optional(),
    scoreLabel: z.string().max(60).optional(),
  }),
});

const ManualBody = z.object({
  kind: z.literal("manual"),
  memoryKind: z.enum(MEMORY_KINDS),
  sentence: z.string().min(4).max(400),
  simId: z.string().nullable().optional(),
});

/**
 * Bench → memory. Called by the client after every test run while memory is ON.
 * We don't store every run: failures are stored unless they repeat a recent one,
 * and passes are stored only when they beat the person's best on that bench.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const raw = await req.json();

    if (raw?.kind === "manual") {
      const b = ManualBody.parse(raw);
      const r = await remember(user, { kind: b.memoryKind, simId: b.simId ?? null, sentence: b.sentence, source: "user" });
      return Response.json({ stored: r.ok, reason: r.ok ? "saved" : r.error, text: r.text });
    }

    const b = SimResultBody.parse(raw);
    const sim = getSim(b.simId);
    if (!sim) return Response.json({ error: "Unknown bench" }, { status: 400 });
    const { params } = sanitizeParams(sim.params, b.params);
    const recent = (await db.listMemLog(user.id, 200)).filter((m) => m.sim_id === sim.id && m.status !== "failed");

    if (!b.result.passed) {
      const sentence = b.result.failureReason ? `${b.result.summary} Cause: ${b.result.failureReason}` : b.result.summary;
      const dup = recent
        .filter((m) => m.kind === "FAILURE")
        .slice(0, 8)
        .some((m) => m.text.includes(sentence.slice(0, 80)));
      if (dup) return Response.json({ stored: false, reason: "same failure already remembered" });
      const r = await remember(user, { kind: "FAILURE", simId: sim.id, sentence, params, source: "sim" });
      return Response.json({ stored: r.ok, reason: r.ok ? "new failure" : r.error, text: r.text });
    }

    const prevBest = recent
      .filter((m) => m.kind === "WIN")
      .map((m) => parseFloat(m.text.match(/\sscore=(-?[0-9.]+)/)?.[1] ?? "NaN"))
      .filter(Number.isFinite)
      .reduce((a, b) => Math.max(a, b), -Infinity);
    const score = b.result.score;
    if (score != null && score <= prevBest)
      return Response.json({ stored: false, reason: `passed, but not better than your best (${prevBest})` });
    const sentence = prevBest > -Infinity ? `New personal best: ${b.result.summary}` : b.result.summary;
    const r = await remember(user, { kind: "WIN", simId: sim.id, sentence, score, params, source: "sim" });
    return Response.json({ stored: r.ok, reason: r.ok ? "new best" : r.error, text: r.text });
  } catch (e) {
    return errorResponse(e);
  }
}
