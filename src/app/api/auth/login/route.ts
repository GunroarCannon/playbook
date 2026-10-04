import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { z } from "zod";
import { createSession, encryptSecret, errorResponse } from "@/lib/auth";
import { db } from "@/lib/db";

const Body = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{2,24}$/, "Username: 2-24 letters, numbers, - or _"),
  passcode: z.string().min(4, "Passcode must be at least 4 characters").max(100),
  memwalAccountId: z.string().trim().optional(),
  memwalKey: z.string().trim().optional(),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email("That email doesn't look right").max(254))]).optional(),
});

/** Sign in, or create the account if the username is new. */
export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { username, passcode, memwalAccountId, memwalKey, email } = parsed.data;

    let user = await db.getUserByName(username);
    let created = false;
    if (user) {
      if (!(await bcrypt.compare(passcode, user.pass_hash)))
        return Response.json({ error: "Wrong passcode for that username" }, { status: 401 });
    } else {
      const byo = memwalAccountId && memwalKey;
      user = await db.createUser({
        id: nanoid(),
        username,
        pass_hash: await bcrypt.hash(passcode, 10),
        memwal_account_id: byo ? memwalAccountId : null,
        memwal_key_enc: byo ? encryptSecret(memwalKey) : null,
      });
      created = true;
    }
    // Optional: lands on the email list, linked to this account. Never needed to sign in.
    if (email) await db.addSubscriber(email, created ? "signup" : "signin", user.id).catch(() => false);
    await createSession(user.id);
    return Response.json({ ok: true, created, username: user.username });
  } catch (e) {
    return errorResponse(e);
  }
}
