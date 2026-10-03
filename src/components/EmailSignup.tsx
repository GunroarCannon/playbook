"use client";

import { useState } from "react";
import Icon from "./Icon";

/** Join the Playbook email list (stored in the app database, see /api/subscribe). */
export default function EmailSignup({ source, compact }: { source: "landing" | "settings"; compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "already">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setErr(null);
    try {
      const r = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      }).then((r) => r.json());
      if (r.error) throw new Error(r.error);
      setState(r.added ? "done" : "already");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setState("idle");
    }
  }

  if (state === "done" || state === "already")
    return (
      <p className="hand text-[16px] text-green flex items-center gap-2">
        <Icon name="circle-check" /> {state === "done" ? "You're on the list. Thanks!" : "You're already on the list."}
      </p>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <div className={`flex gap-2 ${compact ? "" : "flex-col sm:flex-row"}`}>
        <label className="flex-1 flex items-center gap-2 border-b-[1.5px] border-ink/60 focus-within:border-blue min-w-0">
          <Icon name="envelope" className="text-ink-3" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="flex-1 min-w-0 bg-transparent outline-none py-1.5 text-[15px]"
          />
        </label>
        <button disabled={state === "busy" || !email.includes("@")} className="btn-ink px-3 py-1 text-[15px] shrink-0">
          {state === "busy" ? "adding…" : "Keep me posted"}
        </button>
      </div>
      {err && <p className="text-red text-[13px]">{err}</p>}
      <p className="text-[12px] text-ink-3">Occasional updates on new benches and features. No spam.</p>
    </form>
  );
}
