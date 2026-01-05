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
    'http_req_duration': ['p(95)<600'], // 95% requests under 600ms
    'failed_signups': ['rate<0.2'],     // less than 20% failed, safer for preview
  },
};

// ────────────────
// Preview URL
// ────────────────
const BASE_URL = 'https://staging.rootfleet-waitlist.pages.dev'; // no trailing slash

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
  const successful = data.metrics.successful_signups?.count || 0;
  const failed = data.metrics.failed_signups?.count || 0;

  const latencyValues = data.metrics.request_latency_ms?.values || {};
  const minLatency = latencyValues.min || 0;
  const maxLatency = latencyValues.max || 0;
  const avgLatency = latencyValues.avg || 0;

  console.log('========== Load Test Summary ==========');
  console.log(`Total successful signups: ${successful}`);
  console.log(`Total failed signups: ${failed}`);
  console.log(`Min latency (ms): ${minLatency.toFixed(2)}`);
  console.log(`Max latency (ms): ${maxLatency.toFixed(2)}`);
  console.log(`Avg latency (ms): ${avgLatency.toFixed(2)}`);
  console.log('======================================');

  return {}; // no HTML/json output, just console
}

