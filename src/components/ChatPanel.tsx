"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import type { ParamValue } from "@/lib/sims";
import { BootstrapCard, Markdown, RecallLine, TestCard, ToolCard } from "./MessageParts";

export type ChatBody = { simId: string; dials: Record<string, ParamValue>; memoryOn: boolean };
export type ChatApi = { send: (text: string, body: ChatBody) => void; busy: () => boolean };

type Props = {
  threadId: string;
  initialMessages: UIMessage[];
  simId: string;
  dials: Record<string, ParamValue>;
  memoryOn: boolean;
  username: string;
  suggestions: string[];
  registerApi: (api: ChatApi | null) => void;
  onSetDials: (o: { simId: string; params: Record<string, ParamValue>; runTest: boolean }) => void;
  onSwitchBench: (simId: string) => void;
  /** The AI built a new bench or changed the current one: load its code and open it. */
  onBenchChanged: (simId: string) => void;
  onMemoryChanged: () => void;
  onFinished: () => void;
};

export default function ChatPanel(props: Props) {
  const [transport] = useState(() => new DefaultChatTransport({ api: "/api/chat" }));
  const bodyNow = () => ({ simId: props.simId, dials: props.dials, memoryOn: props.memoryOn });

  const { messages, sendMessage, status, error, stop } = useChat({
    id: props.threadId,
    messages: props.initialMessages,
    transport,
    onFinish: () => props.onFinished(),
  });

  // Apply tool side-effects (dials, bench switches) exactly once per tool call.
  // Tool calls that were already in the thread when it was opened are not re-applied.
  const [applied] = useState(() => {
    const s = new Set<string>();
    for (const m of props.initialMessages) for (const p of m.parts as { toolCallId?: string }[]) if (p.toolCallId) s.add(p.toolCallId);
    return s;
  });
  useEffect(() => {
    for (const m of messages) {
      for (const raw of m.parts) {
        const p = raw as { type: string; state?: string; toolCallId?: string; output?: Record<string, unknown> };
        if (!p.toolCallId || p.state !== "output-available" || applied.has(p.toolCallId)) continue;
        applied.add(p.toolCallId);
        if (p.type === "tool-set_dials" && p.output) {
          props.onSetDials({ simId: String(p.output.simId), params: (p.output.params ?? {}) as Record<string, ParamValue>, runTest: Boolean(p.output.runTest) });
        } else if (p.type === "tool-switch_bench" && p.output) {
          props.onSwitchBench(String(p.output.simId));
        } else if ((p.type === "tool-build_bench" && p.output?.built) || (p.type === "tool-revise_bench" && p.output?.revised)) {
          props.onBenchChanged(String(p.output.simId));
          props.onMemoryChanged();
        } else if (p.type === "tool-remember") {
          props.onMemoryChanged();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const busy = status === "submitted" || status === "streaming";
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
  useEffect(() => {
    props.registerApi({ send: (text, body) => sendMessage({ text }, { body }), busy: () => busyRef.current });
    return () => props.registerApi(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendMessage]);

  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  function submit(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t }, { body: bodyNow() });
    setInput("");
  }

  const onlyGreeting = messages.length <= 1;

  return (
    <section className="flex flex-col h-full min-h-0">
      <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {messages.map((m) => (
          <Message key={m.id} m={m} username={props.username} />
        ))}
        {status === "submitted" && <div className="hand text-ink-3 pulse">Playbook is thinking…</div>}
        {error && (
          <div className="ink-box-soft border-red text-red px-3 py-2 text-[13px] mono">
            {error.message || "Something went wrong."} <button className="underline ml-2" onClick={() => location.reload()}>reload</button>
          </div>
        )}
        {onlyGreeting && props.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {props.suggestions.map((s) => (
              <button key={s} onClick={() => submit(s)} className="hand text-[13.5px] px-2.5 py-1 border-[1.5px] border-dashed border-ink/40 rounded hover:border-ink hover:bg-sheet-2 text-left">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        data-tour="chat"
        className="m-3 mt-0 sheet ink-box flex items-end gap-2 p-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(input);
            }
          }}
          rows={Math.min(5, Math.max(1, input.split("\n").length))}
          placeholder={props.memoryOn ? "Tell Playbook what you're building, your limits, or ask “what if…”" : "Memory is off: I won't remember any of this"}
          className="flex-1 resize-none bg-transparent outline-none text-[15px] px-2 py-1.5 placeholder:text-ink-3"
        />
        {busy ? (
          <button type="button" onClick={stop} className="btn-ink px-3 py-1.5 text-[15px]">
            stop
          </button>
        ) : (
          <button disabled={!input.trim()} className="btn-ink px-3 py-1.5 text-[15px]">
            send ↵
          </button>
        )}
      </form>
    </section>
  );
}

function Message({ m, username }: { m: UIMessage; username: string }) {
  if (m.role === "user") {
    const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    if (text.startsWith("[test]")) return <div className="self-start"><TestCard text={text} /></div>;
    return (
      <div className="self-end max-w-[85%] flex flex-col items-end">
        <span className="hand text-[12px] text-ink-3 mb-0.5">{username}</span>
        <div className="bg-note border border-ink/25 shadow-[2px_2px_0_var(--shadow)] rounded-[2px] px-3 py-2 text-[15px] whitespace-pre-wrap rotate-[0.3deg]">{text}</div>
      </div>
    );
  }
  return (
    <div className="self-start max-w-[95%] w-full">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="hand text-[12px] text-navy">Playbook</span>
      </div>
      {m.parts.map((part, i) => {
        if (part.type === "text") return part.text.trim() ? <Markdown key={i} text={part.text} /> : null;
        if (part.type === "data-bootstrap") return <BootstrapCard key={i} data={part.data as never} />;
        if (part.type === "data-memory") return <RecallLine key={i} data={part.data as never} />;
        if (part.type.startsWith("tool-")) return <ToolCard key={i} part={part as never} />;
        return null;
      })}
    </div>
  );
}
