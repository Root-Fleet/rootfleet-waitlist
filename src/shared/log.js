export function log(event, data = {}) {
  // Keep it JSON so Cloudflare Logs are searchable
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...data,
  }));
}
