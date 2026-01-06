// tests/performance/waitlist.load.k6.js
import { sleep } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';

export const latencyTrend = new Trend('request_latency_ms', true);
export const successCounter = new Counter('successful_signups');
export const failCounter = new Counter('failed_signups');

const BASE_URL = __ENV.BASE_URL || 'https://staging.rootfleet-waitlist.pages.dev';

export const options = {
  stages: [
    { duration: '1m', target: 25 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 25 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    failed_signups: ['rate<0.05'],
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
    role: 'fleet_owner',
    fleetSize: '1-5',
    companyName: 'LoadCorp',
  });

  const res = http.post(`${BASE_URL}/api/waitlist`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  latencyTrend.add(res.timings.duration);

  let json;
  try { json = res.json(); } catch {
    failCounter.add(1);
    return;
  }

  if (res.status === 200 && (json.status === 'joined' || json.status === 'already_joined')) {
    successCounter.add(1);
  } else {
    failCounter.add(1);
  }

  sleep(0.5 + Math.random() * 1.0); // 0.5–1.5s think time
}
