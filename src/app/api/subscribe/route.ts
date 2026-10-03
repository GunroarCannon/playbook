import { z } from "zod";
import { currentUser, errorResponse } from "@/lib/auth";
import { db } from "@/lib/db";

const Body = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  source: z.enum(["landing", "settings"]).default("landing"),
});

/** Join the email list. Works signed in or out. */
export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return Response.json({ error: "That doesn't look like an email address." }, { status: 400 });
    const user = await currentUser();
    const added = await db.addSubscriber(parsed.data.email, parsed.data.source, user?.id ?? null);
    return Response.json({ ok: true, added });
  } catch (e) {
    return errorResponse(e);
  }
}
