# Walrus Memory friction log

Notes from wiring Walrus Memory (`@mysten-incubation/memwal` 0.1.8) into a Next.js 16 chatbot whose model is **Qwen 3.8 27B on Groq** (Vercel AI SDK 7). Each item says whether it has been reproduced against the real relayer yet, and whether it has been filed as an issue.

Environment: Windows 11, Node 24.19, pnpm 11.22, Next.js 16.3.8 (Turbopack), `ai` 7.0.126, `@ai-sdk/groq` 4.0.54.

---

## Walrus Memory SDK / service

### 1. No way to list or delete a namespace's memories
- **What:** The client has `remember`, `recall`, `restore`, `listNamespaces` (counts only), and `analyze`. There is no `list(namespace)` or `forget(blobId)`. `MemWalMock` *does* have `forget()` and `clear()`, so the mock and the real client have different surfaces.
- **Impact:** A chatbot can't show users "here is everything I remember about you" or let them delete one wrong memory. Both matter for trust (and privacy laws). We had to keep a local audit log (`memlog` table) of everything we sent, just to render a memory ledger.
- **Expected:** `memwal.list({ namespace, cursor })` and `memwal.forget(blobId)` (or soft-delete), matching the mock.
- **Status:** confirmed from the 0.1.8 type definitions (`dist/memwal.d.ts`). Not filed yet.

### 2. No metadata on memories, so structure has to live inside the embedded text
- **What:** `remember(text, namespace)` takes only a string. To tell constraints from failures, and to restore dial settings, we append a tag and JSON to the text: `[WIN · truss] … score=6.2 params={…}`.
- **Impact:** The tag and JSON get embedded together with the sentence, which probably adds noise to semantic search. We can't filter recall by kind (e.g. "only FAILURE memories for bench X") and have to over-fetch and then filter client-side.
- **Expected:** An optional `metadata` object stored alongside the text (not embedded), returned by `recall`, and ideally filterable (`recall({ query, filter: { kind: "FAILURE" } })`).
- **Status:** design friction, confirmed from types. Not filed yet.

### 3. `remember` returns before the memory is searchable; serverless needs extra work
- **What:** `remember()` returns `{ job_id }` and the relayer embeds/encrypts/uploads in the background. In a serverless route the function may be frozen as soon as the response is sent, so we use `after()` from `next/server` to keep polling `waitForRememberJob`, and the memory ledger re-checks `getRememberStatus` for pending jobs.
- **Impact:** A memory saved in turn N might not be recallable in turn N+1 a few seconds later. This needs testing against the live relayer to measure the gap.
- **Status:** to be measured against the live relayer.

### 4. `@mysten/sui` and `@mysten/seal` are required peer dependencies, but the default client doesn't use them
- **What:** `package.json` lists `@mysten/sui` and `@mysten/seal` as non-optional peers, while `dist/index.d.ts` says the default entry "Does NOT import account.js (which requires @mysten/sui)". Our app runs without installing either.
- **Expected:** Mark them optional in `peerDependenciesMeta` (like `@mysten/walrus`), or document that only `/account` and `/manual` need them.
- **Status:** confirmed. Not filed yet.

### 5. Docs: the TypeScript SDK reference link returns 404
- **What:** `https://docs.wal.app/walrus-memory/sdk/typescript` → 404 (checked 2026-10-02). We read the SDK's `.d.ts` files instead (they are well commented).
- **Status:** confirmed. Not filed yet.

---

## Open model + tool calling (not MemWal bugs, but integration friction)

### 6. Llama 3.3 70B is no longer on Groq
The hackathon examples suggest Llama 3.3. On 2026-10-02 Groq's model list had `qwen/qwen3.8-27b` and `openai/gpt-oss-*`, but no Llama 3.3. gpt-oss is from OpenAI, so it wouldn't count for "Beyond the Big Two". We went with Qwen.

### 7. Qwen repeats the same tool call in one turn
Qwen 3.8 sometimes called `set_dials` twice with identical arguments, both with `runTest: true`. That ran the bench twice, and because a bench result is posted back into the chat, it nearly caused a feedback loop (test → report → model sets dials and runs again → …). Fix: the server allows one test per turn and never auto-runs when replying to a `[test]` report. The prompt also says "at most ONCE per reply".

### 8. Over-eager `remember`
On the first message ("max 50 sticks, wood glue only, must span 40cm, test 5kg") Qwen made 4 separate `remember` calls (3 constraints + 1 goal). That's correct by our instructions (one fact per memory), but it means 4 relayer jobs per message, which affects cost and rate limits on a busy bot. `rememberBulk` exists, but a model calls tools one at a time. A per-turn batching layer is an idea for later.

### 9. Model leaks memories from other benches into the welcome message
A `[PROFILE]` memory about running a supermarket was recalled on the pendulum bench, and the welcome-back said "let's handle your lunch rush" on a physics bench. Fixed by telling the model to ignore memories about other projects. Tags help here, because we can filter by bench before prompting.
