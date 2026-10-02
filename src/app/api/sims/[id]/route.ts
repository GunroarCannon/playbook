import { errorResponse, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { customToDef } from "@/lib/sims-server";

type Ctx = { params: Promise<{ id: string }> };

/** One AI-built bench including its code (only the owner can read it). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const row = await db.getCustomSim(user.id, id);
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ sim: customToDef(row), code: row.code, version: row.version });
  } catch (e) {
    return errorResponse(e);
  }
}
