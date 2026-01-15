const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) throw new Error("Missing BASE_URL");

const MAX_P95_MS = Number(process.env.MAX_P95_MS || 800);

async function timedFetch(path, opts = {}) {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const ms = Date.now() - start;
  return { res, ms };
}

function percentile(values, p) {
  const sorted = [...values].sort((a,b) => a-b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

(async () => {
  const samples = [];

  // 1) Health (or homepage)
  for (let i = 0; i < 10; i++) {
    const { res, ms } = await timedFetch("/api/health");
    if (!res.ok) throw new Error(`/api/health failed: ${res.status}`);
    samples.push(ms);
  }

  // 2) Count endpoint should be fast and stable
  for (let i = 0; i < 10; i++) {
    const { res, ms } = await timedFetch("/api/waitlist/count");
    if (!res.ok) throw new Error(`/api/waitlist/count failed: ${res.status}`);
    samples.push(ms);
  }

  // Compute p95
  const p95 = percentile(samples, 95);

  console.log(`Canary latency p95=${p95}ms (threshold ${MAX_P95_MS}ms)`);
  if (p95 > MAX_P95_MS) {
    throw new Error(`Canary failed: p95 too high (${p95}ms)`);
  }

  console.log("✅ Canary passed");
})().catch((err) => {
  console.error("❌ Canary failed");
  console.error(err?.stack || err);
  process.exit(1);
});
