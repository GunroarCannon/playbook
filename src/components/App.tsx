"use client";

import type { UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimResult } from "@/lib/protocol";
import { buildSimDoc } from "@/lib/sim-doc";
import { SIMS, defaultParams, getSim, registerCustomSims, sanitizeParams, type ParamValue, type SimDef } from "@/lib/sims";
import ChatPanel, { type ChatApi, type ChatBody } from "./ChatPanel";
import { Atom, BenchIcon, Compass, Flask, Gear, MagicFlask, SetSquare, SketchDefs } from "./Doodles";
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
};

const CUSTOM_SUGGESTIONS = [
  "Run a test with the default settings and explain what happens.",
  "Which dial matters most here?",
  "Can you add another dial to this bench?",
];

const BUILD_EXAMPLES = [
  "Rainwater tank for my house: roof size, rainfall, tank size, daily use. Does it run dry in the dry season?",
  "A generator for my shop: fuel tank, load in watts, hours of NEPA outage. When does it run out?",
  "Baking bread: dough temperature, yeast amount, proving time. Does it rise enough?",
  "A ramp for a wheelchair: height, length, push force. Is it too steep?",
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
  const [settings, setSettings] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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
    const t = setTimeout(() => loadCustom(sim.id).catch((e) => setToast(`Couldn't load that bench: ${e.message}`)), 0);
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
      setToast(`This AI-built bench still has a problem (${message.slice(0, 90)}). Ask Playbook to fix it in the chat.`);
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
      setToast("Fixed. The AI rewrote the bench after it crashed.");
    } catch (e) {
      setToast(`The AI couldn't fix the bench: ${e instanceof Error ? e.message : e}`);
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
      setToast(`Couldn't load the new bench: ${e instanceof Error ? e.message : e}`);
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
      setToast(`Couldn't open a sheet: ${e instanceof Error ? e.message : e}`);
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
    setToast(
      next
        ? "Walrus Memory is ON. Open a new sheet to see it recall you."
        : "Walrus Memory is OFF (amnesia mode). Open a new sheet to compare.",
    );
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const activeThread = threads.find((t) => t.id === active?.id);

  // ---------------------------------------------------------------- render
  return (
    <div className="graph-paper h-full flex flex-col">
      <SketchDefs />
      {/* top bar */}
      <header className="sheet border-b-[1.5px] border-ink flex items-center gap-3 px-3 h-14 shrink-0 relative z-20">
        <button data-tour="menu" className="lg:hidden btn-ink px-2 py-0.5" onClick={() => setDrawer(!drawer)} aria-label="Menu">
          ☰
        </button>
        <div className="flex items-center gap-2">
          <Gear size={28} className="text-navy wobble" />
          <span className="hand text-2xl leading-none">Playbook</span>
        </div>
        <div className="hidden md:flex items-center gap-2 ml-3 pl-3 border-l border-ink/20">
          <BenchIcon simId={sim.id} size={26} className="text-ink" />
          <span className="hand text-[15px]">{sim.name}</span>
        </div>
        <div className="flex-1" />
        {me && (
          <span className="hidden xl:inline mono text-[11px] text-ink-3 border border-ink/20 rounded px-1.5 py-0.5" title="LLM and runtime">
            {me.model}
          </span>
        )}
        <button onClick={() => setTour(true)} className="hand text-[15px] w-7 h-7 rounded-full border-[1.5px] border-ink hover:bg-note shrink-0" title="How to use Playbook" aria-label="Show the walkthrough">
          ?
        </button>
        <MemorySwitch on={memoryOn} onToggle={toggleMemory} mode={me?.memory.mode} />
        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="btn-ink px-2 py-0.5 text-[13px] hidden sm:block" title="Toggle blueprint mode">
          {theme === "dark" ? "paper" : "blueprint"}
        </button>
        {me && (
          <button onClick={() => setSettings(true)} className="hand text-[15px] px-2 hover:underline decoration-dotted" title="Account & memory settings">
            <span className="hidden sm:inline">{me.user.username} ▾</span>
            <span className="sm:hidden">⚙</span>
          </button>
        )}
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
              flashKeys={flashKeys}
              theme={theme}
              runSignal={runSignal}
              onResult={onResult}
            />
            )}
          </div>
        </main>
      </div>

      {activeThread && !activeThread.memory_on && memoryOn && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 hand text-[13px] sheet ink-box-soft px-3 py-1">
          This sheet was started in amnesia mode.
        </div>
      )}

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
      {settings && me && <Settings me={me} onClose={() => setSettings(false)} />}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/70 backdrop-blur-[1px]">
          <div className="sheet ink-box px-6 py-5 flex items-center gap-4">
            <Gear size={44} className="text-navy animate-spin [animation-duration:4s]" />
            <span className="hand text-lg">{loading}</span>
          </div>
        </div>
      )}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 sheet ink-box px-4 py-2 max-w-sm text-[14px] flex gap-3 items-center">
          <span>{toast}</span>
          <button className="btn-ink px-2 text-[13px] shrink-0" onClick={() => { setToast(null); setPicker(true); }}>
            new sheet
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
      className="flex items-center gap-2 px-2 py-1 border-[1.5px] border-ink rounded-[4px] bg-sheet shadow-[2px_2px_0_var(--shadow)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
      title="Kill switch: turn Walrus Memory off to see how the bot behaves without it"
    >
      <svg viewBox="0 0 44 24" className="w-10 h-6 text-ink" aria-hidden>
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
        <span className="mono text-[9px] text-ink-3 tracking-widest">WALRUS MEMORY</span>
        <span className={`mono text-[12px] font-semibold ${on ? "text-green" : "text-red"}`}>
          {on ? "● ON" : "○ OFF"}
          {mode === "own" && on && <span className="text-ink-3 font-normal"> · own acct</span>}
        </span>
      </span>
    </button>
  );
}

const BUILD_STAGES = ["Reading your idea…", "Sketching the diagram…", "Wiring up the dials…", "Writing the physics…", "Checking the code compiles…", "Almost there…"];

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

  const card = (s: SimDef) => (
    <button key={s.id} onClick={() => onPick(s.id)} disabled={building} className="btn-ink text-left p-3 flex gap-3 items-start font-sans disabled:opacity-50">
      <BenchIcon simId={s.id} size={50} className="text-navy shrink-0 wobble" />
      <span className="min-w-0">
        <span className="hand text-[17px] block leading-tight">{s.name}</span>
        <span className="text-[13px] text-ink-2 font-sans">{s.tagline}</span>
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
                  <p className="hand text-[17px]">{BUILD_STAGES[stage]}</p>
                  <p className="text-[12.5px] text-ink-3 italic line-clamp-2">“{idea}”</p>
                </div>
              </div>
            ) : (
              <>
                <textarea
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) build();
                  }}
                  rows={2}
                  placeholder="e.g. A water tank for my house: roof size, rainfall, daily use. Does it run dry?"
                  className="mt-2 w-full resize-none bg-sheet border-[1.5px] border-ink/40 focus:border-ink rounded-[3px] outline-none text-[14.5px] px-2 py-1.5 placeholder:text-ink-3"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
                  {BUILD_EXAMPLES.map((ex) => (
                    <button key={ex} onClick={() => setIdea(ex)} className="text-[12px] px-2 py-0.5 border border-dashed border-ink/40 rounded hover:border-ink hover:bg-sheet text-ink-2 text-left">
                      {ex.split(":")[0]}
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

          {custom.length > 0 && (
            <section>
              <h3 className="hand text-[13px] text-ink-3 uppercase tracking-wider mb-2">Your AI-built benches</h3>
              <div className="grid sm:grid-cols-2 gap-3">{custom.map(card)}</div>
            </section>
          )}

          <section>
            <h3 className="hand text-[13px] text-ink-3 uppercase tracking-wider mb-2">Hand-built benches</h3>
            <div className="grid sm:grid-cols-2 gap-3">{SIMS.map(card)}</div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Settings({ me, onClose }: { me: Me; onClose: () => void }) {
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
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/25 p-4" onClick={onClose}>
      <div className="sheet ink-box w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <h2 className="hand text-2xl">{me.user.username}&rsquo;s notebook</h2>
          <button onClick={onClose} className="hand text-ink-3 hover:text-ink text-lg">✕</button>
        </div>
        <dl className="text-[13px] grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 mb-4">
          <dt className="text-ink-3">Memory account</dt>
          <dd>{me.memory.mode === "own" ? "your own Walrus Memory account" : me.memory.mode === "shared" ? "Playbook's shared account" : "local mock (no MemWal keys set)"}</dd>
          <dt className="text-ink-3">Namespace</dt>
          <dd className="mono">{me.memory.namespace}</dd>
          <dt className="text-ink-3">Model</dt>
          <dd className="mono">{me.model}</dd>
        </dl>
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
        <div className="flex gap-2 mt-4 flex-wrap">
          <button disabled={busy || !accountId || !key} onClick={() => save()} className="btn-ink px-3 py-1">
            {busy ? "checking…" : "Use my account"}
          </button>
          {me.memory.mode === "own" && (
            <button disabled={busy} onClick={() => save(true)} className="btn-ink px-3 py-1">
              Switch back to shared
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              location.reload();
            }}
            className="btn-ink px-3 py-1 text-red"
          >
            Sign out
          </button>
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
