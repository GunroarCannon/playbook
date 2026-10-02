"use client";

import { useEffect, useRef, useState } from "react";
import type { HostToSim, SimMetrics, SimResult, SimToHost } from "@/lib/protocol";
import type { ParamValue, SimDef } from "@/lib/sims";
import { Control, RunButton, StressGauge } from "./Controls";

type Props = {
  sim: SimDef;
  /** Override for AI-generated sims: full HTML document, rendered via srcDoc. */
  srcDoc?: string;
  dials: Record<string, ParamValue>;
  onDial: (key: string, value: ParamValue) => void;
  onReset: () => void;
  flashKeys: string[];
  theme: "light" | "dark";
  runSignal: number;
  onResult: (r: SimResult, params: Record<string, ParamValue>) => void;
};

export default function Workbench({ sim, srcDoc, dials, onDial, onReset, flashKeys, theme, runSignal, onResult }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [metrics, setMetrics] = useState<SimMetrics | null>(null);
  const [testing, setTesting] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const dialsRef = useRef(dials);
  const onResultRef = useRef(onResult);
  useEffect(() => {
    dialsRef.current = dials;
    onResultRef.current = onResult;
  }, [dials, onResult]);

  const post = (msg: HostToSim) => frame.current?.contentWindow?.postMessage(msg, "*");

  // Messages from the sandboxed sim
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.source !== frame.current?.contentWindow) return;
      const m = e.data as SimToHost;
      if (!m || typeof m !== "object") return;
      if (m.type === "SIM_READY") {
        setReady(true);
        setSimError(null);
        post({ type: "SET_THEME", theme });
        post({ type: "UPDATE_PARAMS", params: dialsRef.current });
      } else if (m.type === "SIM_METRICS") setMetrics(m.payload);
      else if (m.type === "SIM_RESULT") {
        setTesting(false);
        onResultRef.current(m.payload, dialsRef.current);
      } else if (m.type === "SIM_ERROR") {
        setSimError(m.message);
        setTesting(false);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) post({ type: "UPDATE_PARAMS", params: dials });
  }, [dials, ready]);

  useEffect(() => {
    if (ready) post({ type: "SET_THEME", theme });
  }, [theme, ready]);

  // external "run test" requests (e.g. the model set dials with runTest=true)
  const lastRun = useRef(runSignal);
  useEffect(() => {
    if (runSignal !== lastRun.current && ready) {
      lastRun.current = runSignal;
      // let the params land first
      setTimeout(() => {
        setTesting(true);
        post({ type: "RUN_TEST" });
      }, 350);
    }
  }, [runSignal, ready]);

  const visible = sim.params.filter((p) => !p.showIf || dials[p.showIf.key] === p.showIf.equals);
  const dialsList = visible.filter((p) => p.control === "dial");
  const others = visible.filter((p) => p.control !== "dial");

  return (
    <section className="flex flex-col h-full min-h-0">
      {/* drawing sheet */}
      <div className="relative flex-1 min-h-[220px] m-3 mb-2 ink-box overflow-hidden bg-sheet">
        <iframe
          ref={frame}
          key={sim.id + (srcDoc ? ":custom" : "")}
          title={`${sim.name} simulation`}
          src={srcDoc ? undefined : `${sim.src}?theme=${theme}`}
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          className="absolute inset-0 w-full h-full"
        />
        {!ready && !simError && (
          <div className="absolute inset-0 flex items-center justify-center hand text-ink-3 pulse">unrolling the drawing…</div>
        )}
        {simError && (
          <div className="absolute bottom-2 left-2 right-2 sheet ink-box-soft p-2 text-[13px] text-red mono">sim error: {simError}</div>
        )}
        <div className="absolute top-2 right-2 hand text-[12px] px-2 py-0.5 sheet ink-box-soft text-ink-2">{sim.name}</div>
      </div>

      {/* tactile control deck */}
      <div className="mx-3 mb-3 sheet ink-box flex max-h-[46%] min-h-[150px]">
        <div className="flex-1 min-w-0 overflow-y-auto px-3 pt-2 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="hand text-[15px]">Control panel</span>
            <button onClick={onReset} className="hand text-[13px] text-ink-3 hover:text-ink underline decoration-dotted">
              reset to defaults
            </button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-3 items-start">
            {dialsList.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dialsList.map((p) => (
                  <Control key={p.key} spec={p} value={dials[p.key] ?? p.default} onChange={(v) => onDial(p.key, v)} flash={flashKeys.includes(p.key)} />
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-3 flex-1 min-w-[240px]">
              {others.map((p) => (
                <Control key={p.key} spec={p} value={dials[p.key] ?? p.default} onChange={(v) => onDial(p.key, v)} flash={flashKeys.includes(p.key)} />
              ))}
            </div>
          </div>
        </div>
        <div className="w-[150px] shrink-0 border-l border-dashed border-ink/30 flex flex-col items-center justify-center gap-2 py-2">
          <StressGauge ratio={metrics?.stressRatio ?? 0} label={metrics?.label} />
          <RunButton
            running={testing}
            disabled={!ready || testing}
            onClick={() => {
              setTesting(true);
              post({ type: "RUN_TEST" });
            }}
          />
        </div>
      </div>
    </section>
  );
}
