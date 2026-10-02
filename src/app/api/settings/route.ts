import { MemWal } from "@mysten-incubation/memwal";
import { z } from "zod";
import { encryptSecret, errorResponse, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const Body = z.object({
  memwalAccountId: z.string().trim().nullable(),
  memwalKey: z.string().trim().nullable(),
});

/** Bring your own Walrus Memory account (or switch back to the shared one with nulls). */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { memwalAccountId, memwalKey } = Body.parse(await req.json());
    if (!memwalAccountId || !memwalKey) {
      await db.updateUserMemwal(user.id, null, null);
      return Response.json({ ok: true, mode: "shared" });
    }
    // Validate before saving: a signed call that needs the key + account to line up.
    const client = MemWal.create({
      key: memwalKey,
      accountId: memwalAccountId,
      serverUrl: process.env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz",
    });
    try {
      await client.listNamespaces({ limit: 1 });
    } catch (e) {
      return Response.json(
        { error: `Walrus Memory rejected those credentials: ${e instanceof Error ? e.message : e}` },
        { status: 400 },
      );
    } finally {
      client.destroy();
    }
    await db.updateUserMemwal(user.id, memwalAccountId, encryptSecret(memwalKey));
    return Response.json({ ok: true, mode: "own" });
  } catch (e) {
    return errorResponse(e);
  }
}
