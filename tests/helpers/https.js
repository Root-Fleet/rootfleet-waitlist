// tests/helpers/http.js
export function baseUrl() {
  return process.env.BASE_URL || 'http://127.0.0.1:8788';
}

export async function postJson(path, body, extraHeaders = {}) {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  return { res, json, text };
}

export async function get(path) {
  const res = await fetch(`${baseUrl()}${path}`, { method: 'GET' });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  return { res, json, text };
}

export function uniqueEmail(prefix = 'test') {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 10000);
  return `${prefix}+${ts}${rand}@example.com`;
}
