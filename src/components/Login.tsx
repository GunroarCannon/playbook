"use client";

import { useState } from "react";
import { Atom, Compass, Crane, Flask, Gear, Pendulum, SetSquare, SketchDefs } from "./Doodles";

export default function Login() {
  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");
  const [byo, setByo] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          passcode,
          ...(byo ? { memwalAccountId: accountId, memwalKey: key } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign-in failed");
      location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <main className="graph-paper min-h-full flex items-center justify-center p-4 relative overflow-hidden">
      <SketchDefs />
      {/* margin doodles */}
      <div className="pointer-events-none absolute inset-0 text-navy opacity-[0.55] wobble hidden md:block" aria-hidden>
        <Gear size={150} className="absolute -left-6 top-10" />
        <Flask size={96} className="absolute left-24 bottom-16" />
        <Atom size={110} className="absolute right-16 top-14" />
        <Crane size={170} className="absolute right-8 bottom-6" />
        <Pendulum size={100} className="absolute left-[18%] top-[38%]" />
        <SetSquare size={90} className="absolute right-[22%] bottom-[40%]" />
        <Compass size={80} className="absolute left-[40%] bottom-4" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-5">
          <h1 className="hand text-5xl tracking-wide">Playbook</h1>
          <p className="text-ink-2 mt-2 text-[15px]">
            A what-if workbench that <span className="hand text-lg text-navy">remembers you</span>. Your limits, your best
            builds and everything that broke, saved to Walrus Memory between sessions.
          </p>
        </div>

        <form onSubmit={submit} className="sheet ink-box p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="hand text-2xl">Sign in or sign up</h2>
            <span className="stamp text-[12px] text-blue">NO EMAIL</span>
          </div>
          <label className="flex flex-col gap-1">
            <span className="hand text-sm text-ink-2">Username</span>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. amara"
              autoComplete="username"
              className="mono bg-transparent border-b-[1.5px] border-ink/60 focus:border-blue outline-none py-1.5 text-[15px]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="hand text-sm text-ink-2">Passcode</span>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="4+ characters"
              autoComplete="current-password"
              className="mono bg-transparent border-b-[1.5px] border-ink/60 focus:border-blue outline-none py-1.5 text-[15px]"
            />
          </label>
          <p className="text-[13px] text-ink-3 -mt-1">A new username creates your account. Use the same one on any device and your memory follows you.</p>

          <details open={byo} onToggle={(e) => setByo((e.target as HTMLDetailsElement).open)} className="text-[14px]">
            <summary className="hand cursor-pointer text-navy">Use my own Walrus Memory account (optional)</summary>
            <div className="flex flex-col gap-3 mt-3 pl-3 border-l-2 border-dashed border-ink/30">
              <p className="text-[13px] text-ink-2">
                Memories go to <em>your</em> account instead of the shared Playbook one. Get an account ID and delegate key at{" "}
                <a className="underline text-blue" href="https://memory.walrus.xyz" target="_blank" rel="noreferrer">
                  memory.walrus.xyz
                </a>
                . You can also add these later in settings.
              </p>
              <input
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="Account ID (0x…)"
                className="mono text-[13px] bg-transparent border-b-[1.5px] border-ink/50 focus:border-blue outline-none py-1"
              />
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Delegate private key"
                className="mono text-[13px] bg-transparent border-b-[1.5px] border-ink/50 focus:border-blue outline-none py-1"
              />
            </div>
          </details>

          {error && <p className="text-red text-sm hand">{error}</p>}
          <button disabled={busy || !username || passcode.length < 4} className="btn-ink py-2 text-lg mt-1">
            {busy ? "Opening your notebook…" : "Open my notebook →"}
          </button>
        </form>

        <p className="text-center text-[12px] text-ink-3 mt-4">
          Open source · built for Walrus Session 8 &ldquo;Chatbots That Remember&rdquo;
        </p>
      </div>
    </main>
  );
}
