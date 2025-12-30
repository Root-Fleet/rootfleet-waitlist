export function log(event, fields = {}) {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...fields,
  };
  console.log(JSON.stringify(payload));
}

