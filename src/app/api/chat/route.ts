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
import { SIMS, getSim, sanitizeParams, type ParamValue } from "@/lib/sims";

export const maxDuration = 60;

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
    let simId = getSim(body.simId ?? "")?.id ?? thread.sim_id;
    const dials = body.dials ?? {};
    const lastUserText = textOf([...body.messages].reverse().find((m) => m.role === "user"));
    const sim = getSim(simId)!;

    const stream = createUIMessageStream({
      originalMessages: body.messages,
      execute: async ({ writer }) => {
        // One assistant message per turn: open it ourselves so the recall part lands inside it.
        writer.write({ type: "start" });
        // A reply to an automatic bench report must not trigger another test (feedback loop),
        // and open models sometimes repeat set_dials in one turn, so allow one test per turn at most.
        let testBudget = lastUserText.startsWith("[test]") ? 0 : 1;

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
              const cur = getSim(simId)!;
              const { params: clean, rejected } = sanitizeParams(cur.params, params);
              const willTest = Boolean(runTest) && testBudget > 0;
              if (willTest) testBudget--;
              return { simId, params: clean, rejected, reason: reason ?? "", runTest: willTest };
            },
          }),
          switch_bench: tool({
            description: `Move to another bench. Options: ${SIMS.map((s) => s.id).join(", ")}.`,
            inputSchema: z.object({ simId: z.enum(SIMS.map((s) => s.id) as [string, ...string[]]) }),
            execute: async ({ simId: next }) => {
              simId = next;
              await db.updateThread(user.id, thread.id, { sim_id: next });
              return { simId: next, name: getSim(next)!.name };
            },
          }),
          ...(memoryOn
            ? {
                remember: tool({
                  description:
                    "Save ONE durable fact about this person to their Walrus Memory: a constraint, goal, preference, profile fact, or general insight. Not test results.",
                  inputSchema: z.object({
                    kind: z.enum(["CONSTRAINT", "GOAL", "PREF", "PROFILE", "INSIGHT"]),
                    sentence: z.string().min(8).max(400).describe("one clear third-person sentence with numbers and units"),
                    benchSpecific: z.boolean().describe("true if this only applies to the current bench").optional(),
                  }),
                  execute: async ({ kind, sentence, benchSpecific }) => {
                    const r = await remember(user, {
                      kind: (MEMORY_KINDS as readonly string[]).includes(kind) ? kind : "INSIGHT",
                      simId: benchSpecific === false || kind === "PROFILE" || kind === "PREF" ? null : simId,
                      sentence,
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
            simId,
            dials,
            memoryOn,
            recalled: recallError ? `(memory recall failed: ${recallError})` : memoriesForPrompt(recalled),
          }),
          messages: await convertToModelMessages(body.messages),
          tools,
          stopWhen: isStepCount(5),
          temperature: 0.4,
        });

        writer.merge(toUIMessageStream({ stream: result.stream, sendStart: false }));
      },
      onEnd: async ({ messages }) => {
        const title = thread.title === "New sheet" && lastUserText && !lastUserText.startsWith("[test]") ? lastUserText.slice(0, 60) : thread.title;
        await db.updateThread(user.id, thread.id, { messages, title, sim_id: simId, memory_on: memoryOn });
      },
      onError: (e) => {
        console.error("[chat] stream error", e);
        return e instanceof Error ? e.message : "Something went wrong";
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (e) {
    return errorResponse(e);
  }
}
