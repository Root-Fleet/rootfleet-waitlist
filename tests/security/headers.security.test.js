const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) throw new Error("Missing BASE_URL");

const REQUIRED = [
  // adjust based on your setup
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy"
];

(async () => {
  const res = await fetch(`${BASE_URL}/`, { method: "GET" });
  if (!res.ok) throw new Error(`GET / failed: ${res.status}`);

  const missing = [];
  for (const h of REQUIRED) {
    if (!res.headers.get(h)) missing.push(h);
  }

  if (missing.length) {
    throw new Error(`Missing security headers: ${missing.join(", ")}`);
  }

  console.log("✅ Security headers present");
})().catch((err) => {
  console.error("❌ Security headers check failed");
  console.error(err?.stack || err);
  process.exit(1);
});
