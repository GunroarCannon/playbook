import { nanoid } from "nanoid";
import { errorResponse, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveSim } from "@/lib/sims-server";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ threads: await db.listThreads(user.id) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { simId, memoryOn } = (await req.json().catch(() => ({}))) as { simId?: string; memoryOn?: boolean };
    const sim = (await resolveSim(user, simId)) ?? (await resolveSim(user, "truss"))!;
    const thread = await db.createThread({
      id: nanoid(12),
      user_id: user.id,
      // named after its bench; follows the bench if the chat switches (see autoTitle in lib/sims-server.ts)
      title: sim.name,
      sim_id: sim.id,
      memory_on: memoryOn ?? true,
      messages: [],
    });
    return Response.json({ thread });
  } catch (e) {
    return errorResponse(e);
  }
}
