"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { getSim } from "@/lib/sims";

export type MemItem = { kind: string; simId: string | null; sentence: string; relevance?: number };

const KIND_STYLE: Record<string, string> = {
  CONSTRAINT: "text-red border-red",
  GOAL: "text-navy border-navy",
  PREF: "text-navy border-navy",
  PROFILE: "text-navy border-navy",
  WIN: "text-green border-green",
  FAILURE: "text-red border-red",
  INSIGHT: "text-amber border-amber",
  SIM: "text-blue border-blue",
  NOTE: "text-ink-2 border-ink-2",
};

export function KindChip({ kind }: { kind: string }) {
  return (
    <span className={`mono text-[10px] leading-none px-1 py-[3px] border rounded-[2px] tracking-wider shrink-0 ${KIND_STYLE[kind] ?? KIND_STYLE.NOTE}`}>
      {kind}
    </span>
  );
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-ink text-[15px] leading-relaxed">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}

/** Opening card of a sheet: what Walrus Memory gave us (or amnesia mode). */
export function BootstrapCard({ data }: { data: { memoryOn: boolean; ms?: number; memories: MemItem[]; preset: { sentence: string } | null; errors?: string[] } }) {
  const [open, setOpen] = useState(false);
  if (!data.memoryOn)
    return (
      <div className="ink-box-soft border-dashed bg-sheet-2 px-3 py-2 mb-2 flex items-center gap-3">
        <span className="stamp text-[13px] text-ink-3">AMNESIA MODE</span>
        <span className="text-[13px] text-ink-2">Walrus Memory is switched off. The bot starts from zero, like most chatbots.</span>
      </div>
    );
  return (
    <div className="ink-box-soft bg-blue-soft/40 px-3 py-2 mb-2">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 text-left">
        <span className="stamp text-[13px] text-blue">RECALLED</span>
        <span className="text-[13px] text-ink-2 flex-1">
          {data.memories.length
            ? `${data.memories.length} memories from Walrus Memory${data.ms ? ` · ${(data.ms / 1000).toFixed(1)}s` : ""}`
            : "No memories for this bench yet. Anything you tell me gets saved."}
        </span>
        {data.memories.length > 0 && <span className="hand text-[13px] text-ink-3">{open ? "hide" : "show"}</span>}
      </button>
      {open && data.memories.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {data.memories.map((m, i) => (
            <li key={i} className="flex gap-2 items-start text-[13px]">
              <KindChip kind={m.kind} />
              <span className="text-ink-2">{m.sentence}</span>
            </li>
          ))}
        </ul>
      )}
      {data.preset && (
        <p className="mt-2 text-[13px] hand text-navy">↳ Dials restored from your best run: {data.preset.sentence}</p>
      )}
      {data.errors && data.errors.length > 0 && <p className="mt-1 text-[12px] text-amber mono">some recalls failed: {data.errors[0].slice(0, 140)}</p>}
    </div>
  );
}

/** Per-turn recall indicator. */
export function RecallLine({ data }: { data: { status: string; ms?: number; error?: string | null; items?: MemItem[] } }) {
  const [open, setOpen] = useState(false);
  if (data.status === "recalling")
    return <div className="hand text-[13px] text-blue pulse mb-1">searching Walrus Memory…</div>;
  if (data.status === "error") return <div className="mono text-[12px] text-amber mb-1">memory recall failed: {data.error}</div>;
  const n = data.items?.length ?? 0;
  return (
    <div className="mb-1">
      <button onClick={() => setOpen(!open)} className="hand text-[13px] text-blue hover:underline decoration-dotted">
        ⟲ recalled {n} memor{n === 1 ? "y" : "ies"}
        {data.ms ? ` in ${(data.ms / 1000).toFixed(1)}s` : ""} {n > 0 && (open ? "▴" : "▾")}
      </button>
      {open && n > 0 && (
        <ul className="mt-1 mb-2 pl-3 border-l-2 border-dashed border-blue/40 flex flex-col gap-1">
          {data.items!.map((m, i) => (
            <li key={i} className="flex gap-2 items-start text-[12.5px]">
              <KindChip kind={m.kind} />
              <span className="text-ink-2">{m.sentence}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ToolPart = { type: string; state: string; input?: Record<string, unknown>; output?: Record<string, unknown>; errorText?: string; toolCallId: string };

export function ToolCard({ part }: { part: ToolPart }) {
  const name = part.type.replace(/^tool-/, "");
  const done = part.state === "output-available";
  const err = part.state === "output-error";
  const out = part.output ?? {};

  if (name === "set_dials") {
    const params = (out.params ?? part.input?.params ?? {}) as Record<string, unknown>;
    const sim = getSim(String(out.simId ?? ""));
    return (
      <div className="my-1.5 ink-box-soft bg-sheet-2 px-3 py-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="hand text-[14px] text-navy">⚙ dials set</span>
          {Boolean(out.runTest) && <span className="mono text-[11px] text-red">→ running test</span>}
          {!done && !err && <span className="hand text-[12px] text-ink-3 pulse">…</span>}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {Object.entries(params).map(([k, v]) => {
            const spec = sim?.params.find((p) => p.key === k);
            return (
              <span key={k} className="mono text-[12px]">
                <span className="text-ink-3">{spec?.label ?? k}</span> <span className="text-ink">{String(v)}</span>
                {spec?.unit && <span className="text-ink-3">{spec.unit}</span>}
              </span>
            );
          })}
        </div>
        {typeof out.reason === "string" && out.reason && <p className="text-[12.5px] text-ink-2 mt-1 italic">{out.reason}</p>}
        {Array.isArray(out.rejected) && out.rejected.length > 0 && (
          <p className="mono text-[11px] text-amber mt-1">ignored unknown dials: {out.rejected.join(", ")}</p>
        )}
      </div>
    );
  }
  if (name === "remember") {
    const saved = done && out.saved;
    return (
      <div className="my-1.5 flex items-start gap-2 bg-note px-3 py-2 rounded-[2px] shadow-[2px_2px_0_var(--shadow)] -rotate-[0.4deg] border border-ink/20">
        <span className="hand text-[14px] shrink-0">📌</span>
        <div className="text-[13px]">
          <span className="hand text-[14px] mr-1">{saved ? "Saved to Walrus Memory:" : err || (done && !out.saved) ? "Couldn't save:" : "Saving…"}</span>
          <span className="text-ink-2">{String(part.input?.sentence ?? "")}</span>
          {done && !out.saved && <span className="block mono text-[11px] text-red">{String(out.error ?? "")}</span>}
        </div>
      </div>
    );
  }
  if (name === "recall") {
    const results = (out.results ?? []) as string[];
    return (
      <div className="my-1 hand text-[13px] text-blue">
        ⟲ looked up &ldquo;{String(part.input?.query ?? "")}&rdquo; in memory{done ? `: ${results.length} found` : "…"}
      </div>
    );
  }
  if (name === "switch_bench") {
    return <div className="my-1 hand text-[14px] text-navy">↪ moved to the {String(out.name ?? part.input?.simId ?? "")}</div>;
  }
  if (name === "build_bench" || name === "revise_bench") {
    const ok = done && Boolean(out.built || out.revised);
    const failed = err || (done && !ok);
    return (
      <div className="my-1.5 ink-box-soft bg-sheet-2 px-3 py-2">
        <div className="hand text-[14px] text-navy flex items-center gap-2">
          <span>✦</span>
          {ok ? (
            <span>
              {name === "build_bench" ? "Built a new bench:" : "Updated the bench:"} <b className="font-normal underline decoration-wavy decoration-navy/40">{String(out.name ?? "")}</b>
            </span>
          ) : failed ? (
            <span className="text-red">Couldn&apos;t {name === "build_bench" ? "build" : "update"} the bench</span>
          ) : (
            <span className="pulse">{name === "build_bench" ? "The AI is drafting a new bench… (20–40 s)" : "Rewiring the bench…"}</span>
          )}
        </div>
        {!done && !err && typeof part.input?.request === "string" && <p className="text-[12.5px] text-ink-2 mt-1 italic">{part.input.request}</p>}
        {ok && typeof out.tagline === "string" && <p className="text-[12.5px] text-ink-2 mt-0.5">{out.tagline}</p>}
        {failed && <p className="mono text-[11px] text-red mt-1">{String(out.error ?? part.errorText ?? "")}</p>}
      </div>
    );
  }
  return (
    <div className="my-1 mono text-[12px] text-ink-3">
      {name} {err ? `failed: ${part.errorText}` : done ? "done" : "…"}
    </div>
  );
}

/** "[test] {...json}" messages are written by the app after a bench run. */
export function TestCard({ text }: { text: string }) {
  let data: { passed?: boolean; summary?: string; failureReason?: string; memory?: string } = {};
  try {
    data = JSON.parse(text.replace(/^\[test\]\s*/, ""));
  } catch {
    data = { summary: text.replace(/^\[test\]\s*/, "") };
  }
  return (
    <div className="ink-box-soft bg-sheet px-3 py-2 max-w-[92%]">
      <div className="flex items-center gap-2">
        <span className={`stamp text-[14px] ${data.passed ? "text-green" : "text-red"}`}>{data.passed ? "PASSED" : "FAILED"}</span>
        <span className="hand text-[13px] text-ink-3">bench test report</span>
      </div>
      <p className="text-[13.5px] mt-1.5">{data.summary}</p>
      {data.failureReason && <p className="text-[13px] text-red mt-0.5">Cause: {data.failureReason}</p>}
      {data.memory && <p className="hand text-[12.5px] text-blue mt-1">{data.memory}</p>}
    </div>
  );
}
