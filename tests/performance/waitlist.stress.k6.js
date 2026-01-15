// tests/performance/waitlist.stress.k6.js
import { sleep } from "k6";
import http from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";

export const latencyTrend = new Trend("request_latency_ms", true);
export const successCounter = new Counter("successful_signups");
export const failedRate = new Rate("failed_signups_rate");

const BASE_URL = __ENV.BASE_URL || "https://staging.rootfleet-waitlist.pages.dev";

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "30s", target: 200 },
    { duration: "30s", target: 400 },
    { duration: "30s", target: 600 },
    { duration: "30s", target: 800 },
    { duration: "30s", target: 1000 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"], // you can relax this for stress if needed
    failed_signups_rate: ["rate<0.3"], // allow higher failures under stress (<30%)
  },
};

function generateEmail() {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 10000);
  return `loadtest+${ts}${rand}@example.com`;
}

export default function () {
  const email = generateEmail();
  const payload = JSON.stringify({
    email,
    role: "fleet_owner",
    fleetSize: "1-5",
    companyName: "StressCorp",
  });

  const res = http.post(`${BASE_URL}/api/waitlist`, payload, {
    headers: { "Content-Type": "application/json" },
  });

  latencyTrend.add(res.timings.duration);

  let json;
  try {
    json = res.json();
  } catch {
    failedRate.add(1);
    sleep(0.1 + Math.random() * 0.4);
    return;
  }

  const ok =
    res.status === 200 &&
    (json.status === "joined" || json.status === "already_joined");

  if (ok) {
    successCounter.add(1);
    failedRate.add(0);
  } else {
    failedRate.add(1);
  }

  sleep(0.1 + Math.random() * 0.4);
}

export function handleSummary(data) {
  const successful = data.metrics.successful_signups?.count || 0;

  // Rate doesn't have a "count" the same way a Counter does,
  // but k6 provides "rate" (0..1) and often "passes"/"fails" depending on version/output.
  const failRateValue = data.metrics.failed_signups_rate?.values?.rate ?? null;

  const latencyValues = data.metrics.request_latency_ms?.values || {};
  const minLatency = latencyValues.min || 0;
  const maxLatency = latencyValues.max || 0;
  const avgLatency = latencyValues.avg || 0;

  console.log("========== Stress Test Summary ==========");
  console.log(`Total successful signups: ${successful}`);

  if (failRateValue === null) {
    console.log("Failed signup rate: (not available in summary output)");
  } else {
    console.log(`Failed signup rate: ${(failRateValue * 100).toFixed(2)}%`);
  }

  console.log(`Min latency (ms): ${minLatency.toFixed(2)}`);
  console.log(`Max latency (ms): ${maxLatency.toFixed(2)}`);
  console.log(`Avg latency (ms): ${avgLatency.toFixed(2)}`);
  console.log("========================================");

  return {};
}
