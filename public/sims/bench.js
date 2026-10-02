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

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
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

    text(str, x, y, o = {}) {
      ctx.fillStyle = o.color || C.ink;
      ctx.font = `${o.size || 14}px ${o.mono ? "'JetBrains Mono', monospace" : "'Architects Daughter', 'Comic Sans MS', cursive"}`;
      ctx.textAlign = o.align || "left"; ctx.textBaseline = o.baseline || "alphabetic";
      if (o.rotate) { ctx.save(); ctx.translate(x, y); ctx.rotate(o.rotate); ctx.fillText(str, 0, 0); ctx.restore(); }
      else ctx.fillText(str, x, y);
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
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

    lerp: (a, b, t) => a + (b - a) * t,
    clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    ease: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  };

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
