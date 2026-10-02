import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { chatModel } from "@/lib/llm";
import { errorResponse, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MEMORY_KINDS, memoriesForPrompt, recall, remember, type ParsedMemory } from "@/lib/memory";
import { systemPrompt } from "@/lib/prompts";
import { sanitizeParams, type ParamValue, type SimDef } from "@/lib/sims";
import { createCustomSim, reviseCustomSim, userSims } from "@/lib/sims-server";

export const maxDuration = 120;

/** Turn provider errors into something a person can act on. */
function friendlyError(e: unknown) {
  const msg = e instanceof Error ? `${e.message} ${String((e as { lastError?: unknown }).lastError ?? "")}` : String(e);
  if (/rate limit|rate_limit|too many requests|429/i.test(msg))
    return "Playbook's AI is busy right now (free-tier rate limit). Wait about 20 seconds and send that again.";
  return e instanceof Error ? e.message : "Something went wrong";
}

type Body = {
  id: string;
  messages: UIMessage[];
  simId?: string;
  dials?: Record<string, ParamValue>;
  memoryOn?: boolean;
};

function textOf(m: UIMessage | undefined) {
  return (m?.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as Body;
    const thread = await db.getThread(user.id, body.id);
    if (!thread) return Response.json({ error: "Thread not found" }, { status: 404 });

    const memoryOn = body.memoryOn ?? thread.memory_on;
    let benches = await userSims(user);
    const find = (id: string | null | undefined) => benches.find((s) => s.id === id);
    let sim: SimDef = find(body.simId) ?? find(thread.sim_id) ?? benches[0];
    let simId = sim.id;
    const dials = body.dials ?? {};
    const lastUserText = textOf([...body.messages].reverse().find((m) => m.role === "user"));

    const stream = createUIMessageStream({
      originalMessages: body.messages,
      execute: async ({ writer }) => {
        // One assistant message per turn: open it ourselves so the recall part lands inside it.
        writer.write({ type: "start" });
        // A reply to an automatic bench report must not trigger another test (feedback loop),
        // and open models sometimes repeat set_dials in one turn, so allow one test per turn at most.
        let testBudget = lastUserText.startsWith("[test]") ? 0 : 1;
        let builtThisTurn = false;

        // 1) Recall from Walrus Memory before the model says anything.
        let recalled: ParsedMemory[] = [];
        let recallError: string | null = null;
        if (memoryOn) {
          writer.write({ type: "data-memory", id: "recall", data: { status: "recalling" } });
          const started = Date.now();
          try {
            const [byMessage, rules] = await Promise.all([
              recall(user, `${lastUserText}\n(${sim.name})`, { limit: 6 }),
              recall(user, `Constraints, limits and rules for ${sim.name}`, { limit: 4 }),
            ]);
            const seen = new Set<string>();
            recalled = [...rules, ...byMessage].filter((m) => {
              const k = m.blobId || m.text;
              if (seen.has(k)) return false;
              seen.add(k);
              // keep memories for this bench, general ones, and anything clearly relevant
              return !m.simId || m.simId === simId || m.relevance > 0.55;
            });
          } catch (e) {
            recallError = e instanceof Error ? e.message : String(e);
            console.error("[chat] recall failed", recallError);
          }
          writer.write({
            type: "data-memory",
            id: "recall",
            data: {
              status: recallError ? "error" : "done",
              error: recallError,
              ms: Date.now() - started,
              items: recalled.map((m) => ({ kind: m.kind, simId: m.simId, sentence: m.sentence, relevance: m.relevance })),
            },
          });
        }

        const tools = {
          set_dials: tool({
            description: "Set one or more dials on the current bench. Use exact dial keys. Optionally run the test straight away.",
            inputSchema: z.object({
              params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).describe("dial key -> value"),
              reason: z.string().describe("one short sentence: why these values").optional(),
              runTest: z.boolean().optional(),
            }),
            execute: async ({ params, reason, runTest }) => {
              const { params: clean, rejected } = sanitizeParams(sim.params, params);
              const willTest = Boolean(runTest) && testBudget > 0;
              if (willTest) testBudget--;
              return { simId, params: clean, rejected, reason: reason ?? "", runTest: willTest };
            },
          }),
          switch_bench: tool({
            description: `Move to another bench, ONLY if that bench actually models the person's problem. Options: ${benches.map((s) => s.id).join(", ")}.`,
            inputSchema: z.object({ simId: z.string() }),
            execute: async ({ simId: next }) => {
              if (builtThisTurn) return { simId, name: sim.name, error: "Stay on the bench you just built." };
              const target = find(next);
              if (!target) return { simId, name: sim.name, error: `No bench called "${next}". Options: ${benches.map((s) => s.id).join(", ")}` };
              sim = target;
              simId = sim.id;
              await db.updateThread(user.id, thread.id, { sim_id: simId });
              return { simId, name: sim.name };
            },
          }),
          build_bench: tool({
            description: "Have the AI build a brand-new simulation bench when no existing bench fits. Takes 20-40 seconds.",
            inputSchema: z.object({
              request: z.string().min(20).max(1200).describe("what to simulate: the system, the dials it needs, what counts as pass or fail, and any of the person's numbers"),
            }),
            execute: async ({ request }) => {
              try {
                const context = recalled.length ? memoriesForPrompt(recalled.slice(0, 8)) : undefined;
                const made = await createCustomSim(user, request, { context, memoryOn });
                builtThisTurn = true;
                benches = [...benches, made.sim];
                sim = made.sim;
                simId = sim.id;
                await db.updateThread(user.id, thread.id, { sim_id: simId });
                return { built: true, simId, name: sim.name, tagline: sim.tagline, dials: sim.params.map((p) => p.key), seconds: Math.round(made.ms / 1000) };
              } catch (e) {
                return { built: false, error: e instanceof Error ? e.message : String(e) };
              }
            },
          }),
          ...(sim.custom
            ? {
                revise_bench: tool({
                  description: "Change the current AI-built bench (add a dial, change the pass rule, fix wrong behaviour).",
                  inputSchema: z.object({ change: z.string().min(8).max(800) }),
                  execute: async ({ change }) => {
                    try {
                      const r = await reviseCustomSim(user, simId, { change });
                      sim = r.sim;
                      benches = benches.map((s) => (s.id === simId ? r.sim : s));
                      return { revised: true, simId, name: sim.name, version: r.version, dials: sim.params.map((p) => p.key) };
                    } catch (e) {
                      return { revised: false, error: e instanceof Error ? e.message : String(e) };
                    }
                  },
                }),
              }
            : {}),
          ...(memoryOn
            ? {
                remember: tool({
                  description:
                    "Save ONE durable fact about this person to their Walrus Memory: a constraint, goal, preference, profile fact, or general insight. Not test results.",
                  inputSchema: z.object({
                    kind: z.enum(["CONSTRAINT", "GOAL", "PREF", "PROFILE", "INSIGHT"]),
                    sentence: z.string().min(8).max(400).describe("one clear third-person sentence with numbers and units"),
                    benchSpecific: z.boolean().describe("true if this only applies to the current bench").optional(),
                    dials: z
                      .record(z.string(), z.union([z.number(), z.string(), z.boolean()]))
                      .describe("for a CONSTRAINT: the dial values it fixes, e.g. {\"stickBudget\":40,\"glue\":\"hot\"}")
                      .optional(),
                  }),
                  execute: async ({ kind, sentence, benchSpecific, dials: ruleDials }) => {
                    // A fact that sets dials belongs to this bench even if the model filed it as PROFILE/PREF.
                    const benchScoped = Boolean(ruleDials && Object.keys(ruleDials).length) || !(benchSpecific === false || kind === "PROFILE" || kind === "PREF");
                    const params =
                      benchScoped && ruleDials ? sanitizeParams(sim.params, ruleDials).params : undefined;
                    const r = await remember(user, {
                      kind: (MEMORY_KINDS as readonly string[]).includes(kind) ? kind : "INSIGHT",
                      simId: benchScoped ? simId : null,
                      sentence,
                      params: params && Object.keys(params).length ? params : undefined,
                      source: "agent",
                    });
                    return r.ok ? { saved: true, text: r.text } : { saved: false, error: r.error };
                  },
                }),
                recall: tool({
                  description: "Search this person's Walrus Memory for something specific.",
                  inputSchema: z.object({ query: z.string() }),
                  execute: async ({ query }) => {
                    const hits = await recall(user, query, { limit: 6 });
                    return { results: hits.map((h) => `[${h.kind}${h.simId ? " · " + h.simId : ""}] ${h.sentence}`) };
                  },
                }),
              }
            : {}),
        };

        const result = streamText({
          model: chatModel(),
          system: systemPrompt({
            username: user.username,
            sim,
            others: benches,
            dials,
            memoryOn,
            recalled: recallError ? `(memory recall failed: ${recallError})` : memoriesForPrompt(recalled),
          }),
          messages: await convertToModelMessages(body.messages),
          tools,
          stopWhen: isStepCount(5),
          temperature: 0.4,
          maxRetries: 5, // Groq free tier: 8k tokens/min shared by everyone, so ride out short bursts
        });

        writer.merge(toUIMessageStream({ stream: result.stream, sendStart: false }));
      },
      onEnd: async ({ messages }) => {
        const title = thread.title === "New sheet" && lastUserText && !lastUserText.startsWith("[test]") ? lastUserText.slice(0, 60) : thread.title;
        await db.updateThread(user.id, thread.id, { messages, title, sim_id: simId, memory_on: memoryOn });
      },
      onError: (e) => {
        console.error("[chat] stream error", e);
        return friendlyError(e);
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (e) {
    return errorResponse(e);
  }
}
