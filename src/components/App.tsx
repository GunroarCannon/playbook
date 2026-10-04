"use client";

import type { UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimResult } from "@/lib/protocol";
import { buildSimDoc } from "@/lib/sim-doc";
import { CATEGORIES, SIMS, defaultParams, getSim, registerCustomSims, sanitizeParams, type ParamValue, type SimCategory, type SimDef, type SimPreset } from "@/lib/sims";
import ChatPanel, { type ChatApi, type ChatBody } from "./ChatPanel";
import { Atom, BenchIcon, Compass, Flask, Gear, MagicFlask, SetSquare, SketchDefs, Walrus } from "./Doodles";
import EmailSignup from "./EmailSignup";
import Icon from "./Icon";
import type { UiIconName } from "./ui-icons";
import { KindChip } from "./MessageParts";
import Tour from "./Tour";
import Workbench from "./Workbench";

type ThreadRow = { id: string; title: string; sim_id: string; memory_on: boolean; updated_at: string };
type MemRow = { id: string; kind: string; sim_id: string | null; text: string; status: string; source: string; blob_id: string | null; created_at: string };
type Me = { user: { id: string; username: string }; memory: { mode: "shared" | "own" | "mock"; namespace: string }; model: string };

const SUGGESTIONS: Record<string, string[]> = {
  truss: [
    "I'm building a popsicle-stick bridge for a school contest: max 50 sticks, wood glue only, it must span 40 cm.",
    "Which truss holds the most weight for the fewest sticks?",
    "Why would a flat beam bridge snap so early?",
  ],
  queue: [
    "I run a small supermarket. Lunch rush is about 45 customers an hour, and I can pay at most 3 cashiers at ₦1,200/hr.",
    "Is an express lane worth it for my shop?",
    "How many cashiers do I need so nobody waits more than 3 minutes?",
  ],
  solar: [
    "I have a 24V 200Ah LiFePO4 bank and 1.2 kW of panels. My inverter keeps cutting out before morning.",
    "What happens to my setup on a cloudy rainy-season day?",
    "Should I load-shed at night to keep the fridge running?",
  ],
  projectile: [
    "What launch angle hits a target 40 m away with the slowest throw?",
    "Build me a pendulum that ticks every 2 seconds, then try it on Mars.",
    "How much does air drag change a 0.2 kg ball's range?",
  ],
  outbreak: [
    "A flu with R0 of 3 hits a town of 50,000 with 2 beds per 1000 people. Do the hospitals cope?",
    "How many people need to be vaccinated so the hospitals never overflow?",
    "Is it better to start distancing on day 10 or day 30?",
  ],
  braking: [
    "I drive at 80 km/h on wet roads. Could I stop if a child ran out 40 m ahead?",
    "How much longer does it take to stop if I'm on my phone?",
    "What speed is safe on a gravel road with worn tyres?",
  ],
  savings: [
    "I can save ₦60,000 a month and need ₦2.5 million for school fees in 3 years. Will I make it?",
    "Inflation is 25% and my savings account pays 12%. Should I even bother?",
    "What if I raise my savings by 10% every year?",
  ],
  rocket: [
    "Science fair: our 2 L bottle rocket must reach 40 m. The pump only does 70 psi.",
    "How much water should I put in for the highest flight?",
    "Do fins really matter?",
  ],
  shelf: [
    "I want a 1 m pine shelf for about 40 kg of books. How thick should the plank be?",
    "Will an 18 mm MDF shelf sag over time?",
    "How far can a floating shelf stick out and still hold a microwave?",
  ],
  pulley: [
    "I need to lift a 120 kg engine and can pull about 30 kg. How many ropes do I need?",
    "How long should a wheelchair ramp be for a 50 cm step?",
    "Where should I put the pivot to lever up a 200 kg stone?",
  ],
  eggdrop: [
    "Egg drop contest from the 3rd floor (about 10 m). We can use straws, tape and a plastic bag.",
    "Is a parachute or padding more important?",
    "How big a parachute stops the egg cracking on concrete?",
  ],
  roadtrip: [
    "I'm driving Lagos to Abuja in a Corolla with a 50 L tank. How many fuel stops will I need?",
    "How much fuel do I save going 100 instead of 130 km/h?",
    "There's no fuel for 300 km on part of my route. Will I make it?",
  ],
  rainwater: [
    "My roof is about 100 m² in Abuja and we are 6 people. How big a tank so we never run dry?",
    "Is rainwater enough for drinking and cooking all year?",
    "Does a tile roof collect much less than a metal one?",
  ],
  generator: [
    "I have a 2.5 kVA petrol gen and NEPA is off 10 hours a night. What will fuel cost me each week?",
    "Can my 3.5 kVA run a 1.5 HP AC and the fridge?",
    "Is diesel cheaper to run than petrol for my shop?",
  ],
  cooling: [
    "My bedroom is 4 x 4 m with a zinc roof and gets very hot. Is a 1 HP AC enough?",
    "Would a ceiling board help more than a bigger AC?",
    "What size AC do I need for a 30 m² living room?",
  ],
  powerbill: [
    "I'm on Band A at ₦209/kWh and my bill is ₦70,000 a month. What's eating my units?",
    "How much does running the AC all night really cost?",
    "Is the water heater worth it?",
  ],
  loan: [
    "A microfinance bank offers me ₦500,000 at 5% flat a month for 6 months. Is that a good deal?",
    "I earn ₦250,000 a month. How big a car loan can I afford?",
    "What's the real difference between flat and reducing-balance interest?",
  ],
  business: [
    "I want to open a small food stall. Rent is ₦20,000 a month and I can sell 60 plates a day at ₦1,500.",
    "How many sales a day do I need just to cover my costs?",
    "Should I raise my price or try to sell more?",
  ],
  titration: [
    "I want to check my vinegar is really 5% acid. I have 0.5 mol/L NaOH and a 50 mL burette.",
    "Why does methyl orange give the wrong answer with vinegar?",
    "Which indicator should I use for hydrochloric acid?",
  ],
  reaction: [
    "Science fair: which catalyst breaks down hydrogen peroxide fastest, yeast or manganese dioxide?",
    "How much faster is the reaction at 40 °C than at room temperature?",
    "Why does boiling the yeast stop it working?",
  ],
  fizz: [
    "How much baking soda do I need for 200 mL of vinegar so nothing is wasted?",
    "Will 20 g of baking soda pop my balloon?",
    "Which runs out first, the chalk or the acid?",
  ],
  evacuation: [
    "Our church hall holds 500 people and has two doors. Can everyone get out in 2.5 minutes?",
    "How much does one blocked exit slow things down?",
    "How wide should the doors be for a school assembly of 1,000 children?",
  ],
};

const CUSTOM_SUGGESTIONS = [
  "Run a test with the default settings and explain what happens.",
  "Which dial matters most here?",
  "Can you add another dial to this bench?",
];

const BUILD_EXAMPLES: { icon: UiIconName; text: string }[] = [
  { icon: "egg", text: "Poultry farm: 500 layers, feed price per bag, egg price per crate. How long until it pays for itself?" },
  { icon: "fish", text: "Fish pond: number of catfish, feed per day, months to harvest, selling price. Is it profitable?" },
  { icon: "bread-slice", text: "Baking bread: dough temperature, yeast amount, proving time. Does it rise enough?" },
  { icon: "elevator", text: "Office lift vs stairs: 6 floors, 120 staff arriving at 9am, one lift. How long is the queue?" },
];

function readLS(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {}
}

/** Keep the current value of every dial that still exists after a bench was rebuilt. */
function pickKnown(d: Record<string, ParamValue>, params: SimDef["params"]) {
  return Object.fromEntries(Object.entries(d).filter(([k]) => params.some((p) => p.key === k)));
}

function dialsFromMessages(simId: string, messages: UIMessage[]) {
  const sim = getSim(simId) ?? SIMS[0];
  let dials = defaultParams(sim.params);
  let current = sim.id;
  for (const m of messages)
    for (const raw of m.parts) {
      const p = raw as { type: string; data?: { preset?: { params?: Record<string, ParamValue> } }; output?: { simId?: string; params?: Record<string, ParamValue> } };
      if (p.type === "data-bootstrap" && p.data?.preset?.params) dials = { ...dials, ...p.data.preset.params };
      if ((p.type === "tool-switch_bench" || p.type === "tool-build_bench") && p.output?.simId && getSim(p.output.simId)) {
        current = p.output.simId;
        dials = defaultParams(getSim(current)!.params);
      }
      if (p.type === "tool-set_dials" && p.output?.params && (p.output.simId ?? current) === current) dials = { ...dials, ...p.output.params };
    }
  return { simId: current, dials };
}

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [active, setActive] = useState<{ id: string; messages: UIMessage[] } | null>(null);
  const [simId, setSimId] = useState("truss");
  const [dials, setDials] = useState<Record<string, ParamValue>>(defaultParams(SIMS[0].params));
  const [flashKeys, setFlashKeys] = useState<string[]>([]);
  const [runSignal, setRunSignal] = useState(0);
  const [memoryOn, setMemoryOn] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [memories, setMemories] = useState<MemRow[]>([]);
  const [walrusCount, setWalrusCount] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);
  const [loading, setLoading] = useState<string | null>("Opening your notebook…");
  const [settings, setSettings] = useState<SettingsTab | null>(null);
  const [toast, setToast] = useState<{ text: string; newSheet?: boolean } | null>(null);
  const [amnesiaHidden, setAmnesiaHidden] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"chat" | "bench">("chat");
  const [drawer, setDrawer] = useState(false);
  const [customSims, setCustomSims] = useState<SimDef[]>([]);
  const [codes, setCodes] = useState<Record<string, { code: string; version: number }>>({});
  const [simBusy, setSimBusy] = useState<string | null>(null);
  const [tour, setTour] = useState(false);
  const chatApi = useRef<ChatApi | null>(null);
  const pendingTests = useRef<{ text: string; body: ChatBody }[]>([]);
  const booted = useRef(false);
  const repairs = useRef<Record<string, number>>({});

  const sim = getSim(simId) ?? SIMS[0];
  const notify = (text: string, newSheet = false) => setToast({ text, newSheet });

  // ---------------------------------------------------------------- AI-built benches
  const storeCustom = useCallback((s: SimDef, code?: string, version?: number) => {
    registerCustomSims([s]);
    setCustomSims((list) => [{ ...s, custom: true }, ...list.filter((x) => x.id !== s.id)]);
    if (code != null) setCodes((c) => ({ ...c, [s.id]: { code, version: version ?? 1 } }));
  }, []);

  const loadCustom = useCallback(
    async (id: string) => {
      const r = await fetch(`/api/sims/${id}`).then((r) => r.json());
      if (r.error) throw new Error(r.error);
      storeCustom(r.sim, r.code, r.version);
      return r.sim as SimDef;
    },
    [storeCustom],
  );

  // Fetch the code of an AI-built bench the first time it's opened.
  useEffect(() => {
    if (!sim.custom || codes[sim.id]) return;
    const t = setTimeout(() => loadCustom(sim.id).catch((e) => setToast({ text: `Couldn't load that bench: ${e.message}` })), 0);
    return () => clearTimeout(t);
  }, [sim, codes, loadCustom]);

  const srcDoc = useMemo(() => {
    const c = sim.custom ? codes[sim.id] : undefined;
    return c ? buildSimDoc(c.code, defaultParams(sim.params), window.location.origin) : undefined;
  }, [sim, codes]);

  /** The browser saw an AI-built bench crash or hang: send the error back to the AI to fix (twice at most). */
  async function repairSim(id: string, message: string) {
    const n = repairs.current[id] ?? 0;
    if (n >= 2) {
      notify(`This AI-built bench still has a problem (${message.slice(0, 90)}). Ask Playbook to fix it in the chat.`);
      return;
    }
    repairs.current[id] = n + 1;
    setSimBusy(`It crashed: “${message.slice(0, 90)}”. The AI is fixing its own code…`);
    try {
      const r = await fetch(`/api/sims/${id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: message }),
      }).then((r) => r.json());
      if (r.error) throw new Error(r.error);
      storeCustom(r.sim, r.code, r.version);
      setDials((d) => ({ ...defaultParams(r.sim.params), ...pickKnown(d, r.sim.params) }));
      notify("Fixed. The AI rewrote the bench after it crashed.");
    } catch (e) {
      notify(`The AI couldn't fix the bench: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSimBusy(null);
    }
  }

  async function benchChanged(id: string) {
    setSimBusy("Setting up the new bench…");
    try {
      const s = await loadCustom(id);
      setDials((d) => (id === simId ? { ...defaultParams(s.params), ...pickKnown(d, s.params) } : defaultParams(s.params)));
      setSimId(s.id);
      setMobileTab("bench");
    } catch (e) {
      notify(`Couldn't load the new bench: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSimBusy(null);
    }
  }

  async function buildBench(request: string) {
    const r = await fetch("/api/sims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request, memoryOn }),
    }).then((r) => r.json());
    if (r.error) throw new Error(r.error);
    storeCustom(r.sim, r.code, r.version);
    await newSheet(r.sim.id);
    refreshMemories();
    const used = (r.memories ?? []) as string[];
    if (used.length)
      notify(`Built with ${used.length} thing${used.length > 1 ? "s" : ""} Walrus Memory knows about you: ${used.slice(0, 3).map((m) => `“${m.length > 70 ? m.slice(0, 70) + "…" : m}”`).join(", ")}${used.length > 3 ? "…" : ""}`);
  }

  // ---------------------------------------------------------------- first-run walkthrough
  useEffect(() => {
    if (!me || !active || loading || picker || readLS("pb-tour", "") === "done") return;
    const t = setTimeout(() => setTour(true), 900);
    return () => clearTimeout(t);
  }, [me, active, loading, picker]);

  // ---------------------------------------------------------------- boot
  useEffect(() => {
    if (booted.current) return; // dev StrictMode runs effects twice
    booted.current = true;
    setMemoryOn(readLS("pb-memory", "on") === "on");
    setTheme(readLS("pb-theme", "light") === "dark" ? "dark" : "light");
    (async () => {
      const [meRes, thRes, simRes] = await Promise.all([
        fetch("/api/auth/me").then((r) => r.json()),
        fetch("/api/threads").then((r) => r.json()),
        fetch("/api/sims")
          .then((r) => r.json())
          .catch(() => ({ sims: [] })),
      ]);
      if (!meRes.user) return location.reload();
      registerCustomSims(simRes.sims ?? []);
      setCustomSims(simRes.sims ?? []);
      setMe(meRes);
      setThreads(thRes.threads ?? []);
      if (thRes.threads?.length) await openThread(thRes.threads[0].id);
      else {
        setLoading(null);
        setPicker(true);
      }
      refreshMemories();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeLS("pb-theme", theme);
  }, [theme]);

  const refreshMemories = useCallback(async () => {
    try {
      const r = await fetch("/api/memories").then((r) => r.json());
      setMemories(r.memories ?? []);
      setWalrusCount(r.walrusCount ?? null);
    } catch {}
  }, []);

  const refreshThreads = useCallback(async () => {
    const r = await fetch("/api/threads").then((r) => r.json());
    setThreads(r.threads ?? []);
  }, []);

  async function openThread(id: string) {
    setLoading("Opening sheet…");
    const r = await fetch(`/api/threads/${id}`).then((r) => r.json());
    if (!r.thread) {
      setLoading(null);
      return;
    }
    const messages = r.thread.messages as UIMessage[];
    const d = dialsFromMessages(r.thread.sim_id, messages);
    setSimId(d.simId);
    setDials(d.dials);
    setActive({ id, messages });
    setLoading(null);
    setDrawer(false);
  }

  async function newSheet(nextSim: string) {
    setPicker(false);
    setDrawer(false);
    setLoading(memoryOn ? "Recalling what I know about you from Walrus Memory…" : "Fresh sheet, no memory…");
    try {
      const { thread } = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simId: nextSim, memoryOn }),
      }).then((r) => r.json());
      const boot = await fetch("/api/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.id }),
      }).then((r) => r.json());
      if (boot.error) throw new Error(boot.error);
      setSimId(nextSim);
      setDials(boot.dials);
      flash(Object.keys(boot.dials).filter((k) => boot.dials[k] !== getSim(nextSim)!.params.find((p) => p.key === k)?.default));
      setActive({ id: thread.id, messages: [boot.message] });
      refreshThreads();
    } catch (e) {
      notify(`Couldn't open a sheet: ${e instanceof Error ? e.message : e}`);
    } finally {
      setLoading(null);
    }
  }

  function flash(keys: string[]) {
    setFlashKeys(keys);
    setTimeout(() => setFlashKeys([]), 1400);
  }

  // ---------------------------------------------------------------- dials + bench
  const onDial = (k: string, v: ParamValue) => setDials((d) => ({ ...d, [k]: v }));

  function applyDials(o: { simId: string; params: Record<string, ParamValue>; runTest: boolean }) {
    const target = getSim(o.simId) ?? sim;
    const { params } = sanitizeParams(target.params, o.params);
    if (target.id !== simId) {
      setSimId(target.id);
      setDials({ ...defaultParams(target.params), ...params });
    } else setDials((d) => ({ ...d, ...params }));
    flash(Object.keys(params));
    setMobileTab("bench");
    if (o.runTest) setRunSignal((n) => n + 1);
  }

  /** One-click scenario: every dial it lists, everything else back to its default. */
  function applyPreset(p: SimPreset) {
    const next = { ...defaultParams(sim.params), ...p.params };
    flash(Object.keys(next).filter((k) => next[k] !== dials[k]));
    setDials(next);
  }

  function switchBench(next: string) {
    const s = getSim(next);
    if (!s) return;
    setSimId(next);
    setDials(defaultParams(s.params));
  }

  // ---------------------------------------------------------------- test results -> memory -> chat
  async function onResult(result: SimResult, params: Record<string, ParamValue>) {
    let memoryNote: string | undefined;
    if (memoryOn) {
      try {
        const r = await fetch("/api/memories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "sim_result", simId, params, result }),
        }).then((r) => r.json());
        memoryNote = r.stored
          ? `📌 Saved to Walrus Memory as ${result.passed ? "a new personal best" : "a failure lesson"}.`
          : r.reason
            ? `Not saved to memory: ${r.reason}.`
            : undefined;
        refreshMemories();
      } catch {}
    }
    const msg = "[test] " + JSON.stringify({ passed: result.passed, summary: result.summary, failureReason: result.failureReason, memory: memoryNote });
    pendingTests.current.push({ text: msg, body: { simId, dials: params, memoryOn } });
    flushTests();
  }

  function flushTests() {
    const api = chatApi.current;
    if (!api || !pendingTests.current.length) return;
    if (api.busy()) {
      setTimeout(flushTests, 800);
      return;
    }
    const next = pendingTests.current.shift()!;
    api.send(next.text, next.body);
  }

  // ---------------------------------------------------------------- memory switch
  function toggleMemory() {
    const next = !memoryOn;
    setMemoryOn(next);
    writeLS("pb-memory", next ? "on" : "off");
    notify(next ? "Walrus Memory is ON. Open a new sheet to see it recall you." : "Walrus Memory is OFF (amnesia mode). Open a new sheet to compare.", true);
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const activeThread = threads.find((t) => t.id === active?.id);

  // ---------------------------------------------------------------- render
  return (
    <div className="graph-paper h-dvh w-full overflow-hidden flex flex-col">
      <SketchDefs />
      {/* top bar: kept to the essentials so it fits a phone */}
      <header className="sheet border-b-[1.5px] border-ink flex items-center gap-2 sm:gap-3 px-2 sm:px-3 h-14 shrink-0 relative z-20">
        <button data-tour="menu" className="lg:hidden btn-ink w-9 h-8 flex items-center justify-center shrink-0" onClick={() => setDrawer(!drawer)} aria-label="Menu">
          <Icon name="bars" />
        </button>
        <button onClick={() => setSettings("about")} className="flex items-center gap-1.5 min-w-0 group" title="About Playbook and settings">
          <Gear size={28} className="text-navy wobble shrink-0 transition-transform duration-500 group-hover:rotate-90" />
          <span className="hand text-[22px] sm:text-2xl leading-none">Playbook</span>
        </button>
        <div className="hidden md:flex items-center gap-2 ml-2 pl-3 border-l border-ink/20 min-w-0">
          <BenchIcon simId={sim.id} size={26} className="text-ink shrink-0" />
          <span className="hand text-[15px] truncate">{sim.name}</span>
        </div>
        <div className="flex-1" />
        <button onClick={() => setTour(true)} className="w-8 h-8 flex items-center justify-center rounded-full text-ink-2 hover:text-ink hover:bg-note shrink-0" title="How to use Playbook" aria-label="Show the walkthrough">
          <Icon name="circle-question" size={20} />
        </button>
        <MemorySwitch on={memoryOn} onToggle={toggleMemory} mode={me?.memory.mode} />
        <button onClick={() => setSettings("about")} className="hidden sm:flex w-8 h-8 items-center justify-center rounded-full text-ink-2 hover:text-ink hover:bg-note shrink-0" title="Settings" aria-label="Settings">
          <Icon name="gear" size={18} />
        </button>
      </header>

      <div className="flex-1 min-h-0 flex relative">
        {/* sidebar */}
        <aside
          className={`sheet border-r-[1.5px] border-ink w-[272px] shrink-0 flex flex-col min-h-0 z-10 lg:static absolute inset-y-0 left-0 transition-transform ${
            drawer ? "translate-x-0 shadow-[4px_0_0_var(--shadow)]" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="p-3">
            <button data-tour="new-sheet" onClick={() => setPicker(true)} className="btn-ink w-full py-1.5 text-[17px]">
              + New sheet
            </button>
          </div>
          <div className="px-3 hand text-[13px] text-ink-3 uppercase tracking-wider">Sheets</div>
          <nav className="overflow-y-auto px-2 pb-2 max-h-[34%] min-h-[80px]">
            {threads.length === 0 && <p className="px-2 py-1 text-[13px] text-ink-3">No sheets yet.</p>}
            {threads.map((t) => (
              <button
                key={t.id}
                onClick={() => openThread(t.id)}
                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-[3px] text-[14px] ${
                  t.id === active?.id ? "bg-navy-soft border-l-[3px] border-navy" : "hover:bg-sheet-2"
                }`}
              >
                <BenchIcon simId={t.sim_id} size={18} className="text-ink-2 shrink-0" />
                <span className="truncate flex-1">{t.title}</span>
                {!t.memory_on && <span className="mono text-[9px] text-ink-3 border border-ink/30 px-0.5 rounded">OFF</span>}
              </button>
            ))}
          </nav>

          <div className="border-t border-dashed border-ink/30 mx-3" />
          <div data-tour="ledger" className="flex flex-col min-h-0 flex-1">
          <div className="px-3 pt-2 flex items-baseline justify-between">
            <span className="hand text-[13px] text-ink-3 uppercase tracking-wider">Memory ledger</span>
            <button onClick={refreshMemories} className="mono text-[10px] text-ink-3 hover:text-ink" title="refresh">
              ↻
            </button>
          </div>
          <div className="px-3 pb-1 text-[12.5px] text-ink-2">
            <span className="mono text-[20px] text-navy">{walrusCount ?? memories.filter((m) => m.status !== "failed").length}</span>{" "}
            memories on Walrus
            {me?.memory.mode === "mock" && <span className="block mono text-[10px] text-amber">local mock: add MemWal keys to .env.local</span>}
          </div>
          <ul className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1.5 min-h-0">
            {memories.slice(0, 60).map((m) => (
              <li key={m.id} className="text-[12px] leading-snug flex gap-1.5 items-start" title={m.blob_id ? `Walrus blob ${m.blob_id}` : m.status}>
                <span
                  className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                    m.status === "done" ? "bg-green" : m.status === "failed" ? "bg-red" : "bg-amber pulse"
                  }`}
                />
                <div className="min-w-0">
                  <KindChip kind={m.kind} />{" "}
                  <span className="text-ink-2">{m.text.replace(/^\[[^\]]+\]\s*/, "").replace(/\sscore=.*$/, "").replace(/\sparams=.*$/, "")}</span>
                </div>
              </li>
            ))}
          </ul>
          </div>
          <div className="hidden lg:flex justify-around px-3 pb-3 text-navy opacity-50 wobble" aria-hidden>
            <Flask size={34} />
            <Atom size={34} />
            <SetSquare size={30} />
            <Compass size={30} />
          </div>
        </aside>
        {drawer && <div className="lg:hidden absolute inset-0 bg-ink/20 z-[5]" onClick={() => setDrawer(false)} />}

        {/* chat + bench */}
        <main className="flex-1 min-w-0 flex flex-col lg:flex-row min-h-0">
          <div className="lg:hidden flex border-b border-ink/30 sheet">
            {(["chat", "bench"] as const).map((t) => (
              <button key={t} data-tour={t === "bench" ? "bench-tab" : undefined} onClick={() => setMobileTab(t)} className={`flex-1 hand py-1.5 text-[15px] ${mobileTab === t ? "border-b-[3px] border-navy" : "text-ink-3"}`}>
                {t === "chat" ? "Chat" : "Workbench"}
              </button>
            ))}
          </div>
          <div className={`lg:w-[42%] lg:min-w-[340px] lg:max-w-[560px] min-h-0 flex-1 lg:flex-none lg:border-r-[1.5px] border-ink/70 ${mobileTab === "chat" ? "flex" : "hidden"} lg:flex flex-col`}>
            {activeThread && !activeThread.memory_on && memoryOn && amnesiaHidden !== activeThread.id && (
              <div className="mx-3 mt-2 flex items-center gap-2 px-2.5 py-1 ink-box-soft bg-note/70 text-[12.5px] text-ink-2 shrink-0">
                <span className="flex-1">This sheet was started with memory off, so it won&rsquo;t recall you.</span>
                <button onClick={() => setPicker(true)} className="hand underline decoration-dotted shrink-0">new sheet</button>
                <button onClick={() => setAmnesiaHidden(activeThread.id)} className="p-1 text-ink-3 hover:text-ink shrink-0" aria-label="Dismiss">
                  <Icon name="xmark" />
                </button>
              </div>
            )}
            {active && me ? (
              <ChatPanel
                key={active.id}
                threadId={active.id}
                initialMessages={active.messages}
                simId={simId}
                dials={dials}
                memoryOn={memoryOn}
                username={me.user.username}
                suggestions={SUGGESTIONS[simId] ?? (sim.custom ? CUSTOM_SUGGESTIONS : [])}
                registerApi={(api) => {
                  chatApi.current = api;
                  if (api) flushTests();
                }}
                onSetDials={applyDials}
                onSwitchBench={switchBench}
                onBenchChanged={benchChanged}
                onMemoryChanged={() => setTimeout(refreshMemories, 600)}
                onFinished={() => {
                  refreshThreads();
                  refreshMemories();
                }}
              />
            ) : (
              <EmptyChat onNew={() => setPicker(true)} />
            )}
          </div>
          <div className={`flex-1 min-w-0 min-h-0 ${mobileTab === "bench" ? "flex" : "hidden"} lg:flex flex-col`}>
            {sim.custom && !srcDoc ? (
              <div className="flex-1 m-3 ink-box bg-sheet flex items-center justify-center hand text-ink-3 pulse">{simBusy ?? "unrolling the AI-built drawing…"}</div>
            ) : (
            <Workbench
              key={`${sim.id}:${codes[sim.id]?.version ?? 0}`}
              sim={sim}
              srcDoc={srcDoc}
              busyNote={simBusy}
              onSimError={sim.custom ? (m) => repairSim(sim.id, m) : undefined}
              dials={dials}
              onDial={onDial}
              onReset={() => setDials(defaultParams(sim.params))}
              onPreset={applyPreset}
              flashKeys={flashKeys}
              theme={theme}
              runSignal={runSignal}
              onResult={onResult}
            />
            )}
          </div>
        </main>
      </div>

      {picker && (
        <BenchPicker onPick={newSheet} onBuild={buildBench} custom={customSims} onClose={() => setPicker(false)} canClose={threads.length > 0} memoryOn={memoryOn} />
      )}
      {tour && (
        <Tour
          onClose={() => {
            writeLS("pb-tour", "done");
            setTour(false);
          }}
        />
      )}
      {settings && me && (
        <Settings
          me={me}
          tab={settings}
          onTab={setSettings}
          theme={theme}
          onTheme={setTheme}
          onTour={() => {
            setSettings(null);
            setTour(true);
          }}
          onClose={() => setSettings(null)}
        />
      )}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/70 backdrop-blur-[1px]">
          <div className="sheet ink-box px-6 py-5 flex items-center gap-4">
            <Gear size={44} className="text-navy animate-spin [animation-duration:4s]" />
            <span className="hand text-lg">{loading}</span>
          </div>
        </div>
      )}
      {/* toasts sit at the top on phones so they never cover the message box */}
      {toast && (
        <div className="fixed top-16 inset-x-3 sm:inset-x-auto sm:top-auto sm:bottom-4 sm:right-4 z-50 sheet ink-box pl-4 pr-2 py-2 sm:max-w-sm text-[14px] flex gap-2 items-center">
          <span className="flex-1">{toast.text}</span>
          {toast.newSheet && (
            <button className="btn-ink px-2 text-[13px] shrink-0" onClick={() => { setToast(null); setPicker(true); }}>
              new sheet
            </button>
          )}
          <button onClick={() => setToast(null)} className="p-1 text-ink-3 hover:text-ink shrink-0" aria-label="Dismiss">
            <Icon name="xmark" />
          </button>
        </div>
      )}
    </div>
  );
}

function MemorySwitch({ on, onToggle, mode }: { on: boolean; onToggle: () => void; mode?: string }) {
  return (
    <button
      data-tour="memory"
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2 py-1 border-[1.5px] border-ink rounded-[4px] bg-sheet shadow-[2px_2px_0_var(--shadow)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none shrink-0"
      title="Kill switch: turn Walrus Memory off to see how the bot behaves without it"
      aria-label={`Walrus Memory ${on ? "on" : "off"}`}
    >
      <Walrus size={22} className={`hidden min-[400px]:block ${on ? "text-navy" : "text-ink-3"}`} />
      <svg viewBox="0 0 44 24" className="w-9 sm:w-10 h-6 text-ink" aria-hidden>
        <g stroke="currentColor" fill="none" strokeLinecap="round">
          <rect x="2" y="15" width="40" height="7" rx="1.5" fill="url(#pb-hatch)" strokeWidth="1.3" />
          <path d="M8 15 V11 M34 15 V11" strokeWidth="1.5" />
          <g style={{ transition: "transform .25s cubic-bezier(.5,1.6,.5,1)", transformOrigin: "8px 12px", transform: `rotate(${on ? 0 : -50}deg)` }}>
            <path d="M8 12 H35" strokeWidth="2.6" />
            <rect x="32" y="4" width="8" height="7" rx="2.5" fill={on ? "var(--green)" : "var(--sheet)"} strokeWidth="1.3" />
          </g>
        </g>
      </svg>
      <span className="flex flex-col items-start leading-none">
        <span className="hidden sm:inline mono text-[9px] text-ink-3 tracking-widest">WALRUS MEMORY</span>
        <span className={`mono text-[12px] font-semibold ${on ? "text-green" : "text-red"}`}>
          {on ? "● ON" : "○ OFF"}
          {mode === "own" && on && <span className="text-ink-3 font-normal"> · own acct</span>}
        </span>
      </span>
    </button>
  );
}

const BUILD_STAGES = ["Reading your idea…", "Sketching the diagram…", "Wiring up the dials…", "Writing the physics…", "Test-running every dial…", "Checking nothing overlaps…", "Almost there…"];

function BenchPicker({
  onPick,
  onBuild,
  custom,
  onClose,
  canClose,
  memoryOn,
}: {
  onPick: (id: string) => void;
  onBuild: (request: string) => Promise<void>;
  custom: SimDef[];
  onClose: () => void;
  canClose: boolean;
  memoryOn: boolean;
}) {
  const [idea, setIdea] = useState("");
  const [building, setBuilding] = useState(false);
  const [stage, setStage] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!building) return;
    const t = setInterval(() => setStage((s) => Math.min(BUILD_STAGES.length - 1, s + 1)), 6000);
    return () => clearInterval(t);
  }, [building]);

  async function build() {
    if (idea.trim().length < 12 || building) return;
    setErr(null);
    setStage(0);
    setBuilding(true);
    try {
      await onBuild(idea.trim());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBuilding(false);
    }
  }

  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<SimCategory | "all">("all");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (s: SimDef) => {
    if (!words.length) return true;
    const hay = [s.name, s.tagline, ...s.keywords, ...(s.presets ?? []).map((p) => p.label)].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  };
  const found = SIMS.filter(matches);
  const builtIn = found.filter((s) => cat === "all" || s.category === cat);
  const mine = custom.filter(matches);
  const tabs = [{ id: "all" as const, label: "All", icon: "list-check" as const }, ...CATEGORIES];
  const shelves = CATEGORIES.map((c) => ({ ...c, sims: builtIn.filter((s) => s.category === c.id) })).filter((c) => c.sims.length);

  const card = (s: SimDef) => (
    <button key={s.id} onClick={() => onPick(s.id)} disabled={building} className="btn-ink text-left p-3 flex gap-3 items-start font-sans disabled:opacity-50 group">
      <BenchIcon simId={s.id} size={50} className="text-navy shrink-0 wobble transition-transform group-hover:-rotate-6" />
      <span className="min-w-0 flex-1">
        <span className="hand text-[17px] block leading-tight">{s.name}</span>
        <span className="text-[13px] text-ink-2 font-sans block">{s.tagline}</span>
        {!!s.presets?.length && (
          <span className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink-3 font-sans">
            <Icon name="sliders" className="text-navy shrink-0" />
            <span className="truncate">
              {s.presets.length} scenarios: {s.presets.slice(0, 3).map((p) => p.label).join(" · ")}…
            </span>
          </span>
        )}
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/25 p-3 sm:p-4" onClick={() => canClose && !building && onClose()}>
      <div className="sheet ink-box w-full max-w-3xl max-h-[min(90dvh,860px)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* fixed header */}
        <div className="px-5 pt-4 pb-3 border-b border-dashed border-ink/30 shrink-0">
          <div className="flex items-start justify-between">
            <h2 className="hand text-3xl">Pick a workbench</h2>
            {canClose && !building && (
              <button onClick={onClose} className="hand text-ink-3 hover:text-ink text-lg" aria-label="Close">
                ✕
              </button>
            )}
          </div>
          <p className="text-ink-2 text-[13.5px]">
            {memoryOn
              ? "Memory is ON: I'll recall your limits, best builds and past failures for this bench, and set the dials to your best result."
              : "Memory is OFF: you'll get a blank bench and a bot that doesn't know you."}
          </p>
        </div>

        {/* scrolling body */}
        <div className="overflow-y-auto overscroll-contain flex-1 min-h-0 px-5 py-4 flex flex-col gap-5">
          <HowBenchesWork />
          {/* AI builder */}
          <section className="ink-box-soft bg-note/60 p-3 relative">
            <div className="flex items-center gap-2">
              <MagicFlask size={30} className="text-navy wobble shrink-0" />
              <div>
                <h3 className="hand text-[19px] leading-tight">Invent a new bench with AI</h3>
                <p className="text-[12.5px] text-ink-2">Describe anything you want to test. The AI writes a working simulation with dials, usually in 15–40 seconds.</p>
              </div>
            </div>
            {building ? (
              <div className="flex items-center gap-3 py-4 px-1">
                <Gear size={40} className="text-navy animate-spin [animation-duration:3s] shrink-0" />
                <div>
                  <p className="hand text-[17px]">{stage === 0 && memoryOn ? "Recalling what Walrus Memory knows about you…" : BUILD_STAGES[stage]}</p>
                  <p className="text-[12.5px] text-ink-3 italic line-clamp-2">“{idea}”</p>
                </div>
              </div>
            ) : (
              <>
                <textarea
                  id="pb-idea"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) build();
                  }}
                  rows={2}
                  placeholder="e.g. A poultry farm: number of birds, feed price, egg price. When does it pay for itself?"
                  className="mt-2 w-full resize-none bg-sheet border-[1.5px] border-ink/40 focus:border-ink rounded-[3px] outline-none text-[14.5px] px-2 py-1.5 placeholder:text-ink-3"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
                  {BUILD_EXAMPLES.map((ex) => (
                    <button key={ex.text} onClick={() => setIdea(ex.text)} className="text-[12px] px-2 py-0.5 border border-dashed border-ink/40 rounded hover:border-ink hover:bg-sheet text-ink-2 text-left flex items-center gap-1.5">
                      <Icon name={ex.icon} className="text-navy" />
                      {ex.text.split(":")[0]}
                    </button>
                  ))}
                  <div className="flex-1" />
                  <button onClick={build} disabled={idea.trim().length < 12} className="btn-ink px-3 py-1 text-[15px] disabled:opacity-40">
                    ✦ Build it
                  </button>
                </div>
                {err && <p className="text-red text-[12.5px] mt-1.5 mono">{err}</p>}
              </>
            )}
          </section>

          {/* find a ready-made bench */}
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 border-b-[1.5px] border-ink/40 focus-within:border-ink">
              <Icon name="magnifying-glass" className="text-ink-3" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${SIMS.length} ready-made benches: water, loan, bridge, AC…`}
                className="flex-1 bg-transparent outline-none text-[14.5px] py-1.5 placeholder:text-ink-3 min-w-0"
                aria-label="Search benches"
              />
              {query && (
                <button onClick={() => setQuery("")} className="p-1 text-ink-3 hover:text-ink" aria-label="Clear search">
                  <Icon name="xmark" />
                </button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1" role="tablist" aria-label="Bench shelves">
              {tabs.map((c) => {
                const n = c.id === "all" ? found.length : found.filter((s) => s.category === c.id).length;
                const on = cat === c.id;
                return (
                  <button
                    key={c.id}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setCat(c.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] whitespace-nowrap ${
                      on ? "bg-ink text-sheet border border-ink" : "border border-ink/30 text-ink-2 hover:border-ink hover:text-ink"
                    } ${n === 0 && !on ? "opacity-40" : ""}`}
                  >
                    <Icon name={c.icon} />
                    {c.label}
                    <span className={`mono text-[10.5px] ${on ? "opacity-70" : "text-ink-3"}`}>{n}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {mine.length > 0 && (
            <section>
              <h3 className="hand text-[13px] text-ink-3 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name="wand-magic-sparkles" className="text-navy" /> Your AI-built benches
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">{mine.map(card)}</div>
            </section>
          )}

          {shelves.map((c) => (
            <section key={c.id}>
              <h3 className="hand text-[13px] text-ink-3 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Icon name={c.icon} className="text-navy" /> {c.label}
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">{c.sims.map(card)}</div>
            </section>
          ))}

          {builtIn.length === 0 && mine.length === 0 && (
            <div className="ink-box-soft border-dashed p-4 text-center flex flex-col items-center gap-2">
              <p className="text-[14px] text-ink-2">
                No ready-made bench for &ldquo;{query}&rdquo;{cat !== "all" ? " on this shelf" : ""}. The AI can build one for you.
              </p>
              <button
                onClick={() => {
                  setIdea(`A simulation of ${query}: `);
                  document.getElementById("pb-idea")?.focus();
                }}
                className="btn-ink px-3 py-1 text-[14px] flex items-center gap-2"
              >
                <Icon name="wand-magic-sparkles" /> Describe it to the AI
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Short explainer: what a bench is, and how ready-made and AI-built ones differ. */
function HowBenchesWork() {
  return (
    <details className="ink-box-soft border-dashed px-3 py-2 text-[13px] text-ink-2 group">
      <summary className="hand text-[15px] text-ink cursor-pointer flex items-center gap-2 list-none">
        <Icon name="circle-question" className="text-navy" />
        How do benches work?
        <span className="ml-auto text-ink-3 text-[12px] group-open:hidden">show</span>
      </summary>
      <div className="mt-2 flex flex-col gap-2 leading-snug">
        <p>
          A <b>bench</b> is a small simulation of one real situation. Turn the dials (or pick a scenario), then press the big red button to run a test.
          The bench animates what happens, checks it against a pass rule (holds the load, reaches the goal, nobody waits too long) and reports the
          numbers to the chat. With memory on, wins and failures are saved so next time starts from what you learned.
        </p>
        <p>
          <b>Ready-made benches</b> are hand-built and checked. Each one uses real formulas and data (truss forces, compound interest, pH curves…),
          and the chat can tell you exactly which.
        </p>
        <p>
          <b>AI-built benches</b> are written on the spot from your description: the AI picks the dials and the pass rule and writes the simulation
          code. With memory on, it first recalls what Walrus Memory knows about you (where you are, your currency, the equipment and limits
          you&rsquo;ve mentioned) and builds those in as the defaults and targets. Before you see it, the code is test-run on our server: it has to
          start, finish an animated test, react to every dial, keep its labels from overlapping and give believable numbers. If it crashes in
          your browser, the AI repairs it. Great for quick what-ifs; double-check the numbers before
          relying on them for anything important.
        </p>
        <p>Either way, the chat sees your dials and results, and can set dials, run tests, switch benches, or change an AI-built bench for you.</p>
      </div>
    </details>
  );
}

type SettingsTab = "about" | "account" | "look";

const GITHUB_URL = "https://github.com/GunroarCannon/playbook";
const X_HANDLE = "therealgunroar";

function Settings({
  me,
  tab,
  onTab,
  theme,
  onTheme,
  onTour,
  onClose,
}: {
  me: Me;
  tab: SettingsTab;
  onTab: (t: SettingsTab) => void;
  theme: "light" | "dark";
  onTheme: (t: "light" | "dark") => void;
  onTour: () => void;
  onClose: () => void;
}) {
  const [accountId, setAccountId] = useState("");
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(clear = false) {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clear ? { memwalAccountId: null, memwalKey: null } : { memwalAccountId: accountId, memwalKey: key }),
    }).then((r) => r.json());
    setBusy(false);
    if (r.error) setMsg(r.error);
    else location.reload();
  }
  const tabs: [SettingsTab, string][] = [
    ["about", "About"],
    ["account", "Account & memory"],
    ["look", "Look"],
  ];
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/25 p-3 sm:p-4" onClick={onClose}>
      <div className="sheet ink-box w-full max-w-md max-h-[90dvh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="hand text-2xl flex items-center gap-2">
            <Gear size={26} className="text-navy wobble" /> Playbook
          </h2>
          <button onClick={onClose} className="p-1 text-ink-3 hover:text-ink" aria-label="Close">
            <Icon name="xmark" size={18} />
          </button>
        </div>
        <nav className="flex gap-4 px-5 mt-2 border-b border-dashed border-ink/30">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => onTab(id)} className={`hand text-[15px] pb-1.5 -mb-px ${tab === id ? "border-b-[3px] border-navy" : "text-ink-3 hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </nav>

        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">
          {tab === "about" && (
            <>
              <p className="text-[14px] text-ink-2">
                A what-if workbench that remembers you. Talk an idea through, turn the dials, press the big red button, and Playbook keeps your limits,
                best results and failures in Walrus Memory for next time.
              </p>
              <a href={`https://x.com/${X_HANDLE}`} target="_blank" rel="noreferrer" className="ink-box-soft bg-note/60 p-3 flex items-center gap-3 hover:bg-note group">
                <span className="w-10 h-10 rounded-full bg-ink text-sheet flex items-center justify-center shrink-0">
                  <Icon name="x-twitter" size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] text-ink-3">Built by</span>
                  <span className="hand text-[18px] group-hover:underline">@{X_HANDLE}</span>
                </span>
                <span className="ml-auto text-[13px] text-ink-3 hidden min-[380px]:inline">follow along →</span>
              </a>
              <section>
                <h3 className="hand text-lg mb-1">Join the email list</h3>
                <EmailSignup source="settings" />
              </section>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                <a href="/welcome" className="underline decoration-dotted text-navy">
                  What is Playbook?
                </a>
                <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="underline decoration-dotted text-navy inline-flex items-center gap-1">
                  <Icon name="github" /> Source on GitHub
                </a>
                <button onClick={onTour} className="underline decoration-dotted text-navy">
                  Replay the walkthrough
                </button>
              </div>
              <p className="text-[11.5px] text-ink-3">
                Icons by{" "}
                <a href="https://fontawesome.com" target="_blank" rel="noreferrer" className="underline">
                  Font Awesome Free
                </a>{" "}
                (CC BY 4.0). Built for Walrus Session 8, &ldquo;Chatbots That Remember&rdquo;.
              </p>
            </>
          )}

          {tab === "account" && (
            <>
              <dl className="text-[13px] grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-ink-3">Signed in as</dt>
                <dd className="hand text-[15px]">{me.user.username}</dd>
                <dt className="text-ink-3">Memory account</dt>
                <dd>{me.memory.mode === "own" ? "your own Walrus Memory account" : me.memory.mode === "shared" ? "Playbook's shared account" : "local mock (no MemWal keys set)"}</dd>
                <dt className="text-ink-3">Namespace</dt>
                <dd className="mono break-all">{me.memory.namespace}</dd>
                <dt className="text-ink-3">Model</dt>
                <dd className="mono break-all">{me.model}</dd>
              </dl>
              <section>
                <h3 className="hand text-lg">Bring your own Walrus Memory</h3>
                <p className="text-[13px] text-ink-2 mb-2">
                  Create an account at{" "}
                  <a href="https://memory.walrus.xyz" target="_blank" rel="noreferrer" className="underline text-blue">
                    memory.walrus.xyz
                  </a>{" "}
                  and paste the account ID and delegate key. New memories will go to your account (namespace <span className="mono">playbook</span>).
                </p>
                <div className="flex flex-col gap-2">
                  <input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="Account ID (0x…)" className="mono text-[13px] bg-transparent border-b-[1.5px] border-ink/50 outline-none py-1" />
                  <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Delegate private key" className="mono text-[13px] bg-transparent border-b-[1.5px] border-ink/50 outline-none py-1" />
                </div>
                {msg && <p className="text-red text-[13px] mt-2">{msg}</p>}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button disabled={busy || !accountId || !key} onClick={() => save()} className="btn-ink px-3 py-1">
                    {busy ? "checking…" : "Use my account"}
                  </button>
                  {me.memory.mode === "own" && (
                    <button disabled={busy} onClick={() => save(true)} className="btn-ink px-3 py-1">
                      Switch back to shared
                    </button>
                  )}
                </div>
              </section>
              <button
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  location.reload();
                }}
                className="btn-ink px-3 py-1 text-red self-start flex items-center gap-2"
              >
                <Icon name="right-from-bracket" /> Sign out
              </button>
            </>
          )}

          {tab === "look" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {(["light", "dark"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => onTheme(t)}
                    className={`ink-box-soft p-3 text-left flex flex-col gap-1 ${theme === t ? "outline-[2.5px] outline-navy outline-offset-2" : ""}`}
                    style={{ background: t === "light" ? "#fbfaf6" : "#161d28", color: t === "light" ? "#1d1f24" : "#e6edf3" }}
                  >
                    <Icon name={t === "light" ? "sun" : "moon"} size={18} />
                    <span className="hand text-[16px]">{t === "light" ? "Graph paper" : "Blueprint"}</span>
                  </button>
                ))}
              </div>
              <button onClick={onTour} className="btn-ink px-3 py-1 self-start flex items-center gap-2">
                <Icon name="hand-pointer" /> Replay the walkthrough
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyChat({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
      <Flask size={80} className="text-navy wobble opacity-70" />
      <p className="hand text-xl">Start a sheet to talk it through.</p>
      <button onClick={onNew} className="btn-ink px-4 py-1.5">
        + New sheet
      </button>
    </div>
  );
}
