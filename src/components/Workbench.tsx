"use client";

import { useEffect, useRef, useState } from "react";
import type { HostToSim, SimMetrics, SimResult, SimToHost } from "@/lib/protocol";
import { defaultParams, type ParamValue, type SimDef, type SimPreset } from "@/lib/sims";
import { Control, RunButton, StressGauge } from "./Controls";
import Icon from "./Icon";

type Props = {
  sim: SimDef;
  /** Override for AI-generated sims: full HTML document, rendered via srcDoc. */
  srcDoc?: string;
  dials: Record<string, ParamValue>;
  onDial: (key: string, value: ParamValue) => void;
  onReset: () => void;
  /** One-click scenario: sets every dial (unlisted ones go back to their defaults). */
  onPreset: (preset: SimPreset) => void;
  flashKeys: string[];
  theme: "light" | "dark";
  runSignal: number;
  onResult: (r: SimResult, params: Record<string, ParamValue>) => void;
  /** AI-built sims: report crashes / hangs so the app can ask the AI to repair the code. */
  onSimError?: (message: string) => void;
  /** Shown over the drawing while an AI-built sim is being written or repaired. */
  busyNote?: string | null;
};

export default function Workbench({ sim, srcDoc, dials, onDial, onReset, onPreset, flashKeys, theme, runSignal, onResult, onSimError, busyNote }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [metrics, setMetrics] = useState<SimMetrics | null>(null);
  const [testing, setTesting] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const dialsRef = useRef(dials);
  const onResultRef = useRef(onResult);
  const onSimErrorRef = useRef(onSimError);
  useEffect(() => {
    dialsRef.current = dials;
    onResultRef.current = onResult;
    onSimErrorRef.current = onSimError;
  }, [dials, onResult, onSimError]);
  const reportError = (message: string) => {
    setSimError(message);
    setTesting(false);
    onSimErrorRef.current?.(message);
  };

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
      } else if (m.type === "SIM_ERROR") reportError(String(m.message).slice(0, 400));
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) post({ type: "UPDATE_PARAMS", params: dials });
  }, [dials, ready]);

  // Watchdogs (only matter for AI-written sims, but cheap for all): never started / test never finished.
  useEffect(() => {
    if (ready || !srcDoc) return;
    const t = setTimeout(() => reportError("the sim never started: Bench.init(...) did not run within 8 seconds"), 8000);
    return () => clearTimeout(t);
  }, [ready, srcDoc]);
  useEffect(() => {
    if (!testing) return;
    const t = setTimeout(() => reportError("RUN TEST never finished: Bench.result(...) was not called within 25 seconds"), 25000);
    return () => clearTimeout(t);
  }, [testing]);

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

  // the preset whose dials are all exactly what's set now (turning any dial un-picks it)
  const active = sim.presets?.find((pr) => {
    const want = { ...defaultParams(sim.params), ...pr.params };
    return sim.params.every((p) => (dials[p.key] ?? p.default) === want[p.key]);
  });

  const visible = sim.params.filter((p) => !p.showIf || dials[p.showIf.key] === p.showIf.equals);
  const dialsList = visible.filter((p) => p.control === "dial");
  const others = visible.filter((p) => p.control !== "dial");

  return (
    <section className="flex flex-col h-full min-h-0">
      {/* drawing sheet */}
      <div data-tour="bench" className="relative flex-1 min-h-[200px] m-2 sm:m-3 mb-2 ink-box overflow-hidden bg-sheet">
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
        {simError && !busyNote && (
          <div className="absolute bottom-2 left-2 right-2 sheet ink-box-soft p-2 text-[13px] text-red mono">sim error: {simError}</div>
        )}
        {busyNote && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-sheet/85 text-center px-6">
            <span className="hand text-[18px] pulse">{busyNote}</span>
          </div>
        )}
        <div className="hidden sm:block absolute top-2 right-2 hand text-[12px] px-2 py-0.5 sheet ink-box-soft text-ink-2">
          {sim.custom && <span className="text-navy">✦ AI-built · </span>}
          {sim.name}
        </div>
      </div>

      {/* tactile control deck */}
      <div data-tour="controls" className="mx-2 sm:mx-3 mb-2 sm:mb-3 sheet ink-box flex max-h-[46%] min-h-[150px]">
        <div className="flex-1 min-w-0 overflow-y-auto px-3 pt-2 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="hand text-[15px]">Control panel</span>
            <button onClick={onReset} className="hand text-[13px] text-ink-3 hover:text-ink underline decoration-dotted">
              reset to defaults
            </button>
          </div>
          {!!sim.presets?.length && (
            <div data-tour="presets" className="mb-2.5">
              <div className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain -mx-1 px-1 pb-1" role="group" aria-label="Ready-made scenarios">
                <span className="hand text-[13px] text-ink-3 shrink-0 mr-0.5">Try a scenario:</span>
                {sim.presets.map((pr) => {
                  const on = pr.id === active?.id;
                  return (
                    <button
                      key={pr.id}
                      onClick={() => onPreset(pr)}
                      title={pr.note}
                      aria-pressed={on}
                      className={`shrink-0 flex items-center gap-1.5 pl-2 pr-2.5 py-[3px] rounded-full text-[12.5px] whitespace-nowrap transition-colors ${
                        on ? "bg-navy text-sheet border-[1.5px] border-navy" : "border-[1.25px] border-dashed border-ink/45 text-ink-2 hover:border-ink hover:text-ink hover:bg-note"
                      }`}
                    >
                      <Icon name={pr.icon} className={on ? "" : "text-navy"} />
                      {pr.label}
                    </button>
                  );
                })}
              </div>
              {active && (
                <p className="text-[12.5px] text-ink-2 leading-snug mt-0.5 flex gap-1.5">
                  <span className="hand text-navy shrink-0">↳</span>
                  <span>{active.note} Press the red button to test it.</span>
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-3 items-start">
            {dialsList.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dialsList.map((p) => (
                  <Control key={p.key} spec={p} value={dials[p.key] ?? p.default} onChange={(v) => onDial(p.key, v)} flash={flashKeys.includes(p.key)} />
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-3 flex-1 min-w-[190px]">
              {others.map((p) => (
                <Control key={p.key} spec={p} value={dials[p.key] ?? p.default} onChange={(v) => onDial(p.key, v)} flash={flashKeys.includes(p.key)} />
              ))}
            </div>
          </div>
        </div>
        <div data-tour="run" className="w-[112px] sm:w-[150px] shrink-0 border-l border-dashed border-ink/30 flex flex-col items-center justify-center gap-2 py-2">
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
