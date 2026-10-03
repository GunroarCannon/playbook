"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Crane, Gear, KnifeSwitch, SketchDefs, Walrus } from "./Doodles";
import EmailSignup from "./EmailSignup";
import Icon from "./Icon";
import { LoginCard } from "./Login";
import type { UiIconName } from "./ui-icons";

/**
 * The public landing page: what Playbook is, why Walrus Memory matters, what people use it for.
 * A dotted arrow runs down the page and follows the reader's scroll (down and back up), and the
 * diagrams and graphs drop into place as they come into view.
 */

const X_HANDLE = "therealgunroar";
const GITHUB_URL = "https://github.com/GunroarCannon/playbook";

export default function Landing({ signedIn }: { signedIn: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);

  // "fall into place": anything with .fall / .draw-in animates once when it scrolls into view
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.dataset.anim = "on";
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );
    el.querySelectorAll(".fall, .draw-in").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  const cta = signedIn ? { href: "/", label: "Back to my notebook" } : { href: "#start", label: "Open my notebook" };

  return (
    <div ref={root} className="graph-paper min-h-dvh overflow-x-hidden">
      <SketchDefs />
      {/* top bar */}
      <header className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
        <a href={signedIn ? "/" : "#top"} className="flex items-center gap-2">
          <Gear size={30} className="text-navy wobble" />
          <span className="hand text-2xl">Playbook</span>
        </a>
        <nav className="hidden md:flex items-center gap-5 ml-6 hand text-[15px] text-ink-2">
          <a href="#walrus" className="hover:text-ink">Walrus Memory</a>
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#uses" className="hover:text-ink">Use cases</a>
        </nav>
        <div className="flex-1" />
        <a href={cta.href} className="btn-ink px-3 py-1 text-[15px] whitespace-nowrap">
          {cta.label} →
        </a>
      </header>

      {/* hero */}
      <section id="top" className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-12 pb-10 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="fall hand text-navy text-[17px] flex items-center gap-2" style={v(0)}>
            <Walrus size={30} className="wobble" /> a chatbot that remembers, powered by Walrus Memory
          </p>
          <h1 className="fall hand text-[40px] sm:text-[54px] leading-[1.05] mt-3" style={v(80)}>
            Test your what-if ideas on a workbench that <span className="text-navy underline decoration-wavy decoration-2 underline-offset-8">remembers you</span>.
          </h1>
          <p className="fall text-[17px] text-ink-2 mt-5 max-w-[34rem]" style={v(160)}>
            Tell Playbook what you&rsquo;re building. It draws it on a workbench, you turn the dials and press the big red button.
            Pass or fail, it remembers, so next time you start where you left off.
          </p>
          <div className="fall flex flex-wrap gap-3 mt-7" style={v(240)}>
            <a href={cta.href} className="btn-ink px-5 py-2 text-[18px] bg-note">
              {cta.label} →
            </a>
            <a href="#walrus" className="hand text-[17px] px-3 py-2 underline decoration-dotted underline-offset-4 flex items-center gap-2">
              See how it works <Icon name="arrow-down" />
            </a>
          </div>
          <p className="fall text-[13px] text-ink-3 mt-4" style={v(300)}>
            Free. No email needed to sign up. Works on your phone.
          </p>
        </div>
        <HeroMock />
      </section>

      {/* everything the arrow runs through */}
      <div ref={wrap} className="relative">
        <ScrollArrow wrap={wrap} />

        {/* 1. Walrus */}
        <Row id="walrus" side="left" visual={<WalrusDiagram />}>
          <Mark />
          <Kicker icon="database">Memory that follows you</Kicker>
          <H2>
            Your notes live on <span className="text-navy">Walrus</span>
          </H2>
          <P>
            Most chatbots forget you the moment you close the tab. Playbook saves the important bits to{" "}
            <b>Walrus Memory</b>: your limits, your best results and everything that broke.
          </P>
          <P>
            The memories are stored on Walrus, a decentralized storage network, under your own namespace. Sign in on another phone or laptop and
            Playbook still knows you. Want them in your own name? Bring your own Walrus Memory account.
          </P>
        </Row>

        {/* 2. How it works */}
        <section id="how" className="relative max-w-6xl mx-auto pl-12 pr-4 sm:pr-6 md:px-6 py-14 sm:py-20">
          <div className="max-w-[30rem]">
            <Mark />
            <Kicker icon="list-check">How it works</Kicker>
            <H2>Four steps, plain words</H2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 md:mt-10">
            {STEPS.map((s, i) => (
              <div key={s.title} className="fall sheet ink-box p-4 flex flex-col gap-2" style={v(i * 140, i % 2 ? 4 : -4)}>
                <div className="flex items-center justify-between">
                  <span className={`w-11 h-11 rounded-full flex items-center justify-center ${s.red ? "bg-red text-white" : "bg-navy-soft text-navy"}`}>
                    <Icon name={s.icon} size={20} />
                  </span>
                  <span className="hand text-[28px] text-ink-3">{i + 1}</span>
                </div>
                <h3 className="hand text-[20px] leading-tight">{s.title}</h3>
                <p className="text-[14px] text-ink-2">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Graphs */}
        <Row id="see" side="right" visual={<Graphs />}>
          <Mark />
          <Kicker icon="chart-line">See it happen</Kicker>
          <H2>Watch it hold, run dry or snap</H2>
          <P>
            Every bench is a small, real simulation: forces in a bridge, people in a checkout line, a battery through the night, money against
            inflation. Turn a dial and the drawing and the numbers change straight away.
          </P>
          <P>When a test fails, Playbook tells you why in plain words, and what to try next.</P>
        </Row>

        {/* 4. Memory on vs off */}
        <Row id="compare" side="left" visual={<Compare />}>
          <Mark />
          <Kicker icon="power-off">The memory switch</Kicker>
          <H2>Flip it off and it&rsquo;s a stranger again</H2>
          <P>
            There&rsquo;s a switch at the top of the app. With Walrus Memory off, Playbook asks the same questions every time, like most chatbots. Turn
            it on and it greets you with your own numbers.
          </P>
          <P>Same bot, same model. The only difference is the memory.</P>
        </Row>

        {/* 5. Use cases */}
        <section id="uses" className="relative max-w-6xl mx-auto pl-12 pr-4 sm:pr-6 md:px-6 py-14 sm:py-20">
          <div className="max-w-[30rem]">
            <Mark />
            <Kicker icon="lightbulb">What people use it for</Kicker>
            <H2>From school projects to shop floors</H2>
            <P>Eight benches are ready to go. Each one remembers your settings and results separately.</P>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-8">
            {USES.map((u, i) => (
              <div key={u.title} className="fall sheet ink-box-soft p-3 sm:p-4 flex flex-col gap-1.5" style={v((i % 4) * 90, i % 2 ? 3 : -3)}>
                <Icon name={u.icon} size={26} className="text-navy" />
                <h3 className="hand text-[17px] leading-tight mt-1">{u.title}</h3>
                <p className="text-[13px] text-ink-2 leading-snug">{u.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 6. AI-built benches */}
        <Row id="invent" side="right" visual={<SpriteBox />}>
          <Mark />
          <Kicker icon="wand-magic-sparkles">Invent your own</Kicker>
          <H2>Describe it, and the AI builds the bench</H2>
          <P>
            Not on the list? Type something like &ldquo;a rainwater tank for my house: does it run dry in the dry season?&rdquo; In about half a
            minute the AI writes a working simulation with dials, checks that the numbers make sense, and opens it for you.
          </P>
          <P>
            It draws with a box of about 900 sketch sprites: people, elephants, lifts, stairs, coffee, cows, cars and more, so your idea looks like the
            real thing.
          </P>
        </Row>

        {/* 7. Start */}
        <section id="start" className="relative max-w-6xl mx-auto pl-12 pr-4 sm:pr-6 md:px-6 pt-14 sm:pt-20 pb-16">
          <div className="max-w-[30rem]">
            <Mark />
            <Kicker icon="hand-pointer">Try it</Kicker>
            <H2>Open your notebook</H2>
            <P>Pick a username and a passcode. That&rsquo;s your account. Use the same ones on any device and your memory comes with you.</P>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mt-8 max-w-4xl mx-auto items-start">
            <div className="fall" style={v(0, -2)}>
              {signedIn ? (
                <div className="sheet ink-box p-6 flex flex-col gap-3">
                  <h3 className="hand text-2xl">You&rsquo;re signed in</h3>
                  <Link href="/" className="btn-ink py-2 text-lg text-center">
                    Back to my notebook →
                  </Link>
                </div>
              ) : (
                <LoginCard />
              )}
            </div>
            <div className="fall flex flex-col gap-4" style={v(150, 2)}>
              <div className="sheet ink-box p-5">
                <h3 className="hand text-xl mb-2">Get updates</h3>
                <EmailSignup source="landing" />
              </div>
              <a href={`https://x.com/${X_HANDLE}`} target="_blank" rel="noreferrer" className="sheet ink-box-soft p-4 flex items-center gap-3 hover:bg-note group">
                <span className="w-10 h-10 rounded-full bg-ink text-sheet flex items-center justify-center shrink-0">
                  <Icon name="x-twitter" size={18} />
                </span>
                <span>
                  <span className="block text-[12px] text-ink-3">Built by</span>
                  <span className="hand text-[18px] group-hover:underline">@{X_HANDLE}</span>
                </span>
              </a>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-dashed border-ink/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-ink-3 items-center">
          <span className="flex items-center gap-2">
            <Walrus size={22} /> Built for Walrus Session 8: &ldquo;Chatbots That Remember&rdquo;
          </span>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-ink">
            <Icon name="github" /> Open source
          </a>
          <span>
            Icons:{" "}
            <a href="https://fontawesome.com" target="_blank" rel="noreferrer" className="underline">
              Font Awesome Free
            </a>{" "}
            (CC BY 4.0)
          </span>
        </div>
      </footer>
    </div>
  );
}

// ------------------------------------------------------------------ content

const STEPS: { icon: UiIconName; title: string; body: string; red?: boolean }[] = [
  { icon: "comments", title: "Say what you're working on", body: "“My bridge can only use 50 sticks.” Plain words, like texting a friend who's good at maths." },
  { icon: "sliders", title: "It sets up the bench", body: "Playbook picks the right simulation and turns the dials to match your numbers." },
  { icon: "power-off", title: "Press the big red button", body: "The test runs in front of you. Pass or fail, you get the reason and one thing to try next.", red: true },
  { icon: "brain", title: "It remembers", body: "Your limits, best result and failures go to Walrus Memory. Next time, it starts from there." },
];

const USES: { icon: UiIconName; title: string; body: string }[] = [
  { icon: "bridge", title: "School bridge contest", body: "Which popsicle-stick truss holds the most for the fewest sticks?" },
  { icon: "cash-register", title: "Shop checkout", body: "How many cashiers so nobody waits more than 3 minutes?" },
  { icon: "solar-panel", title: "Solar at home", body: "Will the battery last the night, or cut out at 2 a.m.?" },
  { icon: "graduation-cap", title: "Saving for school fees", body: "Will ₦60,000 a month get there in 3 years with 25% inflation?" },
  { icon: "rocket", title: "Bottle rocket", body: "How much water and pressure to reach 40 m?" },
  { icon: "car-side", title: "Stopping distance", body: "Could you stop in time on a wet road at 80 km/h?" },
  { icon: "virus", title: "Outbreak planning", body: "Do the hospital beds run out? When should distancing start?" },
  { icon: "baseball", title: "Throws and pendulums", body: "Best launch angle, air drag, or a pendulum on Mars." },
];

// ------------------------------------------------------------------ layout bits

const v = (delayMs: number, tilt = -5) => ({ "--d": `${delayMs}ms`, "--tilt": `${tilt}deg` }) as CSSProperties;

function Kicker({ icon, children }: { icon: UiIconName; children: ReactNode }) {
  return (
    <p className="fall hand text-[15px] text-navy uppercase tracking-wider inline-flex items-center gap-2" style={v(0, 0)}>
      <Icon name={icon} /> {children}
    </p>
  );
}

/** Where the scroll arrow passes through this section (a dot on the line). */
function Mark() {
  return <div data-node="" className="h-8" aria-hidden />;
}

function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="fall hand text-[30px] sm:text-[38px] leading-tight mt-2" style={v(60, -2)}>
      {children}
    </h2>
  );
}

function P({ children }: { children: ReactNode }) {
  return (
    <p className="fall text-[16px] sm:text-[17px] text-ink-2 mt-4 leading-relaxed" style={v(120, 0)}>
      {children}
    </p>
  );
}

/** A text column and a visual column, with an empty gutter in the middle for the arrow (desktop). */
function Row({ id, side, visual, children }: { id: string; side: "left" | "right"; visual: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="relative max-w-6xl mx-auto pl-12 pr-4 sm:pr-6 md:px-6 py-14 sm:py-20 grid md:grid-cols-[1fr_88px_1fr] gap-y-8 items-center">
      <div className={side === "left" ? "md:col-start-1 md:row-start-1" : "md:col-start-3 md:row-start-1"}>{children}</div>
      <div className={side === "left" ? "md:col-start-3 md:row-start-1" : "md:col-start-1 md:row-start-1"}>{visual}</div>
    </section>
  );
}

// ------------------------------------------------------------------ the scroll arrow

type Pt = { x: number; y: number };

/**
 * A dotted line that runs through every section marker (elements with data-node). It draws itself down to just
 * below the middle of the screen as you scroll, retracts when you scroll back up, and its arrowhead turns to
 * point the way you're going.
 */
function ScrollArrow({ wrap }: { wrap: React.RefObject<HTMLDivElement | null> }) {
  const [geo, setGeo] = useState<{ w: number; h: number; d: string; nodes: Pt[] } | null>(null);
  const track = useRef<SVGPathElement>(null);
  const reveal = useRef<SVGPathElement>(null);
  const head = useRef<SVGGElement>(null);
  const dots = useRef<(SVGCircleElement | null)[]>([]);

  // layout: measure the section markers and draw a gently swaying path through them
  // (a passive effect: the wrapper's ref is attached only after this child's layout effects would run)
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const build = () => {
      const box = el.getBoundingClientRect();
      const w = el.clientWidth, h = el.scrollHeight;
      const md = window.innerWidth >= 768;
      const cx = md ? w / 2 : 22;
      const sway = md ? 18 : 0;
      const marks = [...el.querySelectorAll<HTMLElement>("[data-node]")];
      const nodes: Pt[] = marks.map((m, i) => {
        const r = m.getBoundingClientRect();
        return { x: cx + (i % 2 ? sway : -sway), y: r.top - box.top + Math.min(26, r.height / 2) };
      });
      if (!nodes.length) return;
      const pts = [{ x: cx, y: 0 }, ...nodes];
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], dy = b.y - a.y;
        const bulge = md ? (i % 2 ? 1 : -1) * 34 : 0;
        d += ` C ${a.x + bulge} ${a.y + dy * 0.45} ${b.x + bulge} ${b.y - dy * 0.45} ${b.x} ${b.y}`;
      }
      setGeo({ w, h, d, nodes });
    };
    build();
    const ro = new ResizeObserver(build);
    ro.observe(el);
    window.addEventListener("resize", build);
    const t = setTimeout(build, 1200); // fonts settle
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", build);
      clearTimeout(t);
    };
  }, [wrap]);

  // scroll: grow / shrink the revealed part and move the arrowhead
  useEffect(() => {
    const path = track.current, el = wrap.current;
    if (!geo || !path || !el) return;
    const total = path.getTotalLength();
    const N = 240;
    const samples = Array.from({ length: N + 1 }, (_, i) => {
      const l = (total * i) / N;
      return { l, y: path.getPointAtLength(l).y };
    });
    reveal.current?.setAttribute("stroke-dasharray", `${total} ${total}`);
    let lastY = window.scrollY, up = false, frame = 0;
    const update = () => {
      frame = 0;
      const sy = window.scrollY;
      if (Math.abs(sy - lastY) > 2) up = sy < lastY;
      lastY = sy;
      const tip = sy + window.innerHeight * 0.62 - (el.getBoundingClientRect().top + sy);
      let L = 0;
      if (tip >= samples[N].y) L = total;
      else if (tip > 0) {
        let i = 1;
        while (i < N && samples[i].y < tip) i++;
        const a = samples[i - 1], b = samples[i];
        L = a.l + ((tip - a.y) / Math.max(1e-6, b.y - a.y)) * (b.l - a.l);
      }
      reveal.current?.setAttribute("stroke-dashoffset", String(total - L));
      const p = path.getPointAtLength(L), q = path.getPointAtLength(Math.max(0, L - 3));
      const ang = (Math.atan2(p.y - q.y, p.x - q.x) * 180) / Math.PI - 90 + (up ? 180 : 0);
      head.current?.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${L < 4 ? (up ? 180 : 0) : ang})`);
      head.current?.setAttribute("opacity", L > 2 && L < total - 2 ? "1" : "0");
      geo.nodes.forEach((n, i) => dots.current[i]?.classList.toggle("is-lit", n.y <= tip));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [geo, wrap]);

  if (!geo) return null;
  return (
    <svg className="absolute top-0 left-0 pointer-events-none text-ink" width={geo.w} height={geo.h} aria-hidden>
      <defs>
        <mask id="pb-arrow-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={geo.w} height={geo.h}>
          <path ref={reveal} d={geo.d} stroke="white" strokeWidth="16" fill="none" />
        </mask>
      </defs>
      {/* the route ahead, faint */}
      <path d={geo.d} fill="none" stroke="currentColor" strokeOpacity="0.16" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="0.5 11" />
      {/* the part you've scrolled past, inked */}
      <path ref={track} d={geo.d} fill="none" stroke="var(--navy)" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.5 11" mask="url(#pb-arrow-mask)" />
      {geo.nodes.map((n, i) => (
        <circle
          key={i}
          ref={(c) => {
            dots.current[i] = c;
          }}
          cx={n.x}
          cy={n.y}
          r="7"
          className="pb-node"
          strokeWidth="2"
        />
      ))}
      <g ref={head} opacity="0" filter="url(#pb-wobble)">
        <path d="M -10 -13 L 0 1 L 10 -13" fill="none" stroke="var(--navy)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// ------------------------------------------------------------------ visuals

function HeroMock() {
  return (
    <div className="relative">
      <div className="fall sheet ink-box p-4 sm:p-5 rotate-[0.6deg]" style={v(150, 6)}>
        <div className="flex items-center justify-between border-b border-dashed border-ink/30 pb-2 mb-3">
          <span className="hand text-[15px] flex items-center gap-2">
            <Crane size={22} className="text-navy" /> Bridge Truss Bench
          </span>
          <span className="flex items-center gap-1.5 mono text-[10px] text-green">
            <Walrus size={18} className="text-navy" /> MEMORY ON
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="fall self-end max-w-[85%] bg-note border border-ink/25 shadow-[2px_2px_0_var(--shadow)] px-3 py-1.5 text-[14px] rotate-[0.4deg]" style={v(450, 3)}>
            Same contest, but now the bridge has to span 45 cm.
          </div>
          <div className="fall self-start max-w-[95%] text-[14px]" style={v(700, -2)}>
            <span className="stamp text-[11px] text-blue mr-2">RECALLED 4</span>
            Your limit is 50 sticks and the flat beam snapped at 2.1 kg, so I&rsquo;ve started from your Warren truss and made it 2 cm taller:
            about 7.4 kg before anything breaks, still 23 sticks.
          </div>
        </div>
        <div className="fall mt-3 ink-box-soft bg-sheet-2 p-2 flex items-center gap-3" style={v(950, 4)}>
          <svg viewBox="0 0 220 90" className="flex-1 h-[78px] text-ink" aria-hidden>
            <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" filter="url(#pb-wobble)">
              <path d="M10 60 H210" />
              {/* Warren truss: top chord in compression (red), zig-zag web */}
              <path d="M35 30 H185" stroke="var(--red)" />
              <path d="M10 60 L35 30 L60 60 L85 30 L110 60 L135 30 L160 60 L185 30 L210 60" stroke="var(--blue)" />
              <path d="M10 60 l-8 12 h16 z M210 60 l-8 12 h16 z" />
              <path d="M110 60 V74" strokeDasharray="3 3" />
              <rect x="96" y="74" width="28" height="13" fill="url(#pb-hatch)" />
            </g>
          </svg>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="w-11 h-11 rounded-full bg-red border-[2.5px] border-ink shadow-[0_4px_0_var(--ink)]" />
            <span className="mono text-[9px] tracking-wider">RUN TEST</span>
          </div>
        </div>
        <div className="fall absolute -right-2 -bottom-4 stamp text-[18px] text-green bg-sheet" style={v(1250, -10)}>
          PASSED 3 kg
        </div>
      </div>
    </div>
  );
}

const MEMS: { kind: string; color: string; text: string }[] = [
  { kind: "CONSTRAINT", color: "text-red border-red", text: "Max 50 sticks, wood glue only" },
  { kind: "WIN", color: "text-green border-green", text: "Warren truss: holds about 8.4 kg, 23 sticks" },
  { kind: "FAILURE", color: "text-red border-red", text: "Flat beam snapped at 2.1 kg" },
];

function WalrusDiagram() {
  return (
    <div className="relative sheet ink-box p-4 sm:p-5">
      <div className="flex items-end justify-between gap-2">
        {(["mobile-screen", "laptop"] as const).map((d, i) => (
          <div key={d} className="fall flex flex-col items-center gap-1 text-ink-2" style={v(i * 120, i ? 5 : -5)}>
            <Icon name={d} size={34} />
            <span className="hand text-[13px]">{i ? "your laptop" : "your phone"}</span>
          </div>
        ))}
        <div className="fall flex flex-col items-center -mb-1" style={v(240, 0)}>
          <Walrus size={96} className="text-navy wobble" />
        </div>
      </div>
      <svg viewBox="0 0 300 40" className="w-full h-10 text-ink-3 my-1" aria-hidden>
        <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="4 5">
          <path className="draw-in" pathLength={1} d="M30 4 C60 34 120 34 150 36" />
          <path className="draw-in" pathLength={1} d="M110 4 C120 26 140 30 150 36" />
          <path className="draw-in" pathLength={1} d="M250 4 C230 26 180 32 150 36" />
        </g>
      </svg>
      <div className="ink-box-soft bg-blue-soft/50 p-3 relative">
        <div className="flex items-center justify-between mb-2">
          <span className="hand text-[16px] flex items-center gap-2">
            <Icon name="cubes" className="text-navy" /> Walrus Memory
          </span>
          <span className="mono text-[10px] text-ink-3">namespace pb-amara</span>
        </div>
        <ul className="flex flex-col gap-1.5">
          {MEMS.map((m, i) => (
            <li key={m.kind} className="fall sheet border border-ink/20 px-2 py-1.5 flex items-center gap-2 text-[13px]" style={v(450 + i * 220, i % 2 ? 7 : -7)}>
              <span className={`mono text-[9.5px] px-1 py-[2px] border rounded-[2px] tracking-wider shrink-0 ${m.color}`}>{m.kind}</span>
              <span className="text-ink-2">{m.text}</span>
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green shrink-0" title="stored on Walrus" />
            </li>
          ))}
        </ul>
        <p className="text-[11.5px] text-ink-3 mt-2">Each memory is one short sentence, stored as a blob on Walrus.</p>
      </div>
    </div>
  );
}

/** Small charts in the style of the benches: a load test, a checkout line, a battery night, savings vs inflation. */
function Graphs() {
  const queue2 = series(40, (t, r) => 2 + t * 26 * (1 - t) * 2.2 + r * 3);
  const queue3 = series(40, (t, r) => 1 + t * 6 * (1 - t) * 2 + r * 1.5);
  const battery = series(40, (t) => (t < 0.62 ? 100 - t * 128 : 20));
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* bars: which truss holds most */}
      <figure className="fall sheet ink-box p-3 col-span-2" style={v(0, -3)}>
        <figcaption className="hand text-[14px] mb-1">Bridge bench: what each 40 cm design holds (kg)</figcaption>
        <svg viewBox="0 0 300 110" className="w-full" aria-hidden>
          <path d="M30 95 H290" stroke="currentColor" strokeWidth="1.4" />
          <path d={`M30 ${95 - (5 / 8.4) * 70} H290`} stroke="var(--red)" strokeDasharray="5 4" strokeWidth="1.2" />
          <text x="32" y={90 - (5 / 8.4) * 70} className="mono" fontSize="9" fill="var(--red)">
            target 5 kg
          </text>
          {[
            ["Flat beam", 2.1, "var(--red)"],
            ["Pratt", 6.6, "var(--ink-2)"],
            ["Howe", 6.6, "var(--ink-2)"],
            ["Warren", 8.4, "var(--green)"],
          ].map(([label, kg, col], i) => {
            const h = (Number(kg) / 8.4) * 70;
            return (
              <g key={String(label)}>
                <rect
                  className="draw-bar"
                  style={{ transitionDelay: `${300 + i * 160}ms` }}
                  x={45 + i * 62}
                  y={95 - h}
                  width="34"
                  height={h}
                  fill={String(col)}
                  fillOpacity="0.3"
                  stroke={String(col)}
                  strokeWidth="1.5"
                />
                <text x={62 + i * 62} y={91 - h} textAnchor="middle" className="mono" fontSize="10" fill="currentColor">
                  {String(kg)}
                </text>
                <text x={62 + i * 62} y="107" textAnchor="middle" fontSize="10" fill="var(--ink-2)" className="hand">
                  {String(label)}
                </text>
              </g>
            );
          })}
        </svg>
      </figure>
      <MiniChart title="Checkout: people waiting" note="2 cashiers vs 3" d={0}>
        <path className="draw-in" pathLength={1} d={toPath(queue2, 18)} stroke="var(--red)" strokeWidth="2" fill="none" style={v(400)} />
        <path className="draw-in" pathLength={1} d={toPath(queue3, 18)} stroke="var(--green)" strokeWidth="2" fill="none" style={v(700)} />
      </MiniChart>
      <MiniChart title="Solar: battery overnight" note="cuts out at 20%" d={150}>
        <path d="M0 64 H160" stroke="var(--red)" strokeDasharray="4 4" strokeWidth="1" />
        <path className="draw-in" pathLength={1} d={toPath(battery, 100)} stroke="var(--navy)" strokeWidth="2.2" fill="none" style={v(500)} />
      </MiniChart>
    </div>
  );
}

function MiniChart({ title, note, d, children }: { title: string; note: string; d: number; children: ReactNode }) {
  return (
    <figure className="fall sheet ink-box p-3" style={v(d, d ? 4 : -4)}>
      <figcaption className="hand text-[13.5px] leading-tight">{title}</figcaption>
      <svg viewBox="0 0 160 80" className="w-full mt-1" aria-hidden>
        <path d="M0 78 H160 M0 0 V78" stroke="currentColor" strokeWidth="1.3" />
        {children}
      </svg>
      <p className="mono text-[10px] text-ink-3">{note}</p>
    </figure>
  );
}

/** n points of f(t, noise) for t in 0..1, deterministic noise */
function series(n: number, f: (t: number, r: number) => number) {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
  return Array.from({ length: n }, (_, i) => f(i / (n - 1), rnd()));
}
function toPath(ys: number[], max: number) {
  return ys.map((y, i) => `${i ? "L" : "M"}${((i / (ys.length - 1)) * 160).toFixed(1)} ${(78 - (Math.max(0, y) / max) * 74).toFixed(1)}`).join(" ");
}

function Compare() {
  return (
    <div className="grid sm:grid-cols-2 gap-3 items-start">
      <div className="fall sheet ink-box-soft border-dashed p-3 bg-sheet-2" style={v(0, -5)}>
        <div className="flex items-center justify-between mb-2">
          <span className="stamp text-[12px] text-ink-3">MEMORY OFF</span>
          <KnifeSwitch size={34} className="text-ink-3" />
        </div>
        <p className="text-[14px] text-ink-2">
          Hi! What are you building? What materials can you use, and is there a budget?
        </p>
        <p className="text-[12px] text-ink-3 mt-2 italic">…for the third time this week.</p>
      </div>
      <div className="fall sheet ink-box p-3" style={v(250, 5)}>
        <div className="flex items-center justify-between mb-2">
          <span className="stamp text-[12px] text-green">MEMORY ON</span>
          <Walrus size={34} className="text-navy" />
        </div>
        <p className="text-[14px]">
          Welcome back, Amara. Your limit is 50 sticks with wood glue, and the flat beam snapped at 2.1 kg, so I&rsquo;ve set the dials to your best
          design: the Warren truss (about 8.4 kg, 23 sticks). Want to try it 2 cm taller?
        </p>
      </div>
    </div>
  );
}

const SPRITES: UiIconName[] = [
  "elephant", "person-walking", "elevator", "stairs", "mug-hot", "cow", "car-side", "tree", "house", "solar-panel", "droplet", "bus",
  "fish", "bread-slice", "wheelchair", "rocket", "bicycle", "fire", "tractor", "popsicle-stick",
];

function SpriteBox() {
  return (
    <div className="sheet ink-box p-4">
      <div className="ink-box-soft bg-note/60 px-3 py-2 text-[13.5px] flex items-start gap-2">
        <Icon name="wand-magic-sparkles" className="text-navy mt-1" />
        <span>&ldquo;An elephant crossing a bridge made of popsicle sticks. How many sticks before it holds?&rdquo;</span>
      </div>
      <div className="grid grid-cols-5 gap-2 sm:gap-3 mt-4 text-ink">
        {SPRITES.map((n, i) => (
          <div key={n} className="fall flex items-center justify-center aspect-square ink-box-soft bg-sheet-2" style={v(100 + i * 60, i % 2 ? 9 : -9)} title={n}>
            <Icon name={n} size={26} className={i % 3 === 0 ? "text-navy" : ""} />
          </div>
        ))}
      </div>
      <p className="text-[12px] text-ink-3 mt-3">A few of the ~900 sprites the AI can draw with. People are drawn as stick figures.</p>
    </div>
  );
}
