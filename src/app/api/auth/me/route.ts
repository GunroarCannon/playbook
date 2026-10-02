import { currentUser } from "@/lib/auth";
import { memoryFor } from "@/lib/memory";
import { MODEL_LABEL } from "@/lib/llm";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ user: null });
  const { mode, namespace } = await memoryFor(user);
  return Response.json({
    user: { id: user.id, username: user.username },
    memory: { mode, namespace },
    model: MODEL_LABEL,
  });
}
