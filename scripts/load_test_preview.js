import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';

// ────────────────
// Custom metrics
// ────────────────
export let latencyTrend = new Trend('request_latency_ms', true);
export let successCounter = new Counter('successful_signups');
export let failCounter = new Counter('failed_signups');

// ────────────────
// Load test options
// ────────────────
export let options = {
  vus: 10,           // 10 virtual users
  duration: '30s',   // run for 30 seconds
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% requests under 500ms
    'failed_signups': ['rate<0.1'],    // less than 10% failed
  },
};

// ────────────────
// Preview URL
// ────────────────
const BASE_URL = 'https://staging.rootfleet-waitlist.pages.dev/';

// ────────────────
// Utility function
// ────────────────
function generateEmail() {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1000);
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
    companyName: 'TestCorp',
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(`${BASE_URL}/api/waitlist`, payload, params);

  // Measure latency
  latencyTrend.add(res.timings.duration);

  // Check status
  const success = check(res, {
    'status is 200 or already_joined': (r) =>
      r.status === 200 && (r.json().status === 'joined' || r.json().status === 'already_joined'),
  });

  if (success) {
    successCounter.add(1);
  } else {
    failCounter.add(1);
    console.log(`Failed request for ${email}: ${res.status} - ${res.body.slice(0, 100)}`);
  }

  // Small sleep to simulate realistic signup pace
  sleep(Math.random() * 0.5); // 0–500ms
}

// ────────────────
// Summary on test end
// ────────────────
export function handleSummary(data) {
  console.log('========== Load Test Summary ==========');
  console.log(`Total successful signups: ${data.metrics.successful_signups.count}`);
  console.log(`Total failed signups: ${data.metrics.failed_signups.count}`);
  console.log(`Min latency (ms): ${data.metrics.request_latency_ms.min}`);
  console.log(`Max latency (ms): ${data.metrics.request_latency_ms.max}`);
  console.log(`Avg latency (ms): ${data.metrics.request_latency_ms.avg}`);
  console.log('======================================');

  return {}; // no HTML/json file output, just console
}
