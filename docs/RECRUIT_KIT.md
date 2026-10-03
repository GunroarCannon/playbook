# Recruit kit: getting real people to use Playbook

The hackathon needs **at least 3 real users with 10+ memories each**, using the bot over **a few days**, and the article needs honest evidence of what changed with memory. This kit is everything needed to get there: who to ask, what to send, what to ask them to do, and how to track it.

Live app: **https://playbook-nu-six.vercel.app**

---

## 0. Before you send anything

- [ ] **Fix the model quota.** On Groq's free tier the whole app shares 1,000 output tokens per minute. Chat works slowly, but **AI-built benches fail outright** (see `docs/FRICTION_LOG.md` item 14). Either move the key to Groq's Dev tier, or tell testers to stick to the 8 ready-made benches.
- [ ] **Stagger testers.** Even with chat only, 3 people typing at once will hit "busy, try again". Book them into slots (section 4) rather than blasting one link to everyone at once.
- [ ] Open the app on your own phone once and run one test, so you know it's up.
- [ ] Decide what you'll quote. Ask each tester if you can quote them by first name in the article (section 6).

## 1. Who to ask (pick people with a real problem, not just friends being nice)

The best testers have a real what-if they care about. Match them to a bench:

| Person | Bench | Their real question |
|---|---|---|
| A student or teacher with a science fair / bridge contest | Bridge Truss, Bottle Rocket, Launch & Swing | "Which design wins with our materials?" |
| Someone who runs or works in a shop | Checkout Rush | "How many cashiers at lunch?" |
| Anyone with solar or an inverter at home | Off-Grid Solar | "Why does my inverter cut out before morning?" |
| Anyone saving for school fees, rent, a car | Savings Goal | "Will I make it, with inflation?" |
| A driver, driving instructor, new driver | Stopping Distance | "Could I stop in time on a wet road?" |
| A nurse, health worker, public-health student | Outbreak | "Would the beds run out?" |
| Anyone with an odd idea (rain tank, generator, baking) | AI-built bench (needs Dev tier) | Their own idea |

Aim for **5 sign-ups** to end up with **3 solid users**. People drop off.

## 2. Messages to send

### Direct message (WhatsApp / Telegram / DM)

> Hey [name]! I built a little app for a hackathon and I'd love you to try it for 15 minutes. It's a chatbot that runs simulations with you: you tell it something like "[their real question]", it sets up a test on a drawing, you press a big red button, and it remembers your numbers for next time.
>
> The point is the memory: if you come back tomorrow (even on another phone), it should already know your limits and what failed. I need real people to see if that actually helps.
>
> Link: https://playbook-nu-six.vercel.app
> Pick any username + a passcode (no email). Can I send you 3 quick steps?

### Group message (class group, work group, community)

> Quick favour 🙏 I built a chatbot for a hackathon that **remembers you between sessions** (uses Walrus Memory). It runs little simulations: bridge contests, shop checkout queues, solar batteries, savings vs inflation, stopping distance, bottle rockets.
>
> I need 3–5 people to use it for ~15 min today and ~5 min again in a day or two. No email needed, works on your phone.
> 👉 https://playbook-nu-six.vercel.app
> Reply here or DM me and I'll send you a time slot so the server doesn't get swamped.

### The 3 steps (send after they say yes)

> 1. Open https://playbook-nu-six.vercel.app → "Open my notebook" → pick a username + passcode. **Write them down**, you'll need them again.
> 2. Pick the bench closest to your problem and **tell it your real situation with numbers** (budget, limits, materials, target). Run at least 4 tests with the red button: some that fail, some that pass.
> 3. In 1–2 days, come back **on a different device if you can**, open a **new sheet** on the same bench, and see what it remembers. Then flip the **memory switch OFF**, open another new sheet, and compare.

## 3. What a session should look like (so each person gets 10+ memories)

Memories come from four places. A normal 15-minute session gives 10–15:

| Action | Memories |
|---|---|
| Saying constraints/goals in chat ("max 50 sticks", "must hold 5 kg", "I'm in Lagos") | 2–5 (`CONSTRAINT`, `GOAL`, `PROFILE`) |
| Each failed test | 1 `FAILURE` (repeats of the same failure are skipped) |
| Each test that beats your best | 1 `WIN` |
| Asking "what did we learn?" | 1–2 `INSIGHT` |
| Building an AI bench | 1 `SIM` |

Check the **Memory ledger** in the side menu: the number at the top is the count on Walrus. Green dot = stored on Walrus.

If a tester is stuck on what to type, give them one of the suggestion chips on the first screen. They're real starter questions for each bench.

## 4. Schedule and tracker

Book testers 20 minutes apart. Copy this table somewhere you'll update it:

| # | Name (first only) | Bench | Username | Day 1 slot | Memories after day 1 | Day 2/3 return? | Other device? | Memory OFF compared? | Quote OK? |
|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | |
| 2 | | | | | | | | | |
| 3 | | | | | | | | | |
| 4 | | | | | | | | | |
| 5 | | | | | | | | | |

Memory counts are visible to you in the database (`memlog` table, status `done`) and to them in the ledger.

## 5. Follow-up message (day 2 or 3)

> Hey [name], thanks again for trying Playbook! Could you do the 5-minute part 2?
> 1. Open the link (on a different phone/laptop if you can), sign in with the same username + passcode.
> 2. Open a **New sheet** on the same bench. Does it greet you with your own numbers? Are the dials already set?
> 3. Flip the **Walrus Memory switch OFF**, open another new sheet, and see how it talks to you now.
> Then tell me in one or two sentences: what changed? Was the memory useful, creepy, wrong, or just fine?

## 6. Feedback questions (keep it to 5)

1. What were you trying to figure out?
2. When you came back, did Playbook remember the right things? Anything wrong or missing?
3. Memory ON vs OFF: which would you rather use, and why?
4. One thing that confused you or got in the way.
5. Can I quote your answer (first name only) in an article about the project? Yes / No / Yes, but anonymously.

## 7. What to collect for the article

- [ ] Count of users with 10+ memories (screenshot of each ledger, or a DB query).
- [ ] One **before/after pair** per bench used: the memory-OFF greeting vs the memory-ON greeting for the same person.
- [ ] At least one moment where memory **saved them a step** (dials restored, a failed design not suggested again).
- [ ] At least one moment where memory **got something wrong** (honest articles score better; see friction log item 10).
- [ ] Any MemWal bug or friction they hit, added to `docs/FRICTION_LOG.md`.

## 8. Ground rules

- Real people only. No made-up accounts, no padding memory counts yourself.
- Tell them what's stored: short sentences about their project, on Walrus, under their username. Don't let them type anything private.
- If someone wants out, you can delete their rows from the app database by hand (`users` cascades to their sheets and ledger). Walrus Memory itself has no delete API yet (friction log item 1), so tell them that honestly.
