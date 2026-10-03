# Article draft (Medium or Inkray, 500–800 words)

> **Before publishing:** replace every `[FILL: …]` with real numbers and quotes from your testers (see `docs/RECRUIT_KIT.md` section 7). Delete any sentence you can't back up. Add 3 screenshots where marked. The body is ~850 words counting placeholders and links; after filling, trim to 800 (the "Other friction" paragraph and "What I'd do next" are the easiest cuts).

---

# I gave a simulation chatbot a memory. Here's what changed.

*Playbook is a what-if workbench that remembers you, built on Walrus Memory with an open model. Built for Walrus Session 8, "Chatbots That Remember".*

## The problem: every session starts from zero

Picture a student building a popsicle-stick bridge for a school contest: 50 sticks, wood glue only, 40 cm span. [FILL: or swap in a real tester's situation.] A chatbot can help with that. It can explain trusses, suggest a design, even do the maths. But come back the next evening and it has forgotten everything. What's the budget? Which glue? Which design already snapped?

That's the gap I wanted to close. The useful part of engineering help isn't the textbook answer. It's remembering *your* limits, *your* best result, and *your* failures.

## What I built

**Playbook** is a chatbot with a workbench. You describe a real problem in plain words. It picks a simulation (a bridge truss, a supermarket checkout line, a home solar battery, savings against inflation, stopping distance, a bottle rocket, an outbreak, a projectile) and sets the dials. Then you press a big red button and watch the test: the bridge holds or snaps, the queue melts down, the battery cuts out at 2:40 a.m.

If none of the eight benches fit, the AI writes a new simulation for you, and draws it with a box of sprites (people, elephants, lifts, cows, coffee) so it looks like your actual problem.

[SCREENSHOT 1: chat on the left, bridge bench on the right, mid-test]

## Where Walrus Memory comes in

Playbook saves four kinds of memory to Walrus Memory, each as one short sentence:

- **Constraints:** "Amara's bridge must use at most 50 sticks, wood glue only."
- **Wins:** "Warren truss, 40 cm span, holds about 8.4 kg using 23 sticks," with the exact dial settings attached.
- **Failures:** "Flat beam snapped at 2.1 kg: bending at mid-span."
- **Insights and profile:** "Rainy season gives about 3.5 sun hours in Lagos."

When you open a new sheet, Playbook runs a few focused recalls, sets the dials to your best known configuration, and won't suggest a design that already failed for you. Because memories live on Walrus under your username's namespace, they follow you to another phone or laptop. You can also plug in your own Walrus Memory account.

There's a kill switch in the top bar. Flip it off and you get the same bot, same model, with no memory. That made the before/after easy to show.

## Before and after

**Memory OFF, second visit:**
> "Hi! What are you building? What materials can you use, and is there a budget?"

**Memory ON, second visit:**
> [FILL: paste a real welcome-back from a tester's second session, e.g. "Welcome back, Amara. Your limit is 50 sticks with wood glue, and the flat beam snapped at 2.1 kg, so I've set the dials to your Warren truss…"]

[SCREENSHOT 2: the same person's memory-OFF and memory-ON greetings side by side]

The difference isn't politeness. With memory on, the first message of a returning session is already the *next experiment*, not a questionnaire.

## What happened with real users

[FILL: N] people used Playbook over [FILL: N] days and saved [FILL: N] memories between them. [FILL: N] of them have more than 10.

- [FILL: tester 1, first name, bench, one concrete moment, e.g. "Tunde came back on his laptop the next day and the solar bench opened with his 24 V battery and 1.2 kW panels already set."]
- [FILL: tester 2]
- [FILL: tester 3]

> "[FILL: one honest quote about memory ON vs OFF]" — [first name]

[SCREENSHOT 3: a tester's memory ledger with 10+ memories]

## What went wrong (honestly)

Memory is only as good as its wording. While testing the solar bench I typed "never go below 80% depth of discharge", and the model saved a 20% limit, which came back on every later sheet. Walrus Memory stored it faithfully, but there's no API to list or delete a memory, so fixing it meant working around the SDK. [FILL: any wrong or creepy memory your testers hit.]

Other friction: memories have no metadata field, so I pack tags and settings into the sentence itself. And `remember()` returns before the memory is searchable, so a fact saved in one message isn't always recallable in the next. I logged everything in a friction log and [FILL: filed N issues] on the MemWal repo.

The open model was its own adventure. Qwen 3.8 27B on Groq sometimes called the same tool twice in one turn, and Groq's free tier caps the whole app at 1,000 output tokens per minute, which blocks AI-built benches entirely. [FILL: what you did about it, e.g. "I moved to Groq's Dev tier."]

## What I'd do next

Read-back confirmation ("Saved: max discharge 20%. Right?"), a forget button once the API allows it, and memory shared between people working on the same project.

Try it: **https://playbook-nu-six.vercel.app** · Code: **https://github.com/GunroarCannon/playbook** · Built by **@therealgunroar**

#WalrusMemory
