/**
 * Pure/testable core.
 */
export function _logCore(event, fields = {}, { nowIso, consoleImpl } = {}) {
  const payload = {
    ts: (nowIso || (() => new Date().toISOString()))(),
    event,
    ...fields,
  };

  (consoleImpl || console).log(JSON.stringify(payload));
}

/**
 * Production wrapper (same API as before).
 */
export function log(event, fields = {}) {
  return _logCore(event, fields);
}
