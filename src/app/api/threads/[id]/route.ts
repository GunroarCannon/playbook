import { errorResponse, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveSim } from "@/lib/sims-server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const thread = await db.getThread(user.id, id);
    if (!thread) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ thread });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = (await req.json()) as { title?: string; simId?: string; memoryOn?: boolean };
    await db.updateThread(user.id, id, {
      ...(body.title ? { title: body.title.slice(0, 80) } : {}),
      ...(body.simId && (await resolveSim(user, body.simId)) ? { sim_id: body.simId } : {}),
      ...(typeof body.memoryOn === "boolean" ? { memory_on: body.memoryOn } : {}),
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await db.deleteThread(user.id, id);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
