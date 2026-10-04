import "server-only";

/**
 * Reference cards for the AI bench builder: real constants and the standard model for a domain, picked by keywords
 * in the request. A 27B model knows most of this but misremembers numbers under pressure; having them in the prompt
 * costs ~200 input tokens and saves whole regenerations when the physics review catches a wrong constant.
 * Values are textbook/typical figures, meant for what-if benches rather than engineering sign-off.
 */

type Card = { id: string; words: RegExp; text: string };

const CARDS: Card[] = [
  {
    id: "chemistry",
    words: /\b(chemi\w*|reaction|reactant|reagent|acid|alkali|base|ph|titrat\w*|molar|moles?|stoichiometr\w*|catalys\w*|enzyme|oxid\w*|redox|salt|solution|concentration|dilut\w*|precipitat\w*|electrolys\w*|ferment\w*|combust\w*|burn\w*|vinegar|baking soda|bleach|peroxide|indicator|equilibrium|yield|lab|beaker|flask)\b/i,
    text: `Chemistry reference:
- Molar masses (g/mol): H 1.008, C 12.01, N 14.01, O 16.00, Na 22.99, Mg 24.31, Al 26.98, S 32.06, Cl 35.45, K 39.10, Ca 40.08, Fe 55.85, Cu 63.55, Zn 65.38.
  H2O 18.02, CO2 44.01, O2 32.00, H2 2.016, NH3 17.03, CH4 16.04, NaCl 58.44, NaOH 40.00, HCl 36.46, H2SO4 98.08, CH3COOH 60.05, NaHCO3 84.01, CaCO3 100.09, H2O2 34.01, C2H5OH 46.07, C6H12O6 180.16.
- Gas: 24.5 L/mol at 25 °C and 1 atm (22.4 L/mol at 0 °C); PV = nRT, R = 8.314 J/(mol·K) = 0.08206 L·atm/(mol·K).
- Household: vinegar ~5% ethanoic acid (0.83 mol/L), pharmacy H2O2 3%, hair bleach H2O2 6%, laundry bleach ~5% NaOCl, lemon juice ~pH 2.3 (citric acid).
- Ka: ethanoic 1.8e-5, methanoic 1.8e-4, citric (1st) 7.4e-4, carbonic (1st) 4.3e-7, NH4+ 5.6e-10. Kw = 1e-14 at 25 °C. pH = -log10[H+].
- Indicators: phenolphthalein colourless->pink pH 8.2-10; methyl orange red->yellow 3.1-4.4; bromothymol blue yellow->blue 6.0-7.6; universal: red (1) -> green (7) -> purple (14).
- Kinetics: first order [A] = [A]0·e^(-kt), t½ = ln2/k; Arrhenius k = A·e^(-Ea/RT): many reactions roughly double per +10 °C. Enzymes peak ~37 °C, denature above ~50 °C.
- Energy: ΔH combustion methane -890, ethanol -1367, glucose -2803 kJ/mol; water heat capacity 4.18 J/(g·K); neutralisation ≈ -57 kJ/mol.
- Colours: Cu2+ blue, Fe2+ pale green, Fe3+ yellow-brown, MnO4- purple, CO2 limewater turns milky, H2 squeaky pop, O2 relights a glowing splint.`,
  },
  {
    id: "structures",
    words: /\b(beam|bridge|truss|shelf|plank|load|weight|sag|deflect\w*|bend\w*|column|buckl\w*|stress|strain|steel|timber|wood|concrete|brick|wall|roof|rafter|joist|bolt|weld|crane|cantilever|span|bracket)\b/i,
    text: `Structures reference:
- g = 9.81 m/s². Young's modulus E: steel 200 GPa, aluminium 69, oak 11, pine 9-11, plywood 8, MDF 3.5, concrete 25-30, bamboo 15-20.
- Strength: mild steel yield 250 MPa, aluminium 6061 275 MPa, pine bending ~40 MPa (design ~8-10), concrete compression 20-40 MPa but tension only ~3, brick masonry ~5 MPa.
- Density (kg/m³): steel 7850, aluminium 2700, concrete 2400, brick 1900, pine 500, oak 750, MDF 750, water 1000.
- Beam, simply supported, span L: centre load P -> max moment PL/4, deflection PL³/(48EI); uniform load w per m -> wL²/8 and 5wL⁴/(384EI). Cantilever end load: PL, PL³/(3EI).
  Rectangle b×h: I = bh³/12, bending stress σ = M·(h/2)/I. Euler buckling P = π²EI/(KL)². Typical deflection limit L/250 (shelves L/200), safety factor 1.5-3.
- Friction μ: rubber on dry concrete 0.7-0.8 (wet 0.5), wood on wood 0.3-0.5, steel on steel 0.6, ice 0.05.`,
  },
  {
    id: "motion",
    words: /\b(car|vehicle|drive|driving|speed|brak\w*|stop\w*|accelerat\w*|fuel|trip|journey|bike|bicycle|cycl\w*|run\w*|throw\w*|launch\w*|projectile|ball|jump\w*|fall\w*|drop\w*|rocket|drag|parachute|plane|fly\w*|orbit|pendulum|spring|crash|collision|momentum)\b/i,
    text: `Motion reference:
- g = 9.81 m/s² (Moon 1.62, Mars 3.71). Air density 1.225 kg/m³ at sea level. Drag F = ½ρC_dAv²: C_d car 0.3, cyclist 0.9, sphere 0.47, skydiver 1.0, parachute 1.5.
- Projectile without drag: range v²·sin(2θ)/g. Pendulum T = 2π√(L/g). Spring F = kx, T = 2π√(m/k). Momentum p = mv, KE = ½mv².
- Driving: reaction time 1-1.5 s (phone 2-3 s); braking deceleration dry 7-8 m/s², wet 4-5, gravel 3-4, worn tyres -20%. Stopping distance = v·t_r + v²/(2a).
- Rolling resistance 0.01-0.015. Car fuel 6-8 L/100 km at 90 km/h, rising roughly with v² above that. Walking 1.2-1.4 m/s, running 3-5 m/s, cycling 4-7 m/s.`,
  },
  {
    id: "energy",
    words: /\b(solar|panel|battery|batteries|inverter|generator|gen|electric\w*|power|watt\w*|kwh|volt\w*|amp\w*|current|circuit|wire|cable|resist\w*|bulb|led|motor|fan|fridge|ac|air ?con\w*|nepa|grid|outage|charge|charging|ups)\b/i,
    text: `Electricity and energy reference:
- P = V·I, E = P·t, V = I·R. Copper resistivity 1.68e-8 Ω·m; cable loss P = I²R. 1 kWh = 3.6 MJ.
- Batteries: usable depth of discharge lead-acid 50%, LiFePO4 80-90%; capacity Wh = V × Ah; round-trip efficiency lead-acid ~80%, lithium ~95%. Inverter ~90% efficient.
- Solar: panels ~200 W/m² at peak; 4-6 peak sun hours a day in the tropics (2-3 in a cloudy rainy season or harmattan haze); real output ≈ 75-80% of nameplate.
- Typical loads: LED bulb 10 W, fan 50-75 W, TV 60-100 W, laptop 50 W, fridge 100-150 W average (compressor cycles), freezer 150-200 W, 1 HP AC 750-1000 W, iron 1000 W, kettle 2000 W, water pump 750 W.
- Petrol generator ~0.35-0.5 L per kWh delivered (worse at light load); diesel ~0.3 L/kWh. 1 kVA ≈ 0.8 kW.`,
  },
  {
    id: "heat",
    words: /\b(heat\w*|cool\w*|temperature|hot|cold|warm\w*|insulat\w*|thermal|cook\w*|boil\w*|bak\w*|oven|stove|kettle|freez\w*|ice|melt\w*|charcoal|gas cylinder|lpg|firewood|room|bread|dough|yeast|steam)\b/i,
    text: `Heat reference:
- Water: c = 4.18 kJ/(kg·K), boils 100 °C at sea level, latent heat of vaporisation 2260 kJ/kg, of melting ice 334 kJ/kg. Air c = 1.0 kJ/(kg·K), 1.2 kg/m³.
- Conduction Q = U·A·ΔT; U-values (W/m²K): bare zinc roof ~7, with ceiling board ~2, insulated roof 0.3-0.5, single glass 5.8, brick wall ~2, block wall ~2.5.
- Newton cooling T(t) = T_env + (T0 - T_env)·e^(-t/τ). AC cooling: 1 HP ≈ 2.6 kW of cooling (9000 BTU/h) for ~0.9 kW of electricity.
- Fuels (MJ/kg): LPG 46, kerosene 43, charcoal 29, dry wood 15. Stove efficiency: LPG 50-60%, charcoal 20-30%, open fire 10-15%. Electric kettle 2 kW, ~90% efficient.
- Baking: yeast works 25-40 °C (fastest ~35), dies above ~55 °C; dough roughly doubles in 1-2 h at 27 °C; oven 180-220 °C.`,
  },
  {
    id: "water",
    words: /\b(water|tank|rain\w*|pipe|pump\w*|flow|borehole|well|tap|irrigat\w*|drain\w*|flood\w*|leak\w*|pressure|pool|river|dam|reservoir|litre|liter|plumb\w*)\b/i,
    text: `Water reference:
- 1 m³ = 1000 L = 1000 kg. Flow Q = A·v. Draining through a hole: v = √(2gh) (Torricelli), real flow ≈ 0.6 × that.
- Pump power = ρ·g·Q·H / η (η 0.4-0.7 for small pumps). Pressure 10 m of water head ≈ 1 bar ≈ 100 kPa.
- Rain harvest (L) = roof area (m²) × rainfall (mm) × runoff coefficient (metal 0.9, tile 0.75, thatch 0.5). Lagos ~1500-1800 mm/yr, Abuja ~1200, Kano ~700, mostly in the rainy months.
- Use per person per day: drinking and cooking 5-10 L, basic household 40-50 L, comfortable with shower and flush 100-150 L.`,
  },
  {
    id: "money",
    words: /\b(money|cost\w*|price\w*|profit\w*|loan\w*|interest|sav\w*|invest\w*|budget\w*|business|sell\w*|sales|revenue|wage\w*|salary|rent|inflation|break.?even|naira|₦|dollar|\$|pay\w*|debt|bank|shop|stall|market)\b/i,
    text: `Money reference:
- Compound growth A = P(1 + r/n)^(n·t). Real (inflation-adjusted) value = nominal / (1 + inflation)^t.
- Loan repayment (reducing balance) = P·r / (1 - (1 + r)^-n), r per period; flat-rate interest charges on the full principal every period, so its true rate is roughly double the flat rate.
- Break-even units = fixed costs / (price - variable cost per unit). Profit = revenue - variable costs - fixed costs. Margins, wages, rent and prices in the person's currency.
- Work in the person's currency if known (₦ in Nigeria, with 2026-level prices); otherwise a neutral currency symbol. Show money with thousands separators via D.fmt.`,
  },
  {
    id: "living",
    words: /\b(farm\w*|crop\w*|plant\w*|seed\w*|harvest\w*|soil|fertili[sz]\w*|chicken\w*|poultry|egg\w*|layer\w*|broiler\w*|fish\w*|pond|catfish|goat\w*|cow\w*|cattle|pig\w*|animal\w*|feed|bacteria|virus|infect\w*|disease|epidemic|outbreak|vaccin\w*|drug|dose|medicine|population|growth|grow\w*|calorie\w*|diet|exercise)\b/i,
    text: `Living things reference:
- Logistic growth dN/dt = r·N·(1 - N/K). Bacteria double every ~20 min in ideal conditions (hours in real life). SIR: dS/dt = -βSI/N, dI/dt = βSI/N - γI, R0 = β/γ.
- Drug level after a dose: C(t) = C0·e^(-ln2·t/t½); half-lives: paracetamol 2-3 h, ibuprofen ~2 h, caffeine ~5 h, amoxicillin ~1 h.
- Poultry: layers ~0.8 egg/day at peak (from ~20 weeks), eat 110-120 g feed/day; broilers reach ~2 kg in 6 weeks, feed conversion 1.6-1.8 kg feed per kg gain; mortality 3-8%.
- Catfish: ~6 months to 1 kg, feed conversion 1.2-1.5. Goats: kid at 6-12 months to 15-25 kg. Dairy cow 10-25 L/day.
- Crops (smallholder, tropics): maize 90-120 days, 1.5-3 t/ha (5+ with good inputs); cassava 9-18 months, 10-20 t/ha; tomato 70-90 days. 1 ha = 10,000 m².
- People: ~2000-2500 kcal/day, 2-3 L water/day, walking burns ~4 kcal/min, running ~10.`,
  },
];

/** The reference cards that fit a request (at most `max`, best keyword match first). */
export function domainCards(text: string, max = 2) {
  const scored = CARDS.map((c) => ({ c, n: (text.match(new RegExp(c.words.source, "gi")) ?? []).length })).filter((x) => x.n > 0);
  scored.sort((a, b) => b.n - a.n);
  return scored.slice(0, max).map((x) => x.c);
}

/** Prompt block with the matching cards, or "" when nothing matches. */
export function domainHint(text: string) {
  const cards = domainCards(text);
  return cards.length ? `\nReal numbers you can rely on (use them, keep their units):\n${cards.map((c) => c.text).join("\n")}\n` : "";
}
