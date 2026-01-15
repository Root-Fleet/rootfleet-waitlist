// tests/helpers/http.js

function getBaseUrl() {
  const url = process.env.BASE_URL;

  if (!url) {
    throw new Error(
      "BASE_URL is required. Example:\n" +
      "BASE_URL=http://127.0.0.1:8787 npm run test:integration"
    );
  }

  // Remove trailing slash if present
  return url.replace(/\/$/, "");
}

function buildUrl(path) {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  return `${getBaseUrl()}${path}`;
}

async function parseResponse(res) {
  const text = await res.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON, ignore
  }

  return { res, json, text };
}

export async function postJson(path, body, extraHeaders = {}) {
  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  return parseResponse(res);
}

export async function get(path, extraHeaders = {}) {
  const res = await fetch(buildUrl(path), {
    method: "GET",
    headers: {
      ...extraHeaders,
    },
  });

  return parseResponse(res);
}

export function uniqueEmail(prefix = "test") {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 10000);
  return `${prefix}+${ts}${rand}@example.com`;
}
