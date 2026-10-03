# Posts

Fill the `[FILL: …]` bits with real numbers before posting. Attach a screen recording or GIF wherever it says so: a 10–20 second clip of *press red button → bridge snaps → new sheet → "welcome back, last time the flat beam snapped…"* does more than any text.

---

## 1. X / Twitter launch post (required: tag @WalrusProtocol, #WalrusMemory)

**Single post (≤280 characters):**

> Most chatbots forget you when the tab closes.
>
> Playbook remembers: your limits, your best design, what broke. Then it sets the dials for your next test before you ask.
>
> Built on @WalrusProtocol memory with an open model (Qwen on Groq) 👇
> playbook-nu-six.vercel.app #WalrusMemory

*(attach: the 15-second clip)*

**Thread version (post 1 = the post above, then reply with these):**

> 2/ How it works: you describe a real problem ("popsicle-stick bridge, 50 sticks, wood glue"). It picks a simulation, sets the dials, you press a big red button and watch it hold or snap.

> 3/ Every constraint, best result and failure is saved to Walrus Memory as one short sentence. New sheet next day, on another phone? It recalls them, restores your best settings, and won't suggest the design that already failed.

> 4/ There's a memory kill switch. Same bot, same model, memory off: it asks you the same questions every time. That's the before/after in one click.

> 5/ No bench for your idea? Describe it and the AI writes a new simulation in ~30 s, drawn with ~900 sketch sprites (people, elephants, lifts, coffee…). It's smoke-tested and physics-checked before you see it.

> 6/ [FILL: N] real people have used it so far, with [FILL: N] memories saved. Honest write-up, including what went wrong: [FILL: article link]
> Code: github.com/GunroarCannon/playbook
> Built for Walrus Session 8 #WalrusMemory

**Bug-report post (once issues are filed):**

> Filed [FILL: N] issues on Walrus Memory from building Playbook. Top one: there's no way to list or delete memories, so a bot can't show you what it remembers or fix a wrong one. Details + repros 👇 [FILL: issue link] @WalrusProtocol #WalrusMemory

---

## 2. Promo post outside the Walrus/Sui community (required)

Pick one or two. Each is written for its audience, not crypto people. Lead with the problem, not the tech.

### Reddit r/SideProject (or r/InternetIsBeautiful)

**Title:** I built a chatbot that runs physics/maths simulations with you and remembers what broke last time

> Most chatbots forget you between sessions. I wanted one that remembers your limits and failures, because that's what makes "what if" experiments useful.
>
> **Playbook** works like this: you describe a real problem in plain words (a popsicle-stick bridge for a school contest, how many cashiers a shop needs at lunch, whether a solar battery lasts the night, saving for school fees against inflation). It sets up a hand-drawn simulation, you turn the dials and press a big red button, and it explains why it passed or failed.
>
> Next time you open it, even on another device, it already knows your budget and your best design, and it won't suggest the one that snapped. There's a switch to turn memory off so you can see the difference.
>
> If none of the 8 built-in simulations fit, describe your idea and an AI writes a new one.
>
> Free, no email needed, works on a phone: https://playbook-nu-six.vercel.app
> Open source: https://github.com/GunroarCannon/playbook
>
> I'd love feedback, especially: did the memory help, or did it remember something wrong?

### Hacker News (Show HN)

**Title:** Show HN: Playbook – a simulation workbench chatbot that remembers your constraints and failures

> Playbook is a chat + simulation workbench. You describe a problem, the model (Qwen 3.8 27B on Groq) picks one of 8 hand-written canvas sims (truss solver, multi-lane queue, solar energy balance, SIR outbreak, water rocket…), sets the dials via tool calls, and you run the test.
>
> Memory: constraints, best runs (with exact dial settings) and failures are stored as tagged one-line memories in Walrus Memory, a decentralized memory service. A new session recalls them, restores your best configuration, and the prompt forbids re-suggesting known failures. A kill switch disables memory for an A/B comparison.
>
> If no sim fits, the model writes a new one (JSON spec + canvas script). It's compiled, smoke-run headless in a locked-down node:vm, physics-checked by a second model call, then run in a sandboxed iframe with a CSP. The AI draws with a ~900-icon sprite pack, and an icon map search keeps the prompt to ~20 relevant names.
>
> Live: https://playbook-nu-six.vercel.app (any username + passcode). Code: https://github.com/GunroarCannon/playbook. Friction log of what went wrong with the memory SDK and the open model is in docs/.

### Nairaland (Science/Technology) or a local WhatsApp/Telegram tech group

> **I built an app that helps you test ideas before you spend money, and it remembers you**
>
> Before you buy that inverter battery, hire one more cashier, or build the bridge for the school competition: test it first. Playbook is a free chat app with simulations. Tell it your situation in plain English (e.g. "24 V 200 Ah battery, 1.2 kW panels, inverter keeps cutting out before morning"), press the red button, and see what happens and why.
>
> It remembers your numbers, so tomorrow you continue from where you stopped. No email needed, works on your phone: https://playbook-nu-six.vercel.app
>
> Built by @therealgunroar. Feedback welcome!

---

## 3. Short replies for when people ask

- **"Is my data private?"** Memories are short sentences about your project, stored on Walrus under your username's namespace. Don't type anything private. You can also use your own Walrus Memory account in settings.
- **"Which AI is it?"** Qwen 3.8 27B, an open-weights model, running on Groq. Not OpenAI or Anthropic.
- **"Why is it slow sometimes?"** [FILL: if still on Groq's free tier: "The whole app shares one free model quota. If it says busy, wait a minute." Delete this line once you're on the Dev tier.]
