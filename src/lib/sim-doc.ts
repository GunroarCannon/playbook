import type { ParamValue } from "./sims";

/**
 * Wrap an AI-written sim script in a full HTML document for a sandboxed iframe (srcDoc).
 *
 * The iframe has sandbox="allow-scripts" and no allow-same-origin, so the script gets an opaque origin:
 * no cookies, no access to the app. The CSP also blocks network calls; only the shared drawing kit
 * (bench.js) and the notebook fonts can load.
 */
export function buildSimDoc(code: string, defaults: Record<string, ParamValue>, origin: string) {
  const safeCode = code.replace(/<\/script/gi, "<\\/script");
  const head = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' ${origin}; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:" />
<link href="https://fonts.googleapis.com/css2?family=Architects+Daughter&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
<style>html,body{margin:0;height:100%;overflow:hidden}canvas{display:block;width:100%;height:100%}</style>
</head>
<body>
<canvas id="simCanvas"></canvas>
<script>
window.addEventListener("error", function (e) {
  var line = e.lineno ? " (line " + Math.max(1, e.lineno - __CODE_LINE__ + 1) + ")" : "";
  parent.postMessage({ type: "SIM_ERROR", message: String(e.message || "script error") + line }, "*");
});
</script>
<script src="${origin}/sims/bench.js"></script>
<script>
const PARAMS = ${JSON.stringify(defaults)};
`;
  const codeLine = head.split("\n").length; // 1-based line where the AI's code starts
  return head.replace("__CODE_LINE__", String(codeLine)) + safeCode + "\n</script>\n</body>\n</html>\n";
}
