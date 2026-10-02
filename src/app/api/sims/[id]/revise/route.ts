import { errorResponse, requireUser } from "@/lib/auth";
import { reviseCustomSim } from "@/lib/sims-server";

export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

/** { error } = the browser saw it crash, fix it. { change } = the person wants it different. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = (await req.json()) as { error?: string; change?: string };
    if (!body.error && !body.change) return Response.json({ error: "Nothing to change" }, { status: 400 });
    return Response.json(await reviseCustomSim(user, id, { error: body.error?.slice(0, 600), change: body.change?.slice(0, 800) }));
  } catch (e) {
    console.error("[sims] revise failed", e);
    return errorResponse(e);
  }
}
