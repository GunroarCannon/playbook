"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CATEGORIES, SIMS } from "@/lib/sims";
import { BenchIcon, Crane, Gear, KnifeSwitch, SketchDefs, Walrus } from "./Doodles";
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

  // the margin doodles (gears, pendulum, spring) turn with the page: scroll position goes out as CSS variables
  useEffect(() => {
    const el = root.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const sy = window.scrollY;
      el.style.setProperty("--sy", String(Math.round(sy)));
      el.style.setProperty("--swing", `${(Math.sin(sy / 110) * 26).toFixed(2)}deg`);
      el.style.setProperty("--bounce", (1 + Math.sin(sy / 70) * 0.28).toFixed(3));
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
  }, []);

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
    <div ref={root} className="graph-paper min-h-dvh overflow-x-clip">
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
        <MarginDoodles />

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
          <Steps />
        </section>

        {/* 3. Watch it break (sticky: the bridges load up as you scroll) */}
        <BreakSection />

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
        <section id="uses" className="relative pt-14 sm:pt-20 pb-10 sm:pb-14">
          <div className="max-w-6xl mx-auto pl-12 pr-4 sm:pr-6 md:px-6">
            <div className="max-w-[34rem]">
              <Mark />
              <Kicker icon="lightbulb">What people use it for</Kicker>
              <H2>From school projects to shop floors</H2>
              <P>
                {SIMS.length} benches are ready to go, from egg drops to loan offers, each with a handful of one-click scenarios to start from. Each
                one remembers your settings and results separately.
              </P>
            </div>
          </div>
          <BenchMarquee />
          <div className="max-w-6xl mx-auto pl-12 pr-4 sm:pr-6 md:px-6 mt-6 flex flex-wrap gap-2">
            {CATEGORIES.map((c, i) => (
              <span key={c.id} className="fall flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-ink/30 bg-sheet text-[13px] text-ink-2" style={v(i * 80, i % 2 ? 4 : -4)}>
                <Icon name={c.icon} className="text-navy" /> {c.label}
                <span className="mono text-[10.5px] text-ink-3">{SIMS.filter((s) => s.category === c.id).length}</span>
              </span>
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
            It draws with a box of over 900 sketch sprites: people, elephants, kekes, water tanks, generators, parachutes, hens, lifts and more, so your
            idea looks like the real thing.
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

/** The question each bench answers, for the drifting bench marquee. */
const QUESTIONS: Record<string, string> = {
  truss: "Which popsicle-stick truss holds the most for the fewest sticks?",
  shelf: "Will this plank sag under my books?",
  pulley: "How many ropes to lift a 120 kg engine?",
  eggdrop: "Parachute or padding: what saves the egg?",
  rocket: "How much water and pressure to reach 40 m?",
  projectile: "Best launch angle, air drag, a pendulum on Mars.",
  braking: "Could you stop in time on a wet road at 80?",
  roadtrip: "Lagos to Abuja: how many fuel stops?",
  solar: "Will the battery last the night?",
  rainwater: "How big a tank so we never run dry?",
  generator: "What will the gen cost me in fuel each week?",
  cooling: "Is a 1 HP AC enough for this room?",
  powerbill: "Which appliance is eating my prepaid units?",
  savings: "Will ₦60,000 a month beat 25% inflation?",
  loan: "Flat rate or reducing: what does it really cost?",
  business: "When does my food stall pay for itself?",
  queue: "How many cashiers so nobody waits 3 minutes?",
  outbreak: "Do the hospital beds run out?",
  evacuation: "Can 500 people get out in 2.5 minutes?",
};

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

const HERO_LOAD = 3;

/** The hero's bench mock. Scrolling runs its test: the button goes down, weights slide onto the truss, it passes. */
function HeroMock() {
  const [ref, p] = useScrub<HTMLDivElement>("lead");
  const load = seg(p, 0.12, 0.85) * HERO_LOAD;
  const pressed = p > 0.04;
  const done = p >= 0.85;
  // Warren truss: bottom chord y=60 (nodes every 50), top chord y=30; it dips a little and inks in as it loads
  const k = load / HERO_LOAD;
  const dip = (x: number) => k * 2.5 * Math.sin((Math.PI * (x - 10)) / 200);
  const pt = (x: number, y: number) => `${x},${(y + dip(x)).toFixed(2)}`;
  const web = [10, 35, 60, 85, 110, 135, 160, 185, 210].map((x, i) => pt(x, i % 2 ? 30 : 60)).join(" ");
  const tint = (c: string) => `color-mix(in srgb, ${c} ${Math.round(k * 100)}%, currentColor)`;
  const hang = 86 + dip(110);
  return (
    <div ref={ref} className="relative">
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
          <svg viewBox="0 0 220 92" className="flex-1 min-w-0 h-[104px] text-ink overflow-visible" aria-label={`Warren truss carrying ${load.toFixed(1)} kg`}>
            <text x="2" y="10" className="hand" fontSize="12" fill="var(--navy)" style={{ opacity: 1 - seg(p, 0, 0.06) }}>
              scroll down to run the test ↓
            </text>
            <text x="218" y="10" textAnchor="end" className="mono" fontSize="10.5" fill={done ? "var(--green)" : "currentColor"} style={{ opacity: seg(p, 0.04, 0.12) }}>
              {load.toFixed(1)} kg
            </text>
            <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" filter="url(#pb-wobble)">
              <polyline points={[10, 60, 110, 160, 210].map((x) => pt(x, 60)).join(" ")} />
              {/* Warren truss: top chord goes red (compression), the zig-zag web blue, as the load rises */}
              <polyline points={[35, 85, 135, 185].map((x) => pt(x, 30)).join(" ")} stroke={tint("var(--red)")} />
              <polyline points={web} stroke={tint("var(--blue)")} />
              <path d="M10 60 l-8 12 h16 z M210 60 l-8 12 h16 z" />
              {/* hanger: a rope with a plate, and slotted weights that slide down it */}
              <path d={`M110 ${60 + dip(110)} V${hang}`} strokeWidth="1.2" />
              <path d={`M98 ${hang} H122`} strokeWidth="2" />
            </g>
            {[0, 1, 2].map((i) => {
              const a = seg(load, i + 0.1, i + 0.7);
              return (
                <rect
                  key={i}
                  x="100"
                  y={hang - (i + 1) * 5.4}
                  width="20"
                  height="4.6"
                  rx="1"
                  fill="url(#pb-hatch)"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  className="bb-block"
                  style={{ opacity: a, transform: `translateY(${-18 * (1 - a)}px)` }}
                />
              );
            })}
          </svg>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span
              className={`w-11 h-11 rounded-full bg-red border-[2.5px] border-ink motion-safe:transition-all duration-150 ${
                pressed ? "translate-y-[3px] shadow-[0_1px_0_var(--ink)]" : "shadow-[0_4px_0_var(--ink)]"
              }`}
            />
            <span className={`mono text-[9px] tracking-wider w-14 text-center ${done ? "text-green" : ""}`}>{done ? "PASSED" : pressed ? "TESTING…" : "RUN TEST"}</span>
          </div>
        </div>
        <div
          className="bb-stamp absolute -right-2 -bottom-4 stamp text-[18px] text-green bg-sheet"
          style={{ opacity: done ? 1 : 0, transform: `rotate(-10deg) scale(${done ? 1 : 1.6})` }}
          aria-hidden={!done}
        >
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

// ------------------------------------------------------------------ scroll-driven animation

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Progress of the part of `p` between a and b, as 0..1. */
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

/**
 * How far an element has travelled through the screen, 0..1, updated on scroll.
 * "pass": 0 as it enters at the bottom, 1 when its middle reaches 40% from the top.
 * "sticky": progress through a tall section whose content sticks to the screen.
 * "lead": for the hero, which is already on screen at load: 0 at the top of the page (or as it enters on a
 * phone), 1 after a short scroll.
 * This runs with reduced motion too: the picture only changes as fast as the reader scrolls (nothing moves on
 * its own), and the time-based flourishes (bounces, shakes) are switched off in CSS instead.
 */
function useScrub<T extends HTMLElement>(mode: "pass" | "sticky" | "lead" = "pass") {
  const ref = useRef<T>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect(), vh = window.innerHeight, sy = window.scrollY;
      let raw: number;
      if (mode === "sticky") raw = -r.top / Math.max(1, r.height - vh);
      else if (mode === "lead") {
        const top = r.top + sy, start = Math.max(0, top - vh * 0.8);
        raw = (sy - start) / Math.max(220, top + r.height / 2 - vh * 0.3 - start);
      } else raw = (vh * 0.95 - r.top) / (vh * 0.55 + r.height / 2);
      setP(Math.round(clamp01(raw) * 500) / 500);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [mode]);
  return [ref, p] as const;
}

/** The four steps, joined by an arrow that draws itself as you scroll; each step lights up as the arrow reaches it. */
function Steps() {
  const [ref, p] = useScrub<HTMLDivElement>();
  const reach = seg(p, 0.15, 0.85);
  return (
    <div ref={ref} className="relative mt-8 md:mt-10">
      <svg className="hidden lg:block absolute left-0 right-0 -top-11 w-full h-10 text-navy pointer-events-none" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden>
        <path d="M60 34 C 160 4, 270 4, 375 30 S 590 6, 625 30 S 840 4, 950 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - reach} />
        <path d="M938 22 L952 33 L936 40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity={reach > 0.97 ? 1 : 0} style={{ transition: "opacity .2s" }} />
      </svg>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STEPS.map((s, i) => {
          const lit = reach >= i / 3 - 0.02;
          return (
            <div key={s.title} className="fall sheet ink-box p-4 flex flex-col gap-2" style={v(i * 140, i % 2 ? 4 : -4)}>
              <div className="flex items-center justify-between">
                <span
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors duration-300 ${
                    s.red ? (lit ? "bg-red text-white pb-jiggle" : "bg-red-soft text-red") : lit ? "bg-navy text-sheet" : "bg-navy-soft text-navy"
                  }`}
                >
                  <Icon name={s.icon} size={20} />
                </span>
                <span className={`hand text-[28px] transition-colors duration-300 ${lit ? "text-navy" : "text-ink-3"}`}>{i + 1}</span>
              </div>
              <h3 className="hand text-[20px] leading-tight">{s.title}</h3>
              <p className="text-[14px] text-ink-2">{s.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const BEAM_SNAPS = 2.1, TRUSS_LIMIT = 8.4, MAX_LOAD = 8;

/** A tall section that pins the bridges to the screen while scrolling stacks weights on them. */
function BreakSection() {
  const [ref, p] = useScrub<HTMLElement>("sticky");
  const load = +(seg(p, 0.06, 0.88) * MAX_LOAD).toFixed(2);
  const caption =
    load < 0.25
      ? "Scroll to stack weights on both bridges."
      : load < BEAM_SNAPS * 0.75
        ? "Same popsicle sticks, same glue. The flat beam is already bending…"
        : load < BEAM_SNAPS
          ? "Creak. The flat beam is about to go…"
          : load < 4.2
            ? `Snap. The flat beam gave up at ${BEAM_SNAPS} kg.`
            : load < MAX_LOAD - 0.05
              ? `The Warren truss spreads the load through its triangles: still standing at ${load.toFixed(1)} kg.`
              : "8 kg and still standing. Find that out on the bench, before you glue anything.";
  return (
    <section ref={ref} id="break" className="relative h-[240vh]">
      <div className="absolute top-14 sm:top-20 inset-x-0 max-w-6xl mx-auto pl-12 pr-4 md:px-6 pointer-events-none">
        <Mark />
      </div>
      <div className="sticky top-0 h-dvh flex items-center overflow-hidden">
        <div className="max-w-6xl w-full mx-auto pl-12 pr-4 sm:pr-6 md:px-6 grid md:grid-cols-[1fr_88px_1fr] gap-y-4 items-center">
          <div className="md:col-start-1 md:row-start-1">
            <div className="h-8 hidden md:block" aria-hidden />
            <Kicker icon="weight-hanging">Find the breaking point</Kicker>
            <H2>Watch it bend, creak and snap</H2>
            <p className="fall text-[16px] sm:text-[17px] text-ink-2 mt-3 sm:mt-4 leading-relaxed hidden sm:block" style={v(120, 0)}>
              Every bench runs the real physics. Here are two bridges from the same box of sticks: a flat beam and a Warren truss. Keep scrolling to
              pile on the weight.
            </p>
            <LoadGauge load={load} />
          </div>
          <div className="md:col-start-3 md:row-start-1">
            <BridgeBreak load={load} />
            <p className="hand text-[16px] sm:text-[17px] text-navy mt-2 min-h-[3em] leading-snug" aria-live="polite">
              {caption}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LoadGauge({ load }: { load: number }) {
  const pct = (x: number) => `${(x / MAX_LOAD) * 100}%`;
  return (
    <div className="mt-4 sm:mt-6 max-w-[24rem]">
      <div className="flex items-baseline justify-between">
        <span className="hand text-[15px] text-ink-2">Load on each bridge</span>
        <span className="mono text-[22px] text-ink">{load.toFixed(1)} kg</span>
      </div>
      <div className="relative h-3 mt-1 ink-box-soft bg-sheet overflow-hidden">
        <div className={`absolute inset-y-0 left-0 ${load >= BEAM_SNAPS ? "bg-amber" : "bg-navy"} opacity-50`} style={{ width: pct(load) }} />
      </div>
      <div className="relative h-5 mono text-[10px]">
        <span className={`absolute -translate-x-[5px] ${load >= BEAM_SNAPS ? "text-red" : "text-ink-3"}`} style={{ left: pct(BEAM_SNAPS) }}>
          ▲ beam snaps
        </span>
        <span className="absolute right-0 text-green">truss: fine ▲</span>
      </div>
    </div>
  );
}

/** Two bridges under the same load: the flat beam sags and snaps at 2.1 kg, the Warren truss reddens but holds. */
function BridgeBreak({ load }: { load: number }) {
  const broken = load >= BEAM_SNAPS;
  const r = Math.min(1, load / BEAM_SNAPS);
  const sag = r * 10;
  const beamCol = broken || r > 0.85 ? "var(--red)" : r > 0.55 ? "var(--amber)" : "currentColor";
  const creak = !broken && r > 0.8;
  const tilt = (Math.atan2(sag, 130) * 180) / Math.PI;
  // the snap plays out over the next ~0.6 kg of scrolling, speeding up like a fall
  const snap = seg(load, BEAM_SNAPS, BEAM_SNAPS + 0.6) ** 2;
  const fly = seg(load, BEAM_SNAPS, BEAM_SNAPS + 0.35);
  const halfTurn = broken ? tilt + (32 - tilt) * snap : tilt;
  // Warren truss: 6 panels, bottom chord y=282, top chord y=248
  const tr = load / TRUSS_LIMIT;
  const xs = [30, 73.3, 116.7, 160, 203.3, 246.7, 290];
  const dip = (x: number) => tr * 4 * Math.sin((Math.PI * (x - 30)) / 260);
  const bottom = xs.map((x) => [x, 282 + dip(x)] as const);
  const top = xs.slice(0, -1).map((x, i) => [(x + xs[i + 1]) / 2, 248 + dip((x + xs[i + 1]) / 2)] as const);
  const mix = (c: string) => `color-mix(in srgb, ${c} ${Math.round(Math.min(1, tr * 1.05) * 100)}%, var(--ink))`;
  const w = 1.6 + tr * 1.8;
  // weight i slides down onto the bridge as the load passes i + 0.3 kg; `fall` (0..1) tips it off a broken beam
  const block = (i: number, x: number, y: number, fall: number) => {
    const a = seg(load, i + 0.3, i + 0.55);
    return (
      <rect
        key={i}
        x={x - 12}
        y={y - (i + 1) * 9}
        width={24}
        height={8}
        rx={1}
        fill="url(#pb-hatch)"
        stroke="currentColor"
        strokeWidth="1.3"
        className="bb-block"
        style={{
          opacity: a,
          transform: `translate(${(i - 1) * 9 * fall}px, ${(46 + i * 4) * fall - 14 * (1 - a)}px) rotate(${((i - 1) * 25 + 10) * fall}deg)`,
          transformOrigin: `${x}px ${y - i * 9 - 4}px`,
        }}
      />
    );
  };
  return (
    <svg viewBox="0 0 320 340" className="w-full max-w-[460px] text-ink overflow-visible" aria-label={`Two bridges carrying ${load.toFixed(1)} kg`}>
      {/* ---- flat beam ---- */}
      <text x="10" y="18" className="hand" fontSize="14" fill="currentColor">
        Flat beam · 8 sticks
      </text>
      <g fill="url(#pb-hatch)" stroke="currentColor" strokeWidth="1.4">
        <rect x="6" y="80" width="24" height="44" />
        <rect x="290" y="80" width="24" height="44" />
      </g>
      <path d="M0 124 H320" stroke="currentColor" strokeWidth="1.4" />
      <g className={creak ? "bb-creak" : undefined} style={{ transformOrigin: "160px 80px" }}>
        <g className="bb-half" style={{ transformOrigin: "30px 80px", transform: `rotate(${halfTurn}deg)` }}>
          <path d="M30 80 H160" stroke={beamCol} strokeWidth="4" strokeLinecap="round" />
        </g>
        <g className="bb-half" style={{ transformOrigin: "290px 80px", transform: `rotate(${-halfTurn}deg)` }}>
          <path d="M160 80 H290" stroke={beamCol} strokeWidth="4" strokeLinecap="round" />
        </g>
        {[...Array(3)].map((_, i) => block(i, 160, 78 + sag, snap))}
      </g>
      {/* splinters fly out where it snapped */}
      <g stroke="var(--red)" strokeWidth="1.6" strokeLinecap="round">
        {[
          [-22, -16, -40],
          [18, -20, 35],
          [-10, 22, 70],
          [26, 12, -60],
          [2, -26, 15],
        ].map(([dx, dy, rot], i) => (
          <path
            key={i}
            d="M157 86 h7"
            className="bb-splinter"
            style={{ opacity: broken ? 1 : 0, transform: `translate(${dx * fly}px, ${dy * fly}px) rotate(${rot * fly}deg)`, transformOrigin: "160px 86px" }}
          />
        ))}
      </g>
      <g className="bb-stamp" style={{ opacity: broken ? 1 : 0, transform: broken ? "rotate(-8deg) scale(1)" : "rotate(-8deg) scale(1.6)", transformOrigin: "232px 40px" }}>
        <rect x="178" y="26" width="108" height="26" rx="3" fill="var(--sheet)" stroke="var(--red)" strokeWidth="2" />
        <text x="232" y="44" textAnchor="middle" className="hand" fontSize="14" fill="var(--red)">
          SNAPPED 2.1 kg
        </text>
      </g>

      {/* ---- Warren truss ---- */}
      <text x="10" y="168" className="hand" fontSize="14" fill="currentColor">
        Warren truss · 23 sticks
      </text>
      <g fill="url(#pb-hatch)" stroke="currentColor" strokeWidth="1.4">
        <rect x="6" y="284" width="24" height="44" />
        <rect x="290" y="284" width="24" height="44" />
      </g>
      <path d="M0 328 H320" stroke="currentColor" strokeWidth="1.4" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* tension (bottom chord) goes blue, compression (top chord) goes red as the load rises */}
        <polyline points={bottom.map((q) => q.join(",")).join(" ")} stroke={mix("var(--blue)")} strokeWidth={w} />
        <polyline points={top.map((q) => q.join(",")).join(" ")} stroke={mix("var(--red)")} strokeWidth={w} />
        <polyline
          points={bottom.flatMap((q, i) => (top[i] ? [q, top[i]] : [q])).map((q) => q.join(",")).join(" ")}
          stroke={`color-mix(in srgb, var(--amber) ${Math.round(tr * 80)}%, var(--ink))`}
          strokeWidth={w * 0.8}
        />
      </g>
      {[...Array(8)].map((_, i) => block(i, 160, top[2][1] + 1 + 0.5 * (top[3][1] - top[2][1]), 0))}
      <g className="bb-stamp" style={{ opacity: load >= MAX_LOAD - 0.05 ? 1 : 0, transform: load >= MAX_LOAD - 0.05 ? "rotate(-6deg) scale(1)" : "rotate(-6deg) scale(1.6)", transformOrigin: "248px 196px" }}>
        <rect x="184" y="182" width="128" height="26" rx="3" fill="var(--sheet)" stroke="var(--green)" strokeWidth="2" />
        <text x="248" y="200" textAnchor="middle" className="hand" fontSize="14" fill="var(--green)">
          STILL STANDING
        </text>
      </g>
    </svg>
  );
}

/** Small charts in the style of the benches. They play forward as you scroll down and rewind as you scroll back. */
function Graphs() {
  const [ref, p] = useScrub<HTMLDivElement>();
  const id = useId().replace(/:/g, "");
  const queue2 = series(40, (t, r) => 2 + t * 26 * (1 - t) * 2.2 + r * 3);
  const queue3 = series(40, (t, r) => 1 + t * 6 * (1 - t) * 2 + r * 1.5);
  const battery = series(40, (t) => (t < 0.62 ? 100 - t * 128 : 20));
  const sick = series(40, (t) => 260 * Math.exp(-((t - 0.42) ** 2) / 0.018));
  const paper = series(40, (t) => 0.1 + t * 0.85 + t * t * 0.25);
  const real = series(40, (t) => 0.1 + t * 0.55);
  const tc = seg(p, 0.1, 0.9); // how far along the line charts are
  const at = (ys: number[]) => ys[Math.min(ys.length - 1, Math.round(tc * (ys.length - 1)))];
  const night = 18 + tc * 12;
  const clock = `${String(Math.floor(night) % 24).padStart(2, "0")}:${String(Math.floor((night % 1) * 60)).padStart(2, "0")}`;
  const bars: [string, number, string][] = [
    ["Flat beam", 2.1, "var(--red)"],
    ["Pratt", 6.6, "var(--ink-2)"],
    ["Howe", 6.6, "var(--ink-2)"],
    ["Warren", 8.4, "var(--green)"],
  ];
  return (
    <div ref={ref} className="grid grid-cols-2 gap-3">
      {/* bars: which truss holds most */}
      <figure className="fall sheet ink-box p-3 col-span-2" style={v(0, -3)}>
        <figcaption className="hand text-[14px] mb-1">Bridge bench: what each 40 cm design holds (kg)</figcaption>
        <svg viewBox="0 0 300 110" className="w-full" aria-hidden>
          <path d="M30 95 H290" stroke="currentColor" strokeWidth="1.4" />
          <path d={`M30 ${95 - (5 / 8.4) * 70} H290`} stroke="var(--red)" strokeDasharray="5 4" strokeWidth="1.2" />
          <text x="32" y={90 - (5 / 8.4) * 70} className="mono" fontSize="9" fill="var(--red)">
            target 5 kg
          </text>
          {bars.map(([label, kg, col], i) => {
            const f = seg(p, 0.05 + i * 0.1, 0.45 + i * 0.1);
            const h = (kg / 8.4) * 70 * f;
            return (
              <g key={label}>
                <rect x={45 + i * 62} y={95 - h} width="34" height={h} fill={col} fillOpacity="0.3" stroke={col} strokeWidth="1.5" />
                {label === "Flat beam" && f >= 1 && <path d={`M${45 + i * 62} ${95 - h - 3} l6 4 l6 -5 l6 5 l6 -4 l6 4 l4 -3`} stroke="var(--red)" fill="none" strokeWidth="1.2" />}
                <text x={62 + i * 62} y={91 - h - (label === "Flat beam" && f >= 1 ? 5 : 0)} textAnchor="middle" className="mono" fontSize="10" fill="currentColor">
                  {(kg * f).toFixed(1)}
                </text>
                <text x={62 + i * 62} y="107" textAnchor="middle" fontSize="10" fill="var(--ink-2)" className="hand">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </figure>
      <MiniChart id={`${id}q`} t={tc} title="Checkout: people waiting" note={`now: ${Math.max(0, Math.round(at(queue2)))} in line vs ${Math.max(0, Math.round(at(queue3)))}`} d={0}>
        <path d={toPath(queue2, 18)} stroke="var(--red)" strokeWidth="2" fill="none" />
        <path d={toPath(queue3, 18)} stroke="var(--green)" strokeWidth="2" fill="none" />
        <Dot ys={queue2} max={18} t={tc} col="var(--red)" />
        <Dot ys={queue3} max={18} t={tc} col="var(--green)" />
        <text x="4" y="10" fontSize="8" className="mono" fill="var(--red)">2 tills</text>
        <text x="4" y="20" fontSize="8" className="mono" fill="var(--green)">3 tills</text>
      </MiniChart>
      <MiniChart id={`${id}b`} t={tc} title="Solar: battery overnight" note={at(battery) <= 20.5 ? `${clock}: CUT OUT at 20%` : `${clock}: ${Math.round(at(battery))}% left`} warn={at(battery) <= 20.5} d={150}>
        <path d="M0 64 H160" stroke="var(--red)" strokeDasharray="4 4" strokeWidth="1" />
        <path d={toPath(battery, 100)} stroke="var(--navy)" strokeWidth="2.2" fill="none" />
        <Dot ys={battery} max={100} t={tc} col={at(battery) <= 20.5 ? "var(--red)" : "var(--navy)"} />
      </MiniChart>
      <MiniChart id={`${id}o`} t={tc} title="Outbreak: sick vs hospital beds" note={at(sick) > 120 ? `day ${Math.round(tc * 180)}: beds full!` : `day ${Math.round(tc * 180)}: ${Math.round(at(sick))} need a bed`} warn={at(sick) > 120} d={0}>
        <path d={`${toPath(sick, 300)} L160 78 L0 78 Z`} fill="var(--red)" fillOpacity="0.12" stroke="none" clipPath={`url(#${id}over)`} />
        <clipPath id={`${id}over`}>
          <rect x="0" y="0" width="160" height={78 - (120 / 300) * 74} />
        </clipPath>
        <path d={`M0 ${78 - (120 / 300) * 74} H160`} stroke="var(--green)" strokeDasharray="4 4" strokeWidth="1" />
        <path d={toPath(sick, 300)} stroke="var(--red)" strokeWidth="2" fill="none" />
        <Dot ys={sick} max={300} t={tc} col="var(--red)" />
        <text x="104" y={74 - (120 / 300) * 74} fontSize="8" className="mono" fill="var(--green)">beds</text>
      </MiniChart>
      <MiniChart id={`${id}s`} t={tc} title="Savings: on paper vs what it buys" note={`year ${(tc * 3).toFixed(1)}: worth ${Math.round((at(real) / at(paper)) * 100)}% of the number`} d={150}>
        <path d={`${toPath(paper, 1.2)} L${toPath(real, 1.2).replace(/^M/, "").split(" L").reverse().join(" L")} Z`} fill="var(--amber)" fillOpacity="0.12" />
        <path d={toPath(paper, 1.2)} stroke="var(--navy)" strokeWidth="2" fill="none" />
        <path d={toPath(real, 1.2)} stroke="var(--amber)" strokeWidth="2.2" fill="none" />
        <Dot ys={paper} max={1.2} t={tc} col="var(--navy)" />
        <Dot ys={real} max={1.2} t={tc} col="var(--amber)" />
      </MiniChart>
    </div>
  );
}

/** A mini chart whose lines are revealed up to t (0..1), with a dashed cursor at the reveal edge. */
function MiniChart({ id, t, title, note, warn, d, children }: { id: string; t: number; title: string; note: string; warn?: boolean; d: number; children: ReactNode }) {
  return (
    <figure className="fall sheet ink-box p-3" style={v(d, d ? 4 : -4)}>
      <figcaption className="hand text-[13.5px] leading-tight">{title}</figcaption>
      <svg viewBox="0 0 160 80" className="w-full mt-1 overflow-visible" aria-hidden>
        <clipPath id={`${id}clip`}>
          <rect x="-4" y="-10" width={164 * t + 4} height="100" />
        </clipPath>
        <path d="M0 78 H160 M0 0 V78" stroke="currentColor" strokeWidth="1.3" />
        <g clipPath={`url(#${id}clip)`}>{children}</g>
        {t > 0.01 && t < 0.99 && <path d={`M${160 * t} 0 V78`} stroke="var(--ink-3)" strokeWidth="0.8" strokeDasharray="2 2" />}
      </svg>
      <p className={`mono text-[10px] ${warn ? "text-red" : "text-ink-3"}`}>{note}</p>
    </figure>
  );
}

function Dot({ ys, max, t, col }: { ys: number[]; max: number; t: number; col: string }) {
  if (t <= 0.01) return null;
  const i = Math.min(ys.length - 1, Math.round(t * (ys.length - 1)));
  return <circle cx={(i / (ys.length - 1)) * 160} cy={78 - (Math.max(0, ys[i]) / max) * 74} r="3" fill={col} stroke="var(--sheet)" strokeWidth="1" />;
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

/**
 * Every bench, drifting past in two rows going opposite ways. Scrolling the page pushes the rows along
 * (faster scrolling, faster drift). Paused on hover; a still, wrapped grid with reduced motion.
 */
function BenchMarquee() {
  const box = useRef<HTMLDivElement>(null);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const [still, setStill] = useState(false);
  const half = Math.ceil(SIMS.length / 2);
  const lines = [SIMS.slice(0, half), SIMS.slice(half)];

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setStill(true), 0);
      return () => clearTimeout(t);
    }
    let raf = 0, visible = false, hover = false, last = performance.now(), lastY = window.scrollY, push = 0;
    const offs = [0, 0];
    const tick = (now: number) => {
      raf = 0;
      if (!visible) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dy = window.scrollY - lastY;
      lastY = window.scrollY;
      push = push * 0.9 + dy * 0.6; // scrolling gives the rows a shove that fades out
      const speed = hover ? 0 : 28 + push * 6;
      rows.current.forEach((row, i) => {
        if (!row) return;
        const w = row.scrollWidth / 2;
        offs[i] = (((offs[i] + speed * dt * (i ? -1 : 1)) % w) + w) % w;
        row.style.transform = `translateX(${-offs[i]}px)`;
      });
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) {
        last = performance.now();
        lastY = window.scrollY;
        raf = requestAnimationFrame(tick);
      }
    });
    io.observe(el);
    const enter = () => (hover = true), leave = () => (hover = false);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);

  const card = (s: (typeof SIMS)[number], k: string) => (
    <div key={k} className="sheet ink-box-soft w-[250px] sm:w-[280px] shrink-0 p-3 flex gap-3 items-start">
      <BenchIcon simId={s.id} size={42} className="text-navy shrink-0 wobble" />
      <div className="min-w-0">
        <h3 className="hand text-[16px] leading-tight">{s.name.replace(/ Bench$/, "")}</h3>
        <p className="text-[12.5px] text-ink-2 leading-snug mt-0.5">{QUESTIONS[s.id] ?? s.tagline}</p>
      </div>
    </div>
  );

  if (still)
    return (
      <div className="max-w-6xl mx-auto pl-12 pr-4 sm:pr-6 md:px-6 mt-8 flex flex-wrap gap-3">{SIMS.map((s) => card(s, s.id))}</div>
    );
  return (
    <div ref={box} className="mt-8 flex flex-col gap-3 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]" aria-label="All the ready-made benches">
      {lines.map((line, i) => (
        <div
          key={i}
          ref={(r) => {
            rows.current[i] = r;
          }}
          className="flex gap-3 w-max will-change-transform"
        >
          {[...line, ...line].map((s, j) => card(s, `${s.id}-${j}`))}
        </div>
      ))}
    </div>
  );
}

/** Doodles in the wide-screen margins that turn with the page: meshing gears, a pendulum, a spring. */
function MarginDoodles() {
  return (
    <div className="hidden min-[1440px]:block absolute inset-0 pointer-events-none text-navy" aria-hidden>
      <div className="absolute top-[6%] left-[calc(50%-36rem-150px)] opacity-60">
        <Gear size={92} className="pb-turn" />
        <Gear size={62} className="pb-turn-back absolute top-[70px] left-[64px]" />
      </div>
      <div className="absolute top-[30%] right-[calc(50%-36rem-140px)] opacity-60">
        <svg width="90" height="160" viewBox="0 0 90 160" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M10 6 H80" strokeWidth="2.4" />
          <path d="M18 6 l-6 -5 M32 6 l-6 -5 M46 6 l-6 -5 M60 6 l-6 -5 M74 6 l-6 -5" opacity="0.6" />
          <g className="pb-swing">
            <path d="M45 6 V120" />
            <circle cx="45" cy="132" r="12" fill="url(#pb-hatch)" />
          </g>
        </svg>
      </div>
      <div className="absolute top-[56%] left-[calc(50%-36rem-130px)] opacity-60">
        <svg width="70" height="170" viewBox="0 0 70 170" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 6 H62" strokeWidth="2.4" />
          <g className="pb-bounce">
            <path d="M35 6 V16 L14 26 L56 38 L14 50 L56 62 L14 74 L56 86 L35 96 V104" />
            <rect x="18" y="104" width="34" height="26" fill="url(#pb-hatch)" />
          </g>
        </svg>
      </div>
      <div className="absolute top-[80%] right-[calc(50%-36rem-150px)] opacity-60">
        <Gear size={76} className="pb-turn-back" />
      </div>
    </div>
  );
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
  "elephant", "keke", "water-tank", "generator", "parachute", "hen", "goat", "pulley", "tower-crane", "market-stall",
  "jerrycan", "hand-pump", "ac-unit", "egg-cracked", "wheelbarrow", "person-walking", "cow", "bus", "solar-panel", "popsicle-stick",
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
