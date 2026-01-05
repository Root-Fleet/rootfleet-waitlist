import { sleep } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';

// ────────────────
// Custom metrics
// ────────────────
export let latencyTrend = new Trend('request_latency_ms', true);
export let successCounter = new Counter('successful_signups');
export let failCounter = new Counter('failed_signups');

// ────────────────
// Load test options for stress test
// ────────────────
export let options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '30s', target: 200 },
    { duration: '30s', target: 400 },
    { duration: '30s', target: 600 },
    { duration: '30s', target: 800 },
    { duration: '30s', target: 1000 },
    { duration: '30s', target: 0 }, // ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<1000'], // 95% requests under 1s
    'failed_signups': ['rate<0.3'],     // less than 30% failed
  },
};

// ────────────────
// Preview URL
// ────────────────
const BASE_URL = 'https://staging.rootfleet-waitlist.pages.dev';

// ────────────────
// Generate unique emails
// ────────────────
function generateEmail() {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 10000);
  return `loadtest+${ts}${rand}@example.com`;
}

// ────────────────
// Main test
// ────────────────
export default function () {
  const email = generateEmail();

  const payload = JSON.stringify({
    email,
    role: 'fleet_owner',
    fleetSize: '1-5',
    companyName: 'StressCorp',
  });

  const params = { headers: { 'Content-Type': 'application/json' } };
  const res = http.post(`${BASE_URL}/api/waitlist`, payload, params);

  // Measure latency
  latencyTrend.add(res.timings.duration);

  // Parse JSON safely
  let json;
  try {
    json = res.json();
  } catch (e) {
    failCounter.add(1);
    return;
  }

  // Increment counters
  if (res.status === 200 && (json.status === 'joined' || json.status === 'already_joined')) {
    successCounter.add(1);
  } else {
    failCounter.add(1);
  }

  // Aggressive think time
  sleep(0.1 + Math.random() * 0.4); // 0.1–0.5s
}

// ────────────────
// Summary
// ────────────────
export function handleSummary(data) {
  const successful = data.metrics.successful_signups?.count || 0;
  const failed = data.metrics.failed_signups?.count || 0;
  const latencyValues = data.metrics.request_latency_ms?.values || {};
  const minLatency = latencyValues.min || 0;
  const maxLatency = latencyValues.max || 0;
  const avgLatency = latencyValues.avg || 0;

  console.log('========== Stress Test Summary ==========');
  console.log(`Total successful signups: ${successful}`);
  console.log(`Total failed signups: ${failed}`);
  console.log(`Min latency (ms): ${minLatency.toFixed(2)}`);
  console.log(`Max latency (ms): ${maxLatency.toFixed(2)}`);
  console.log(`Avg latency (ms): ${avgLatency.toFixed(2)}`);
  console.log('========================================');

  return {};
}
