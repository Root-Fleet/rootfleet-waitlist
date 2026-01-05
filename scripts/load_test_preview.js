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
// Load test options with ramp-up stages
// ────────────────
export let options = {
  stages: [
    { duration: '10s', target: 10 },   // ramp up to 10 VUs
    { duration: '20s', target: 50 },   // ramp up to 50 VUs
    { duration: '30s', target: 100 },  // ramp up to 100 VUs
    { duration: '20s', target: 0 },    // ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<600'], // 95% requests under 600ms
    'failed_signups': ['rate<0.2'],     // less than 20% failed
  },
};

// ────────────────
// Preview URL
// ────────────────
const BASE_URL = 'https://staging.rootfleet-waitlist.pages.dev';

// ────────────────
// Utility function to generate unique emails
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

  // Parse response safely
  let json;
  try {
    json = res.json();
  } catch (e) {
    failCounter.add(1);
    console.log(`Failed to parse JSON for ${email}: ${res.status}`);
    return;
  }

  // Check for successful signup
  const success = check(res, {
    'status is joined': () =>
      res.status === 200 && (json.status === 'joined' || json.status === 'already_joined'),
  });

  if (success) {
    successCounter.add(1);
  } else {
    failCounter.add(1);
    console.log(`Failed request for ${email}: ${res.status} - ${res.body.slice(0, 100)}`);
  }

  // Realistic user think time: 0.5–2.5s
  sleep(0.5 + Math.random() * 2);
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

