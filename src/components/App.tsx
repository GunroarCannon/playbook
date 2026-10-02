"use client";

import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SimResult } from "@/lib/protocol";
import { SIMS, defaultParams, getSim, sanitizeParams, type ParamValue } from "@/lib/sims";
import ChatPanel, { type ChatApi, type ChatBody } from "./ChatPanel";
import { Atom, BenchIcon, Compass, Flask, Gear, SetSquare, SketchDefs } from "./Doodles";
import { KindChip } from "./MessageParts";
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
};

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

function dialsFromMessages(simId: string, messages: UIMessage[]) {
  const sim = getSim(simId) ?? SIMS[0];
  let dials = defaultParams(sim.params);
  let current = sim.id;
  for (const m of messages)
    for (const raw of m.parts) {
      const p = raw as { type: string; data?: { preset?: { params?: Record<string, ParamValue> } }; output?: { simId?: string; params?: Record<string, ParamValue> } };
      if (p.type === "data-bootstrap" && p.data?.preset?.params) dials = { ...dials, ...p.data.preset.params };
      if (p.type === "tool-switch_bench" && p.output?.simId && getSim(p.output.simId)) {
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
  const chatApi = useRef<ChatApi | null>(null);
  const pendingTests = useRef<{ text: string; body: ChatBody }[]>([]);
  const booted = useRef(false);

  const sim = getSim(simId) ?? SIMS[0];

  // ---------------------------------------------------------------- boot
  useEffect(() => {
    if (booted.current) return; // dev StrictMode runs effects twice
    booted.current = true;
    setMemoryOn(readLS("pb-memory", "on") === "on");
    setTheme(readLS("pb-theme", "light") === "dark" ? "dark" : "light");
    (async () => {
      const [meRes, thRes] = await Promise.all([fetch("/api/auth/me").then((r) => r.json()), fetch("/api/threads").then((r) => r.json())]);
      if (!meRes.user) return location.reload();
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
        <button className="lg:hidden btn-ink px-2 py-0.5" onClick={() => setDrawer(!drawer)} aria-label="Menu">
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
            <button onClick={() => setPicker(true)} className="btn-ink w-full py-1.5 text-[17px]">
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
              <button key={t} onClick={() => setMobileTab(t)} className={`flex-1 hand py-1.5 text-[15px] ${mobileTab === t ? "border-b-[3px] border-navy" : "text-ink-3"}`}>
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
                suggestions={SUGGESTIONS[simId] ?? []}
                registerApi={(api) => {
                  chatApi.current = api;
                  if (api) flushTests();
                }}
                onSetDials={applyDials}
                onSwitchBench={switchBench}
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
            <Workbench
              key={sim.id}
              sim={sim}
              dials={dials}
              onDial={onDial}
              onReset={() => setDials(defaultParams(sim.params))}
              flashKeys={flashKeys}
              theme={theme}
              runSignal={runSignal}
              onResult={onResult}
            />
          </div>
        </main>
      </div>

      {activeThread && !activeThread.memory_on && memoryOn && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 hand text-[13px] sheet ink-box-soft px-3 py-1">
          This sheet was started in amnesia mode.
        </div>
      )}

      {picker && <BenchPicker onPick={newSheet} onClose={() => setPicker(false)} canClose={threads.length > 0} memoryOn={memoryOn} />}
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

function BenchPicker({ onPick, onClose, canClose, memoryOn }: { onPick: (id: string) => void; onClose: () => void; canClose: boolean; memoryOn: boolean }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/25 p-4" onClick={() => canClose && onClose()}>
      <div className="sheet ink-box w-full max-w-2xl p-5 max-h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="hand text-3xl">Pick a workbench</h2>
          {canClose && (
            <button onClick={onClose} className="hand text-ink-3 hover:text-ink text-lg">
              ✕
            </button>
          )}
        </div>
        <p className="text-ink-2 text-[14px] mb-4">
          {memoryOn
            ? "Memory is ON: I'll recall your limits, best builds and past failures for this bench, and set the dials to your best result."
            : "Memory is OFF: you'll get a blank bench and a bot that doesn't know you."}
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {SIMS.map((s) => (
            <button key={s.id} onClick={() => onPick(s.id)} className="btn-ink text-left p-3 flex gap-3 items-start font-sans">
              <BenchIcon simId={s.id} size={54} className="text-navy shrink-0 wobble" />
              <span>
                <span className="hand text-[18px] block">{s.name}</span>
                <span className="text-[13px] text-ink-2 font-sans">{s.tagline}</span>
              </span>
            </button>
          ))}
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
