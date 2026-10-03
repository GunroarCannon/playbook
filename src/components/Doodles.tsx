/* Line-art doodles in the style of an inventor's notebook. Pure SVG, ink = currentColor. */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

const base = (size: number | undefined, vb: string, props: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: vb,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

/** Global SVG defs: a subtle turbulence filter that makes straight lines look hand-inked. */
export function SketchDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id="pb-wobble" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <pattern id="pb-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth="1" opacity="0.45" />
        </pattern>
      </defs>
    </svg>
  );
}

function gearPath(cx: number, cy: number, rOuter: number, rInner: number, teeth: number) {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const seq = [
      [rInner, a],
      [rOuter, a + step * 0.15],
      [rOuter, a + step * 0.45],
      [rInner, a + step * 0.6],
    ];
    for (const [r, t] of seq) pts.push(`${(cx + r * Math.cos(t)).toFixed(2)},${(cy + r * Math.sin(t)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

export function Gear({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <path d={gearPath(50, 50, 44, 37, 18)} />
      <circle cx="50" cy="50" r="27" />
      <circle cx="50" cy="50" r="9" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle key={a} cx={r2(50 + 18 * Math.cos((a * Math.PI) / 180))} cy={r2(50 + 18 * Math.sin((a * Math.PI) / 180))} r="4.5" />
      ))}
      <path d="M50 41 V30 M50 59 V70" strokeDasharray="2 3" opacity="0.6" />
    </svg>
  );
}

export function Flask({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 80 100", props)}>
      <path d="M30 8 H50 M33 8 V38 L10 84 Q7 92 16 92 H64 Q73 92 70 84 L47 38 V8" />
      <path d="M17 72 H63 L69 85 Q71 89 65 89 H15 Q9 89 11 85 Z" fill="currentColor" opacity="0.9" />
      <circle cx="36" cy="62" r="3" />
      <circle cx="46" cy="54" r="2" />
      <circle cx="41" cy="46" r="1.5" />
      <path d="M36 20 H44 M36 28 H42" opacity="0.6" />
    </svg>
  );
}

export function Atom({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <ellipse cx="50" cy="50" rx="44" ry="16" />
      <ellipse cx="50" cy="50" rx="44" ry="16" transform="rotate(60 50 50)" />
      <ellipse cx="50" cy="50" rx="44" ry="16" transform="rotate(120 50 50)" />
      <circle cx="50" cy="50" r="7" fill="currentColor" />
      <circle cx="92" cy="47" r="3" fill="currentColor" />
    </svg>
  );
}

export function Pendulum({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <path d="M14 10 H86" strokeWidth="2.2" />
      <path d="M20 10 l-5 -6 M32 10 l-5 -6 M44 10 l-5 -6 M56 10 l-5 -6 M68 10 l-5 -6 M80 10 l-5 -6" opacity="0.6" />
      <path d="M50 10 L70 70" />
      <circle cx="73" cy="78" r="9" />
      <path d="M50 10 L50 80" strokeDasharray="3 4" opacity="0.6" />
      <path d="M50 40 A 30 30 0 0 0 60 38" opacity="0.8" />
      <text x="56" y="34" fontSize="9" fill="currentColor" stroke="none" fontFamily="var(--font-hand)">
        θ
      </text>
      <path d="M30 86 Q50 96 82 82" strokeDasharray="2 4" opacity="0.6" />
    </svg>
  );
}

export function Crane({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 120 120", props)}>
      {/* mast */}
      <path d="M38 112 V40 M50 112 V40" />
      {[112, 96, 80, 64, 48].map((y) => (
        <g key={y}>
          <path d={`M38 ${y} H50`} />
          {y > 48 && <path d={`M38 ${y} L50 ${y - 16} M50 ${y} L38 ${y - 16}`} />}
        </g>
      ))}
      {/* jib + counter jib */}
      <path d="M12 40 H112 M12 32 H112 M12 32 V40 M112 32 V40" />
      {[24, 36, 60, 72, 84, 96, 108].map((x) => (
        <path key={x} d={`M${x - 12} 40 L${x} 32`} />
      ))}
      {/* apex + ties */}
      <path d="M44 32 V14 M44 14 L14 32 M44 14 L106 32" />
      <circle cx="44" cy="12" r="3" />
      {/* cab */}
      <rect x="34" y="40" width="20" height="14" rx="2" />
      {/* hook */}
      <path d="M92 40 V74" />
      <rect x="88" y="74" width="8" height="5" />
      <path d="M92 79 V86 a5 5 0 1 1 -5 5" />
      {/* counterweight + base */}
      <rect x="14" y="40" width="12" height="10" fill="url(#pb-hatch)" />
      <path d="M28 112 H60 M24 116 H64" strokeWidth="2.2" />
    </svg>
  );
}

export function Bulb({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 80 100", props)}>
      <path d="M28 70 Q28 60 20 50 A24 24 0 1 1 60 50 Q52 60 52 70 Z" />
      <path d="M29 76 H51 M30 82 H50 M34 88 H46" />
      <path d="M33 70 L36 48 L40 56 L44 48 L47 70" opacity="0.8" />
      <path d="M40 2 V8 M8 30 H14 M66 30 H72 M15 8 L19 13 M65 8 L61 13" opacity="0.7" />
    </svg>
  );
}

export function SetSquare({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <path d="M8 92 L8 10 L90 92 Z" />
      <path d="M22 78 L22 44 L56 78 Z" />
      {[20, 30, 40, 50, 60, 70, 80].map((y) => (
        <path key={y} d={`M8 ${y} H${y % 20 === 0 ? 15 : 12}`} />
      ))}
    </svg>
  );
}

export function Compass({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <circle cx="50" cy="12" r="5" />
      <path d="M50 6 V2" />
      <path d="M47 16 L24 90 M53 16 L76 90" />
      <path d="M24 90 l-1 6 M76 90 l3 -4 l-2 -1" />
      <path d="M33 62 Q50 54 67 62" />
      <path d="M10 96 Q50 70 92 92" strokeDasharray="2 4" opacity="0.6" />
    </svg>
  );
}

export function Balance({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 120 90", props)}>
      <path d="M10 20 H110" strokeWidth="2.2" />
      <path d="M52 86 L60 22 L68 86 Z" />
      <path d="M22 20 V46 M98 20 V46" />
      <rect x="10" y="46" width="24" height="22" />
      <rect x="86" y="46" width="24" height="22" />
      <text x="40" y="12" fontSize="10" fill="currentColor" stroke="none" fontFamily="var(--font-hand)">
        w = mg
      </text>
    </svg>
  );
}

export function Gauge({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 70", props)}>
      <path d="M10 62 A40 40 0 0 1 90 62" />
      {Array.from({ length: 11 }, (_, i) => {
        const a = Math.PI + (i / 10) * Math.PI;
        const r1 = 40,
          rr = i % 5 === 0 ? 31 : 35;
        return (
          <path
            key={i}
            d={`M${r2(50 + r1 * Math.cos(a))} ${r2(62 + r1 * Math.sin(a))} L${r2(50 + rr * Math.cos(a))} ${r2(62 + rr * Math.sin(a))}`}
          />
        );
      })}
      <path d="M50 62 L74 36" strokeWidth="2.2" />
      <circle cx="50" cy="62" r="4" fill="currentColor" />
    </svg>
  );
}

export function KnifeSwitch({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <rect x="14" y="56" width="72" height="34" rx="3" />
      <path d="M30 70 V58 M70 70 V58" />
      <path d="M30 60 L48 16 M70 60 L88 16" strokeWidth="2.6" />
      <path d="M44 22 H94" strokeWidth="3" />
      <rect x="62" y="6" width="34" height="12" rx="5" fill="url(#pb-hatch)" />
    </svg>
  );
}

export const DOODLES = { Gear, Flask, Atom, Pendulum, Crane, Bulb, SetSquare, Compass, Balance, Gauge, KnifeSwitch };

export function Virus({ size = 64, ...props }: P) {
  const spikes = Array.from({ length: 10 }, (_, i) => (i * Math.PI * 2) / 10);
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <circle cx="50" cy="50" r="24" />
      {spikes.map((t, i) => (
        <g key={i}>
          <line x1={r2(50 + 24 * Math.cos(t))} y1={r2(50 + 24 * Math.sin(t))} x2={r2(50 + 36 * Math.cos(t))} y2={r2(50 + 36 * Math.sin(t))} />
          <circle cx={r2(50 + 39 * Math.cos(t))} cy={r2(50 + 39 * Math.sin(t))} r="3.5" />
        </g>
      ))}
      <circle cx="42" cy="44" r="4" />
      <circle cx="57" cy="56" r="5" />
      <circle cx="56" cy="40" r="2.5" />
    </svg>
  );
}

export function Car({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <path d="M8 66 V52 Q8 48 13 47 L28 45 L38 32 Q40 30 44 30 H66 Q70 30 72 33 L80 45 L90 48 Q93 49 93 53 V66 Z" />
      <path d="M41 45 L47 35 H58 V45 Z M63 45 V35 H69 L75 45 Z" />
      <circle cx="28" cy="67" r="9" fill="var(--sheet)" />
      <circle cx="73" cy="67" r="9" fill="var(--sheet)" />
      <circle cx="28" cy="67" r="3" />
      <circle cx="73" cy="67" r="3" />
      <path d="M2 84 H40 M50 84 H62 M70 84 H98" strokeDasharray="0" />
    </svg>
  );
}

export function CoinJar({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <rect x="30" y="10" width="40" height="10" rx="2" />
      <path d="M33 20 Q22 26 22 40 V82 Q22 90 30 90 H70 Q78 90 78 82 V40 Q78 26 67 20" />
      <ellipse cx="40" cy="78" rx="9" ry="4" />
      <ellipse cx="60" cy="78" rx="9" ry="4" />
      <ellipse cx="50" cy="70" rx="9" ry="4" />
      <ellipse cx="44" cy="62" rx="9" ry="4" />
      <path d="M44 4 V8 M52 2 V8 M60 4 V8" />
    </svg>
  );
}

export function Rocket({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <path d="M50 6 Q62 16 62 32 V68 H38 V32 Q38 16 50 6 Z" />
      <path d="M38 52 L26 68 V76 L38 70 M62 52 L74 68 V76 L62 70" />
      <path d="M45 68 V74 H55 V68" />
      <path d="M40 46 H60" strokeDasharray="3 3" />
      <path d="M44 80 Q42 88 46 94 M50 80 V96 M56 80 Q58 88 54 94" opacity="0.7" />
    </svg>
  );
}

export function MagicFlask({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <path d="M38 14 H58 M42 14 V40 L22 78 Q19 86 28 86 H68 Q77 86 74 78 L54 40 V14" />
      <path d="M30 66 Q48 60 66 66" />
      <path d="M78 10 L81 19 L90 22 L81 25 L78 34 L75 25 L66 22 L75 19 Z" />
      <path d="M14 30 L16 35 L21 37 L16 39 L14 44 L12 39 L7 37 L12 35 Z" />
    </svg>
  );
}

export function Shelf({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <path d="M8 6 V94" strokeWidth="2.2" />
      <path d="M8 58 H92 V64 H8" />
      <path d="M8 64 L30 82 M14 64 L8 70" />
      <path d="M16 58 V30 H24 V58 M26 58 V24 H35 V58 M37 58 V34 H44 V58 M48 58 L58 30 L65 33 L55 58" />
      <rect x="70" y="40" width="16" height="18" fill="url(#pb-hatch)" />
      <path d="M50 70 Q60 74 70 70" strokeDasharray="2 3" opacity="0.6" />
    </svg>
  );
}

export function Pulley({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <path d="M20 6 H80" strokeWidth="2.2" />
      <path d="M26 6 l-5 -4 M40 6 l-5 -4 M54 6 l-5 -4 M68 6 l-5 -4" opacity="0.6" />
      <path d="M50 6 V20" />
      <circle cx="50" cy="32" r="13" />
      <circle cx="50" cy="32" r="3" fill="currentColor" />
      <path d="M37 32 V94 M63 32 V60" />
      <rect x="53" y="60" width="20" height="18" fill="url(#pb-hatch)" />
      <path d="M37 80 l-4 6 M37 80 l4 6" opacity="0.7" />
    </svg>
  );
}

export function EggChute({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <path d="M14 34 Q50 -6 86 34 Q77 30 68 34 Q59 30 50 34 Q41 30 32 34 Q23 30 14 34 Z" />
      <path d="M15 34 L44 66 M38 34 L47 64 M62 34 L53 64 M85 34 L56 66" opacity="0.8" />
      <ellipse cx="50" cy="78" rx="10" ry="13" />
      <path d="M41 78 L46 74 L50 80 L54 75 L59 78" />
      <path d="M20 96 H80" strokeDasharray="3 4" opacity="0.6" />
    </svg>
  );
}

export function FuelGauge({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <path d="M10 70 Q30 40 50 54 T90 36" strokeDasharray="4 4" opacity="0.6" />
      <path d="M14 58 A36 36 0 0 1 86 58" />
      <path d="M50 58 L30 32" strokeWidth="2.4" />
      <circle cx="50" cy="58" r="4" fill="currentColor" />
      <text x="12" y="74" fontSize="11" fill="currentColor" stroke="none" fontFamily="var(--font-hand)">E</text>
      <text x="80" y="74" fontSize="11" fill="currentColor" stroke="none" fontFamily="var(--font-hand)">F</text>
      <path d="M38 88 H62 M42 82 H58 V94 H42 Z" />
    </svg>
  );
}

export function RainTank({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <path d="M8 30 L34 12 L60 30" />
      <path d="M58 30 H72 V48" />
      <rect x="62" y="48" width="30" height="42" rx="4" />
      <path d="M64 72 Q77 68 90 72" opacity="0.8" />
      <path d="M64 72 V88 H90 V72" fill="url(#pb-hatch)" stroke="none" />
      <path d="M14 46 l-3 7 M26 40 l-3 7 M38 46 l-3 7 M20 60 l-3 7 M32 56 l-3 7" opacity="0.7" />
    </svg>
  );
}

export function Genset({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <rect x="12" y="34" width="70" height="40" rx="4" />
      <path d="M8 26 H86 M8 26 V76 M86 26 V76" />
      <path d="M20 44 H44 M20 52 H44 M20 60 H44" />
      <circle cx="64" cy="52" r="9" />
      <circle cx="24" cy="82" r="7" />
      <path d="M82 40 H94 V30" />
      <circle cx="94" cy="20" r="4" opacity="0.6" />
      <circle cx="90" cy="10" r="5" opacity="0.4" />
    </svg>
  );
}

export function AcUnit({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <rect x="10" y="20" width="80" height="30" rx="8" />
      <path d="M20 42 H80" />
      <circle cx="80" cy="30" r="2" fill="currentColor" />
      <path d="M26 58 Q22 66 28 74 M50 58 Q46 68 52 78 M74 58 Q70 66 76 74" />
      <path d="M8 92 H20 M14 86 V98 M10 88 L18 96 M18 88 L10 96" opacity="0.7" />
    </svg>
  );
}

export function Meter({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <rect x="24" y="6" width="52" height="88" rx="6" />
      <rect x="32" y="14" width="36" height="18" />
      <path d="M36 23 H58" strokeWidth="2.2" />
      {[0, 1, 2].flatMap((c) => [0, 1, 2].map((r) => <rect key={`${c}${r}`} x={33 + c * 12} y={40 + r * 12} width="9" height="8" />))}
      <circle cx="36" cy="84" r="3" fill="currentColor" />
      <path d="M84 30 L92 20 L88 34 L96 28" opacity="0.7" />
    </svg>
  );
}

export function Receipt({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <path d="M22 8 H78 V92 L71 86 L64 92 L57 86 L50 92 L43 86 L36 92 L29 86 L22 92 Z" />
      <path d="M32 24 H68 M32 34 H60 M32 44 H66" opacity="0.8" />
      <path d="M32 60 Q42 54 50 62 T68 58" />
      <text x="36" y="80" fontSize="13" fill="currentColor" stroke="none" fontFamily="var(--font-hand)">% / mo</text>
    </svg>
  );
}

export function Stall({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <path d="M8 18 H92 V30 H8 Z" fill="url(#pb-hatch)" />
      <path d="M8 30 Q15 38 22 30 Q29 38 36 30 Q43 38 50 30 Q57 38 64 30 Q71 38 78 30 Q85 38 92 30" />
      <path d="M14 30 V92 M86 30 V92" />
      <rect x="10" y="60" width="80" height="22" />
      <circle cx="30" cy="54" r="5" />
      <circle cx="42" cy="54" r="5" />
      <circle cx="36" cy="46" r="5" />
      <path d="M58 58 L66 44 L74 58" />
    </svg>
  );
}

export function Exit({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 100 100", props)}>
      <rect x="54" y="10" width="34" height="80" />
      <path d="M54 10 L72 18 V96 L54 90" fill="url(#pb-hatch)" />
      <circle cx="26" cy="30" r="6" />
      <path d="M26 36 L22 58 L34 76 M22 58 L12 74 M24 44 L38 50 M24 44 L12 50" />
      <path d="M40 66 H50 M44 60 L50 66 L44 72" />
    </svg>
  );
}

export function BenchIcon({ simId, size = 28, ...props }: P & { simId: string }) {
  const Icon =
    {
      truss: Crane,
      queue: Balance,
      solar: Bulb,
      projectile: Pendulum,
      outbreak: Virus,
      braking: Car,
      savings: CoinJar,
      rocket: Rocket,
      shelf: Shelf,
      pulley: Pulley,
      eggdrop: EggChute,
      roadtrip: FuelGauge,
      rainwater: RainTank,
      generator: Genset,
      cooling: AcUnit,
      powerbill: Meter,
      loan: Receipt,
      business: Stall,
      evacuation: Exit,
    }[simId] ?? (simId.startsWith("c-") ? MagicFlask : Flask);
  return <Icon size={size} {...props} />;
}

/** Walrus Memory's mascot, notebook style: facing right, tusks down, whiskers. */
export function Walrus({ size = 64, ...props }: P) {
  return (
    <svg {...base(size, "0 0 120 100", props)}>
      {/* body: tail flippers on the left, rising to the head on the right */}
      <path d="M12 80 C6 62 20 44 42 40 C56 37 66 30 80 28 C98 26 108 38 106 52 C104 62 98 68 92 70 L88 86 C70 90 40 90 22 88 C16 87 13 84 12 80 Z" />
      <path d="M12 80 L3 72 M12 80 L4 90" />
      {/* front flipper */}
      <path d="M62 86 C66 92 74 95 82 94 C78 90 76 87 75 85" />
      {/* face: eye, whisker pads, tusks */}
      <circle cx="88" cy="38" r="1.6" fill="currentColor" />
      <ellipse cx="92" cy="54" rx="7" ry="5.5" />
      <ellipse cx="103" cy="53" rx="6" ry="5" />
      <path d="M90 59 L89 80 L94 60 M101 58 L101 78 L105 58" />
      <path d="M88 52 h-0.2 M92 51 h-0.2 M96 52 h-0.2 M101 50 h-0.2 M105 51 h-0.2" strokeWidth="2.2" />
      {/* belly crease */}
      <path d="M40 70 C50 76 64 76 74 72" opacity="0.5" />
    </svg>
  );
}
