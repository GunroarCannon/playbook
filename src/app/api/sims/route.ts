import { errorResponse, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCustomSim, customToDef } from "@/lib/sims-server";

export const maxDuration = 120;

/** This person's AI-built benches (without code). */
export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ sims: (await db.listCustomSims(user.id)).map(customToDef) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Build a new bench from a plain-language request. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { request, memoryOn } = (await req.json()) as { request?: string; memoryOn?: boolean };
    if (!request || request.trim().length < 8) return Response.json({ error: "Describe what you want to simulate (a sentence or two)." }, { status: 400 });
    return Response.json(await createCustomSim(user, request.trim(), { memoryOn }));
  } catch (e) {
    console.error("[sims] create failed", e);
    return errorResponse(e);
  }
}
