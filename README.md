# Playbook: a what-if workbench that remembers you

Playbook is a chatbot that runs simulations with you. You describe a real problem (a popsicle-stick bridge for a school contest, a checkout line that melts down at lunch, a solar setup that dies at 2 a.m.), and Playbook sets the dials on a hand-drawn workbench, runs the test, and explains what happened.

It uses **[Walrus Memory](https://github.com/MystenLabs/MemWal)** to remember each person across sessions and devices:

- **Constraints:** "Amara's bridge must use at most 50 sticks, wood glue only"
- **Best runs:** "Warren truss, 40cm span held 6.2kg using 23 sticks", with the exact dial settings
- **Failures:** "Flat beam snapped at 2.1kg. Cause: bending at mid-span"

When you open a new sheet, Playbook recalls these, **sets the dials to your best known configuration**, and won't suggest a design that already failed for you. A **memory kill switch** in the top bar turns all of this off, so you can compare the bot with and without memory.

Built for *Walrus Session 8: Chatbots That Remember*. LLM: **Qwen 3.8 27B on Groq** (open weights), and it can be switched to any OpenRouter or OpenAI-compatible model (including Ollama).

![Playbook screenshot](docs/screenshot.png)

---

## How the memory works

| When | What happens | Code |
|---|---|---|
| New sheet (memory ON) | 5 focused `recall()` queries (constraints, best runs, failures, profile, recent) → dedupe → the best-scoring `[WIN]` memory's `params=` restores the dials → the model writes a welcome-back | `src/lib/memory.ts` `bootstrapMemories`, `src/app/api/bootstrap/route.ts` |
| Every chat turn | 2 `recall()` queries (your message + bench constraints) are injected into the system prompt as *data, not instructions*. The UI shows "recalled N memories" | `src/app/api/chat/route.ts` |
| You state a fact | The model calls the `remember` tool: one third-person sentence, tagged `[CONSTRAINT]`, `[GOAL]`, `[PREF]`, `[PROFILE]` or `[INSIGHT]` | `src/app/api/chat/route.ts` |
| A bench test finishes | Failures are saved as `[FAILURE]` (unless they repeat a recent one). Passes are saved as `[WIN]` only if they beat your best. Both include the dial settings | `src/app/api/memories/route.ts` |
| Memory OFF | No recall, no remember tools, default dials, generic greeting | everywhere `memoryOn` is checked |

Every memory is a single line of text, because that is what Walrus Memory embeds and searches:

```
[WIN · truss] Warren truss, 40cm span held 6.2kg using 23 sticks. score=6.2 params={"design":"warren","spanCm":40,...}
```

The tag and the `score=`/`params=` suffix let the app restore dials from recalled memory alone. There's no local cache of "best settings". Walrus Memory is the source of truth.

**Users and namespaces:** a username and passcode gives you the namespace `pb-<username>` on the app's shared Walrus Memory account. You can also **bring your own Walrus Memory account** (account ID + delegate key from [memory.walrus.xyz](https://memory.walrus.xyz)) at sign-up or in settings. Your memories then go to *your* account. Keys are stored AES-256-GCM encrypted.

## The workbenches

| Bench | Model |
|---|---|
| Bridge Truss | Pin-jointed truss solved by the method of joints, Euler buckling for compression members, glue-joint limits, popsicle-stick counting |
| Checkout Rush | Multi-lane checkout simulated second by second (Poisson arrivals, walkouts, express lane) with seeded randomness, so every configuration faces the same customers |
| Off-Grid Solar | 10-minute energy balance over 1–3 days: battery, depth of discharge, panels, clouds, night load, load-shedding |
| Launch & Swing | Projectile with quadratic drag on Earth/Moon/Mars, and a non-linear pendulum (numerically integrated) |

Each sim is a standalone HTML file in `public/sims/`, running in a sandboxed iframe (`sandbox="allow-scripts"`). It talks to the app over `postMessage` (`src/lib/protocol.ts`), so a generated sim can follow the same contract.

## Run it locally

Requirements: Node 20.9+ and pnpm.

```bash
git clone <this repo> playbook && cd playbook
pnpm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com/keys) (free tier works) |
| `MEMWAL_ACCOUNT_ID`, `MEMWAL_PRIVATE_KEY` | [memory.walrus.xyz](https://memory.walrus.xyz): create an account and a delegate key |
| `MEMWAL_SERVER_URL` | `https://relayer.memory.walrus.xyz` (mainnet) or `https://relayer-staging.memory.walrus.xyz` (testnet) |
| `AUTH_SECRET` | any long random string: `openssl rand -hex 32` |
| `DATABASE_URL` | optional locally. Leave it empty to use a JSON file in `.data/`. Use Neon Postgres in production |

```bash
pnpm dev   # http://localhost:3000
```

Without MemWal keys, the app falls back to the SDK's in-memory `MemWalMock`, labelled "local mock" in the sidebar, so you can try the UI first.

### Switching the model

```bash
LLM_PROVIDER=groq               LLM_MODEL=qwen/qwen3.8-27b
LLM_PROVIDER=openrouter         LLM_MODEL=qwen/qwen-2.5-72b-instruct   OPENROUTER_API_KEY=...
LLM_PROVIDER=openai-compatible  LLM_MODEL=qwen2.5:14b  OPENAI_COMPATIBLE_BASE_URL=http://localhost:11434/v1   # Ollama
```

## Deploy (Vercel + Neon)

1. Push to GitHub and import the repo in Vercel.
2. Add a Neon Postgres database from the Vercel Marketplace (it sets `DATABASE_URL`). Tables are created automatically on first request.
3. Add `GROQ_API_KEY`, `MEMWAL_ACCOUNT_ID`, `MEMWAL_PRIVATE_KEY`, `MEMWAL_SERVER_URL` and `AUTH_SECRET` in the project's environment variables.
4. Deploy.

## Project layout

```
src/lib/memory.ts        Walrus Memory: client per user, tagged memory format, recall/remember, bootstrap
src/lib/sims.ts          Bench registry (dial specs shared by the UI and the model's tools)
src/lib/prompts.ts       System prompt (memory ON vs OFF)
src/lib/llm.ts           Provider switch (Groq / OpenRouter / OpenAI-compatible)
src/app/api/chat         Streaming chat: recall → model + tools (set_dials, remember, recall, switch_bench)
src/app/api/bootstrap    New sheet: recall, restore dials, welcome-back
src/app/api/memories     Bench results → memory; memory ledger
public/sims/*.html       Hand-built simulations + bench.js drawing kit
docs/FRICTION_LOG.md     Bugs and friction found while integrating Walrus Memory with an open model
```

## License

MIT
