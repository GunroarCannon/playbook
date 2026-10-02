// Smoke test for Walrus Memory credentials: node scripts/check-memwal.mjs
// Reads .env.local, verifies the key, then does remember -> wait -> recall in a scratch namespace.
import { readFileSync } from "node:fs";
import { MemWal, delegateKeyToPublicKey } from "@mysten-incubation/memwal";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const key = env.MEMWAL_PRIVATE_KEY;
const accountId = env.MEMWAL_ACCOUNT_ID;
const serverUrl = process.argv[2] || env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz";
if (!key || !accountId) {
  console.error("MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID must be set in .env.local");
  process.exit(1);
}

const pub = await delegateKeyToPublicKey(key);
const pubHex = typeof pub === "string" ? pub : Buffer.from(pub).toString("hex");
console.log("derived public key:", pubHex);
if (process.env.EXPECT_PUB && !pubHex.includes(process.env.EXPECT_PUB)) console.warn("!! does not match the expected public key");

const mw = MemWal.create({ key, accountId, serverUrl, namespace: "pb-smoketest" });
const t = (label, t0) => console.log(`${label}: ${((performance.now() - t0) / 1000).toFixed(2)}s`);

let t0 = performance.now();
console.log("compatibility:", JSON.stringify(await mw.compatibility()).slice(0, 200));
t("compatibility", t0);

t0 = performance.now();
const text = `[NOTE] Playbook smoke test at ${new Date().toISOString()}: the bridge held 6.2kg.`;
const job = await mw.remember(text, "pb-smoketest");
t("remember accepted", t0);
console.log("job:", job);

t0 = performance.now();
const done = await mw.waitForRememberJob(job.job_id, { timeoutMs: 120000, pollIntervalMs: 1000 });
t("remember done (embedded+encrypted+uploaded)", t0);
console.log("result:", done);

t0 = performance.now();
const r = await mw.recall({ query: "how much did the bridge hold?", namespace: "pb-smoketest", limit: 3 });
t("recall", t0);
console.log(r.results.map((x) => `${x.distance.toFixed(3)}  ${x.text}`).join("\n"));

t0 = performance.now();
const ns = await mw.listNamespaces();
t("listNamespaces", t0);
console.log(ns.namespaces.map((n) => `${n.name}: ${n.memory_count}`).join("\n"));
mw.destroy();
