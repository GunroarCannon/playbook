/*
 * bench.js — shared helpers for Playbook's hand-built sims.
 * Implements the host <-> sim postMessage protocol (src/lib/protocol.ts) and
 * a small "inventor's notebook" drawing kit for <canvas>.
 *
 * A sim calls Bench.init({ params, onParams, onRun, onReset, draw }).
 */
(function () {
  const LIGHT = {
    paper: "#fbfaf6", minor: "rgba(46,62,92,0.085)", major: "rgba(46,62,92,0.17)",
    ink: "#1d1f24", ink2: "#4a4f5a", ink3: "#8a8f99", navy: "#23336b",
    red: "#d9381e", blue: "#0969da", amber: "#c98a12", green: "#2e7d4f", fill: "#f2f1ec",
  };
  const DARK = {
    paper: "#161d28", minor: "rgba(88,166,255,0.07)", major: "rgba(88,166,255,0.15)",
    ink: "#e6edf3", ink2: "#b3bfcc", ink3: "#6f7d8e", navy: "#8cb8ff",
    red: "#ff6b5a", blue: "#58a6ff", amber: "#e3b341", green: "#56d364", fill: "#1a2230",
  };

  const qs = new URLSearchParams(location.search);
  let C = qs.get("theme") === "dark" ? DARK : LIGHT;

  const canvas = document.getElementById("simCanvas");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, DPR = 1;

  // Sims are laid out for at least MIN_W px. On a phone the drawing is laid out at MIN_W and scaled down,
  // so labels shrink instead of running into each other.
  const MIN_W = 500;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const k = cw > 0 && cw < MIN_W ? cw / MIN_W : 1;
    W = cw / k; H = ch / k;
    canvas.width = Math.round(cw * DPR); canvas.height = Math.round(ch * DPR);
    ctx.setTransform(DPR * k, 0, 0, DPR * k, 0, 0);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // ---------- deterministic randomness (so sketchy lines don't shimmer) ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(...xs) {
    let h = 2166136261;
    for (const x of xs) {
      const s = String(x);
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    }
    return h >>> 0;
  }

  // ---------- drawing kit ----------
  const D = {
    get W() { return W; }, get H() { return H; }, get C() { return C; }, ctx,
    rng: mulberry32, hash,

    grid() {
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
      ctx.lineWidth = 1;
      ctx.strokeStyle = C.minor; ctx.beginPath();
      for (let x = 0.5; x < W; x += 10) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0.5; y < H; y += 10) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      ctx.strokeStyle = C.major; ctx.beginPath();
      for (let x = 0.5; x < W; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0.5; y < H; y += 50) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      // coordinate ticks along the top and left edges
      ctx.fillStyle = C.ink3; ctx.font = "9px 'JetBrains Mono', monospace";
      for (let x = 50, i = 1; x < W; x += 50, i++) ctx.fillText(String(i), x + 2, 10);
      for (let y = 50, i = 1; y < H; y += 50, i++) ctx.fillText(String(i), 2, y - 2);
    },

    /** Hand-inked line: two slightly offset strokes with a gentle bow. seed keeps it stable across frames. */
    line(x1, y1, x2, y2, o = {}) {
      const r = mulberry32(o.seed ?? hash(x1 | 0, y1 | 0, x2 | 0, y2 | 0));
      const rough = o.rough ?? 1;
      ctx.strokeStyle = o.color || C.ink; ctx.lineWidth = o.width || 1.6; ctx.lineCap = "round";
      if (o.dash) ctx.setLineDash(o.dash);
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
      const passes = o.single ? 1 : 2;
      for (let p = 0; p < passes; p++) {
        const j = () => (r() - 0.5) * 1.6 * rough;
        const bow = (r() - 0.5) * Math.min(3, len / 60) * rough;
        const mx = (x1 + x2) / 2 + nx * bow, my = (y1 + y2) / 2 + ny * bow;
        ctx.globalAlpha = (o.alpha ?? 1) * (p === 0 ? 1 : 0.55);
        ctx.beginPath();
        ctx.moveTo(x1 + j(), y1 + j());
        ctx.quadraticCurveTo(mx + j(), my + j(), x2 + j(), y2 + j());
        ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.setLineDash([]);
    },

    rect(x, y, w, h, o = {}) {
      if (o.fill) { ctx.fillStyle = o.fill; ctx.globalAlpha = o.fillAlpha ?? 1; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
      if (o.hatch) D.hatch(x, y, w, h, o.hatchColor || C.ink, o.hatchGap || 6);
      const s = o.seed ?? hash(x | 0, y | 0, w | 0);
      D.line(x, y, x + w, y, { ...o, seed: s + 1 });
      D.line(x + w, y, x + w, y + h, { ...o, seed: s + 2 });
      D.line(x + w, y + h, x, y + h, { ...o, seed: s + 3 });
      D.line(x, y + h, x, y, { ...o, seed: s + 4 });
    },

    circle(cx, cy, rad, o = {}) {
      const r = mulberry32(o.seed ?? hash(cx | 0, cy | 0, rad | 0));
      if (o.fill) { ctx.fillStyle = o.fill; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = o.color || C.ink; ctx.lineWidth = o.width || 1.6;
      ctx.beginPath();
      const start = r() * Math.PI * 2, steps = 28;
      for (let i = 0; i <= steps + 2; i++) {
        const a = start + (i / steps) * Math.PI * 2;
        const rr = rad + (r() - 0.5) * 1.2 * (o.rough ?? 1);
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    },

    hatch(x, y, w, h, color, gap = 6) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.strokeStyle = color || C.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -h; i < w; i += gap) { ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); }
      ctx.stroke(); ctx.restore();
    },

    /** o.maxW: shrink the font (down to 70%) and then cut the text with "…" so it never runs past maxW px. Returns { w, size }. */
    text(str, x, y, o = {}) {
      str = String(str);
      let size = o.size || 14;
      const font = (s) => `${s}px ${o.mono ? "'JetBrains Mono', monospace" : "'Architects Daughter', 'Comic Sans MS', cursive"}`;
      ctx.font = font(size);
      if (o.maxW > 0 && ctx.measureText(str).width > o.maxW) {
        const min = Math.max(9, Math.round(size * 0.7));
        while (size > min && ctx.measureText(str).width > o.maxW) ctx.font = font(--size);
        if (ctx.measureText(str).width > o.maxW) {
          while (str.length > 1 && ctx.measureText(str + "…").width > o.maxW) str = str.slice(0, -1);
          str += "…";
        }
      }
      ctx.fillStyle = o.color || C.ink;
      ctx.textAlign = o.align || "left"; ctx.textBaseline = o.baseline || "alphabetic";
      if (o.rotate) { ctx.save(); ctx.translate(x, y); ctx.rotate(o.rotate); ctx.fillText(str, 0, 0); ctx.restore(); }
      else ctx.fillText(str, x, y);
      const w = ctx.measureText(str).width;
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      return { w, size };
    },

    // ---------- layout kit (mainly for AI-built sims; mirrored by the stub in src/lib/sim-check.ts, keep in sync) ----------

    /**
     * Split the canvas into regions that never overlap, so nothing has to be placed for one canvas size.
     * o: { side: share of the body for a chart/readout panel (0 = none, default 0.42), header: false, footer: false }
     * Returns { header, stage, side (null when side is 0), footer }; each is { x, y, w, h, cx, cy, r, b }.
     * Wide canvas: stage left, side right. Narrow/tall canvas: stage on top, side below.
     */
    layout(o = {}) {
      const R = (x, y, w, h) => ({ x, y, w, h, cx: x + w / 2, cy: y + h / 2, r: x + w, b: y + h });
      const side = D.clamp(o.side ?? 0.42, 0, 0.7), gap = 18, x0 = 20, x1 = W - 14;
      const headH = o.header === false ? 0 : 28, footH = o.footer === false ? 0 : 20;
      const header = R(x0, 14, x1 - x0, headH);
      const top = 14 + headH + 6, bottom = H - footH - 6;
      const footer = R(x0, H - footH - 2, x1 - x0, footH);
      const bw = x1 - x0, bh = Math.max(40, bottom - top);
      if (side <= 0) return { header, stage: R(x0, top, bw, bh), side: null, footer };
      if (W / H >= 1.15) {
        const sw = Math.round((bw - gap) * side);
        return { header, stage: R(x0, top, bw - gap - sw, bh), side: R(x1 - sw, top, sw, bh), footer };
      }
      const sh = Math.round((bh - gap) * side);
      return { header, stage: R(x0, top, bw, bh - gap - sh), side: R(x0, bottom - sh, bw, sh), footer };
    },

    /** Format a number for display: 3 significant figures, thousands separators, scientific for tiny/huge. Never NaN. */
    fmt(v, sig = 3) {
      v = +v;
      if (!Number.isFinite(v)) return "–";
      const a = Math.abs(v);
      if (a !== 0 && (a < 1e-3 || a >= 1e7)) return v.toExponential(Math.max(0, sig - 1)).replace("e+", "e");
      if (a >= 1000) return Math.round(v).toLocaleString("en-US");
      return String(+v.toPrecision(sig));
    },

    /** Chemical notation: "2H2 + O2 -> 2H2O" becomes "2H₂ + O₂ → 2H₂O"; charges with ^: "Fe^3+" -> "Fe³⁺"; "<=>" -> "⇌". */
    chem(s) {
      const SUB = "₀₁₂₃₄₅₆₇₈₉", SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "+": "⁺", "-": "⁻" };
      return String(s)
        .replace(/<=>/g, "⇌").replace(/->|=>/g, "→")
        .replace(/\^(\d*[+-])/g, (_, c) => [...c].map((ch) => SUP[ch]).join(""))
        .replace(/([A-Za-z)\]])(\d+)/g, (_, a, d) => a + [...d].map((ch) => SUB[+ch]).join(""));
    },

    /**
     * Stacked readout lines inside a box: items = [[label, value, color?], ...] (falsy items are skipped).
     * With o.w the label sits left and the value right-aligned at x + w; otherwise "label: value". Returns the height used.
     */
    readouts(x, y, items, o = {}) {
      const size = o.size || 13, lh = size + 7;
      let n = 0;
      for (const it of items) {
        if (!it) continue;
        const [label, value, color] = Array.isArray(it) ? it : [String(it), ""];
        const by = y + size + n * lh;
        if (o.w) {
          const vw = value === "" || value == null ? 0 : D.text(String(value), x + o.w, by, { size, mono: true, align: "right", color: color || C.ink, maxW: o.w * 0.6 }).w;
          D.text(label, x, by, { size: size - 1, color: C.ink2, maxW: Math.max(24, o.w - vw - 8) });
        } else D.text(value === "" || value == null ? label : `${label}: ${value}`, x, by, { size, color: color || C.ink, maxW: o.maxW });
        n++;
      }
      return n * lh;
    },

    /**
     * Line chart that fits inside box b = { x, y, w, h } (e.g. a region from D.layout), with ticks, labels and a legend.
     * series: [{ data: [y0, y1, ...] or [[x, y], ...], color, label, dash, width }]
     * o: { title, xLabel, xMin, xMax, yMin, yMax, target, targetLabel, upto (0..1: how much of each series to draw, for animation) }
     * Returns { X(x), Y(y), plot } so extra marks can be drawn on the same axes.
     */
    chart(b, series, o = {}) {
      const pts = series.map((s) => (s.data || []).map((d, i, a) => (Array.isArray(d) ? [+d[0], +d[1]] : [o.xMax != null ? (o.xMin ?? 0) + (i / Math.max(1, a.length - 1)) * (o.xMax - (o.xMin ?? 0)) : i, +d])));
      const all = pts.flat().filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
      let xMin = o.xMin ?? Math.min(...all.map((p) => p[0]), 0), xMax = o.xMax ?? Math.max(...all.map((p) => p[0]), 1);
      let yMin = o.yMin ?? Math.min(0, ...all.map((p) => p[1])), yMax = o.yMax ?? Math.max(...all.map((p) => p[1]), o.target ?? -Infinity, 1e-9) * 1.08;
      if (!(xMax > xMin)) xMax = xMin + 1;
      if (!(yMax > yMin)) yMax = yMin + 1;
      const head = o.title ? 18 : 6;
      const plot = { x: b.x + 40, y: b.y + head, w: Math.max(20, b.w - 48), h: Math.max(20, b.h - head - (o.xLabel ? 32 : 18)) };
      const X = (v) => plot.x + ((v - xMin) / (xMax - xMin)) * plot.w, Y = (v) => plot.y + plot.h - ((v - yMin) / (yMax - yMin)) * plot.h;
      if (o.title) D.text(o.title, b.x, b.y + 12, { size: 12, color: C.ink2, maxW: b.w });
      D.line(plot.x, plot.y + plot.h, plot.x + plot.w, plot.y + plot.h, { width: 1.2, single: true, rough: 0.3 });
      D.line(plot.x, plot.y, plot.x, plot.y + plot.h, { width: 1.2, single: true, rough: 0.3 });
      const step = (span, n) => { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; };
      const ys = step(yMax - yMin, plot.h < 120 ? 3 : 4), xs = step(xMax - xMin, plot.w < 160 ? 3 : 5);
      for (let v = Math.ceil(yMin / ys) * ys; v <= yMax + 1e-9; v += ys) {
        D.text(D.fmt(v), plot.x - 5, Y(v) + 3, { size: 10, mono: true, align: "right", color: C.ink3, maxW: 34 });
        D.line(plot.x - 3, Y(v), plot.x, Y(v), { width: 1, single: true, rough: 0 });
      }
      for (let v = Math.ceil(xMin / xs) * xs; v <= xMax + 1e-9; v += xs) D.text(D.fmt(v), X(v), plot.y + plot.h + 13, { size: 10, mono: true, align: "center", color: C.ink3 });
      if (o.xLabel) D.text(o.xLabel, plot.x + plot.w / 2, plot.y + plot.h + 28, { size: 11, align: "center", color: C.ink2, maxW: plot.w });
      if (o.target != null && Number.isFinite(+o.target)) {
        const ty = Y(+o.target);
        D.line(plot.x, ty, plot.x + plot.w, ty, { color: C.red, dash: [5, 4], width: 1.3, single: true, rough: 0 });
        if (o.targetLabel) {
          // label the end of the line the data stays farthest from, so the curve doesn't run through it
          const p0 = pts[0] || [], a = p0[0], b = p0[p0.length - 1];
          const left = a && b && Math.abs(a[1] - o.target) > Math.abs(b[1] - o.target);
          D.text(o.targetLabel, left ? plot.x + 6 : plot.x + plot.w - 4, ty > plot.y + 16 ? ty - 5 : ty + 13, { size: 11, color: C.red, align: left ? "left" : "right", maxW: plot.w * 0.6 });
        }
      }
      ctx.save(); ctx.beginPath(); ctx.rect(plot.x, plot.y - 2, plot.w + 2, plot.h + 4); ctx.clip();
      const upto = o.upto ?? 1;
      series.forEach((s, k) => {
        const p = pts[k], n = Math.max(1, Math.round(upto * p.length));
        if (!p.length) return;
        ctx.strokeStyle = s.color || [C.navy, C.amber, C.green, C.blue, C.red][k % 5]; ctx.lineWidth = s.width || 2;
        if (s.dash) ctx.setLineDash(s.dash);
        ctx.beginPath();
        for (let i = 0; i < n; i++) i ? ctx.lineTo(X(p[i][0]), Y(p[i][1])) : ctx.moveTo(X(p[i][0]), Y(p[i][1]));
        ctx.stroke(); ctx.setLineDash([]);
        if (upto < 1) { ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(X(p[n - 1][0]), Y(p[n - 1][1]), 3.5, 0, Math.PI * 2); ctx.fill(); }
      });
      ctx.restore();
      const named = series.filter((s) => s.label);
      named.forEach((s, k) => {
        const ly = plot.y + 10 + k * 15, col = s.color || [C.navy, C.amber, C.green, C.blue, C.red][series.indexOf(s) % 5];
        D.line(plot.x + 8, ly - 4, plot.x + 24, ly - 4, { color: col, width: 2.2, single: true, rough: 0, dash: s.dash });
        D.text(s.label, plot.x + 29, ly, { size: 11, color: C.ink2, maxW: plot.w * 0.55 });
      });
      return { X, Y, plot };
    },

    /**
     * Lab glassware / containers with liquid. x, y = top-left, w x h = outer size.
     * o: { kind: "beaker"|"flask"|"tube"|"cylinder"|"tank", level 0..1, liquid (colour), alpha, bubbles 0..1 (fizz rate), t (seconds), marks (graduations), label (below) }
     */
    vessel(x, y, w, h, o = {}) {
      const kind = o.kind || "beaker", level = D.clamp(+o.level || 0, 0, 1), col = o.color || C.ink;
      const cx = x + w / 2, nw = w * 0.34, nh = h * 0.3, r = w / 2;
      const shape = () => {
        ctx.beginPath();
        if (kind === "flask") { ctx.moveTo(cx - nw / 2, y); ctx.lineTo(cx - nw / 2, y + nh); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(cx + nw / 2, y + nh); ctx.lineTo(cx + nw / 2, y); }
        else if (kind === "tube") { ctx.moveTo(x, y); ctx.lineTo(x, y + h - r); ctx.arc(cx, y + h - r, r, Math.PI, 0, true); ctx.lineTo(x + w, y); }
        else ctx.rect(x, y, w, h);
      };
      if (level > 0) {
        ctx.save(); shape(); ctx.closePath(); ctx.clip();
        const top = y + h - h * level;
        ctx.fillStyle = o.liquid || C.blue; ctx.globalAlpha = o.alpha ?? 0.35; ctx.fillRect(x - 2, top, w + 4, h * level + 2); ctx.globalAlpha = 1;
        if (o.bubbles > 0) {
          const rr = D.rng(17), n = Math.round(4 + o.bubbles * 18), t = o.t || 0;
          ctx.strokeStyle = o.liquid || C.blue; ctx.lineWidth = 1.2;
          for (let i = 0; i < n; i++) {
            const bx = x + w * (0.2 + 0.6 * rr()), ph = (t * (0.5 + o.bubbles) + rr()) % 1, by = y + h - 4 - ph * (h * level - 6);
            if (by > top) { ctx.beginPath(); ctx.arc(bx + Math.sin(t * 3 + i) * 2, by, 1.5 + rr() * 2.5, 0, Math.PI * 2); ctx.stroke(); }
          }
        }
        ctx.restore();
        // surface line, as wide as the vessel is at that height
        const sy = y + h - h * level;
        let half = w / 2 - 3;
        if (kind === "flask") half = sy < y + nh ? nw / 2 - 2 : nw / 2 + (w / 2 - nw / 2) * ((sy - y - nh) / (h - nh)) - 3;
        else if (kind === "tube" && sy > y + h - r) half = Math.sqrt(Math.max(0, r * r - (sy - (y + h - r)) ** 2)) - 2;
        if (half > 2) D.line(cx - half, sy, cx + half, sy, { color: o.liquid || C.blue, width: 1.2, single: true, rough: 0.4 });
      }
      if (kind === "flask") {
        D.line(cx - nw / 2, y, cx - nw / 2, y + nh, { color: col }); D.line(cx - nw / 2, y + nh, x, y + h, { color: col });
        D.line(x, y + h, x + w, y + h, { color: col }); D.line(x + w, y + h, cx + nw / 2, y + nh, { color: col });
        D.line(cx + nw / 2, y + nh, cx + nw / 2, y, { color: col });
      } else if (kind === "tube") {
        D.line(x, y, x, y + h - r, { color: col }); D.line(x + w, y, x + w, y + h - r, { color: col });
        ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, y + h - r, r, Math.PI, 0, true); ctx.stroke();
      } else {
        D.line(x, y, x, y + h, { color: col }); D.line(x, y + h, x + w, y + h, { color: col }); D.line(x + w, y + h, x + w, y, { color: col });
        if (kind === "tank") D.line(x, y, x + w, y, { color: col });
        else D.line(x - 5, y - 3, x, y, { color: col, single: true });
        if (kind === "cylinder") D.line(x - 8, y + h + 4, x + w + 8, y + h + 4, { color: col, width: 2 });
      }
      if (o.marks || kind === "cylinder") for (let k = 1; k < 10; k++) {
        const my = y + h - (h * k) / 10, inset = kind === "flask" ? (w / 2 - nw / 2) * Math.max(0, (nh - (my - y)) / nh) : 0;
        if (kind === "flask" && my < y + nh) continue;
        D.line(x + w - 4 - inset - (k % 5 ? 6 : 12), my, x + w - 4 - inset, my, { color: C.ink3, width: 1, single: true, rough: 0 });
      }
      if (o.label) D.text(o.label, cx, y + h + (kind === "cylinder" ? 22 : 18), { size: 12, align: "center", color: C.ink2, maxW: Math.max(w + 40, 60) });
      return { w, h };
    },

    /** Dimension line with arrowheads and a label, like a technical drawing. */
    dim(x1, y1, x2, y2, label, o = {}) {
      const col = o.color || C.ink2;
      D.line(x1, y1, x2, y2, { color: col, width: 1, single: true, rough: 0.3 });
      const a = Math.atan2(y2 - y1, x2 - x1), s = 6;
      for (const [x, y, dir] of [[x1, y1, 0], [x2, y2, Math.PI]]) {
        ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(x + Math.cos(a + dir + 0.4) * s, y + Math.sin(a + dir + 0.4) * s);
        ctx.lineTo(x, y);
        ctx.lineTo(x + Math.cos(a + dir - 0.4) * s, y + Math.sin(a + dir - 0.4) * s);
        ctx.stroke();
      }
      if (label) D.text(label, (x1 + x2) / 2, (y1 + y2) / 2 - 5, { size: 12, color: col, align: "center", mono: true });
    },

    /** Rubber-stamp text: PASSED / FAILED */
    stamp(str, x, y, color, rot = -0.08) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.font = "26px 'Architects Daughter', cursive"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const w = ctx.measureText(str).width + 26;
      ctx.globalAlpha = 0.88; ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.strokeRect(-w / 2, -20, w, 40); ctx.lineWidth = 1; ctx.strokeRect(-w / 2 + 4, -16, w - 8, 32);
      ctx.fillStyle = color; ctx.fillText(str, 0, 2);
      ctx.restore();
    },

    ground(x1, x2, y) {
      D.line(x1, y, x2, y, { width: 2 });
      ctx.strokeStyle = C.ink; ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = x1; x < x2; x += 8) { ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 8); }
      ctx.stroke(); ctx.globalAlpha = 1;
    },

    /**
     * Draw an icon from the pack (icons.js: Font Awesome Free + hand-drawn extras) like a game sprite.
     * x, y = centre (or bottom-centre with anchor:"bottom"); size = height in px.
     * o: { color, alpha, rotate (radians), flip (mirror left-right), outline, label, anchor }
     * Unknown names never crash: they become a labelled token. Returns the drawn width and height.
     */
    icon(name, x, y, size = 32, o = {}) {
      const data = iconData(name);
      if (!data) {
        if (!window.PB_ICONS) { loadIcons(); D.token("", x, o.anchor === "bottom" ? y - size / 2 : y, size, { color: C.ink3, caption: false }); return { w: size, h: size }; }
        return D.token(String(name), x, o.anchor === "bottom" ? y - size / 2 : y, size, o);
      }
      const [w, h, d] = data;
      const s = size / h;
      const cy = o.anchor === "bottom" ? y - size / 2 : y;
      ctx.save();
      ctx.translate(x, cy);
      if (o.rotate) ctx.rotate(o.rotate);
      ctx.scale(o.flip ? -s : s, s);
      ctx.translate(-w / 2, -h / 2);
      ctx.globalAlpha = o.alpha ?? 1;
      ctx.fillStyle = o.color || C.ink;
      ctx.strokeStyle = o.color || C.ink;
      ctx.lineWidth = 1.6 / s; ctx.lineJoin = "round";
      for (const p of iconPaths(name, d)) {
        if (o.outline) { ctx.globalAlpha = (o.alpha ?? 1) * 0.15; ctx.fill(p); ctx.globalAlpha = o.alpha ?? 1; ctx.stroke(p); }
        else ctx.fill(p);
      }
      ctx.restore();
      if (o.label) D.text(o.label, x, cy + size / 2 + 13, { size: 11, align: "center", color: o.color || C.ink2 });
      return { w: w * s, h: size };
    },

    /** Is this icon in the pack? (false until icons.js has loaded) */
    hasIcon: (name) => !!iconData(name),

    /**
     * Stick figure standing on (x, y) (feet), h px tall.
     * o: { pose: "stand"|"walk"|"run"|"wave"|"sit"|"carry"|"lie"|"fall", t (seconds: animates walk/run/wave; for "fall" 0..1 = how far over),
     *      facing: 1 | -1, color, label, seed }
     */
    person(x, y, h = 40, o = {}) {
      const col = o.color || C.ink, f = o.facing === -1 ? -1 : 1, t = o.t ?? 0, pose = o.pose || "stand";
      const seed = o.seed ?? 7;
      const L = (x1, y1, x2, y2, k) => D.line(x1, y1, x2, y2, { color: col, width: Math.max(1.4, h / 26), single: true, rough: 0.5, seed: seed + k });
      if (pose === "lie" || pose === "fall") {
        // lying flat (or tipping over, rotated by how far into the fall)
        const a = pose === "fall" ? D.clamp(t, 0, 1) * Math.PI / 2 : Math.PI / 2;
        ctx.save(); ctx.translate(x, y); ctx.rotate(f * a); D.person(0, 0, h, { ...o, pose: "stand", label: undefined }); ctx.restore();
        if (o.label) D.text(o.label, x, y + 14, { size: 11, align: "center", color: o.color || C.ink2 });
        return;
      }
      const r = h * 0.12, hip = y - h * 0.45, neck = y - h * 0.78;
      const sitting = pose === "sit";
      const hipY = sitting ? y - h * 0.28 : hip, neckY = sitting ? hipY - h * 0.33 : neck;
      D.circle(x, neckY - r, r, { color: col, width: Math.max(1.4, h / 26), seed: seed + 9 });
      L(x, neckY, x, hipY, 1);
      // legs
      // standing figures keep a slight A-stance so both legs and arms show
      const swing = pose === "walk" ? Math.sin(t * 7) * 0.45 : pose === "run" ? Math.sin(t * 12) * 0.8 : 0.22;
      const leg = h * 0.45;
      if (sitting) {
        L(x, hipY, x + f * h * 0.25, hipY, 2); L(x + f * h * 0.25, hipY, x + f * h * 0.25, y, 3);
      } else {
        L(x, hipY, x + Math.sin(swing) * leg, hipY + Math.cos(swing) * leg, 2);
        L(x, hipY, x - Math.sin(swing) * leg, hipY + Math.cos(swing) * leg, 3);
      }
      // arms
      const sh = neckY + h * 0.06, arm = h * 0.32;
      if (pose === "wave") {
        const wob = Math.sin(t * 8) * arm * 0.25;
        L(x, sh, x + f * (arm * 0.55 + wob), sh - arm * 0.8, 4);
        L(x, sh, x - f * arm * 0.5, sh + arm * 0.85, 5);
      } else if (pose === "carry") {
        L(x, sh, x + f * arm * 0.8, sh + arm * 0.35, 4); L(x, sh, x + f * arm * 0.7, sh + arm * 0.5, 5);
      } else {
        const a = pose === "run" ? -swing * 1.2 : pose === "walk" ? -swing : 0.38;
        L(x, sh, x + Math.sin(a) * arm, sh + Math.cos(a) * arm, 4);
        L(x, sh, x - Math.sin(a) * arm, sh + Math.cos(a) * arm, 5);
      }
      if (o.label) D.text(o.label, x, y + 14, { size: 11, align: "center", color: o.color || C.ink2 });
    },

    /** A generic labelled token for anything without an icon: a hand-drawn circle with initials, caption below. */
    token(label, x, y, size = 32, o = {}) {
      const col = o.color || C.ink2, r = size / 2;
      D.circle(x, y, r, { color: col, fill: o.fill, seed: hash(label) });
      const words = String(label).trim().split(/[\s-]+/).filter(Boolean);
      const short = (words.length > 1 ? words.slice(0, 2).map((w) => w[0]).join("") : (words[0] || "?").slice(0, 3)).toUpperCase();
      D.text(short, x, y + 1, { size: Math.max(9, r * 0.75), align: "center", baseline: "middle", mono: true, color: col });
      if (o.caption !== false && label) D.text(o.label || String(label), x, y + r + 13, { size: 11, align: "center", color: col });
      return { w: size, h: size };
    },

    lerp: (a, b, t) => a + (b - a) * t,
    clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    ease: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  };

  // ---------- icon pack (lazy: only fetched the first time a sim draws an icon) ----------
  const ICON_SRC = (() => {
    try { return new URL("icons.js", document.currentScript.src).href; } catch { return "icons.js"; }
  })();
  let iconsRequested = false;
  function loadIcons() {
    if (iconsRequested || window.PB_ICONS) return;
    iconsRequested = true;
    const s = document.createElement("script");
    s.src = ICON_SRC;
    document.head.appendChild(s);
  }
  function iconData(name) {
    const pack = window.PB_ICONS;
    if (!pack) { loadIcons(); return null; }
    const n = String(name).toLowerCase().trim().replace(/^fa-/, "").replace(/\s+/g, "-");
    return pack[n] || pack[(window.PB_ICON_ALIASES || {})[n]] || pack[n.replace(/s$/, "")] || null;
  }
  const pathCache = new Map();
  function iconPaths(name, d) {
    let p = pathCache.get(name);
    if (!p) { p = (Array.isArray(d) ? d : [d]).map((x) => new Path2D(x)); pathCache.set(name, p); }
    return p;
  }

  // ---------- protocol ----------
  function post(msg) { window.parent.postMessage(msg, "*"); }

  window.Bench = {
    D,
    init(opts) {
      let params = { ...(opts.params || {}) };
      window.addEventListener("message", (e) => {
        const m = e.data || {};
        try {
          if (m.type === "UPDATE_PARAMS") { params = { ...params, ...m.params }; opts.onParams && opts.onParams(params); }
          else if (m.type === "RUN_TEST") opts.onRun && opts.onRun(params);
          else if (m.type === "RESET") opts.onReset && opts.onReset(params);
          else if (m.type === "SET_THEME") C = m.theme === "dark" ? DARK : LIGHT;
        } catch (err) { post({ type: "SIM_ERROR", message: String(err && err.message || err) }); }
      });
      let last = performance.now();
      function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        try { opts.draw(D, params, dt, now / 1000); }
        catch (err) { post({ type: "SIM_ERROR", message: String(err && err.message || err) }); return; }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      opts.onParams && opts.onParams(params);
      post({ type: "SIM_READY" });
    },
    metrics(payload) { post({ type: "SIM_METRICS", payload }); },
    result(payload) { post({ type: "SIM_RESULT", payload }); },
  };
})();
