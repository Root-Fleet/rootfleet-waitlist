import Ajv from "ajv";
import addFormats from "ajv-formats";

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  throw new Error("Missing BASE_URL. Example: BASE_URL=http://localhost:8788");
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

async function readJson(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "content-type": "application/json" },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Response not JSON for ${path}: ${text.slice(0, 200)}`);
  }
  return { res, json };
}

async function loadSchema(relPath) {
  // Node ESM: use fs + URL
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const url = await import("node:url");

  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const schemaText = await fs.readFile(path.join(__dirname, relPath), "utf8");
  return JSON.parse(schemaText);
}

function validateOrThrow(schema, data, label) {
  const validate = ajv.compile(schema);
  const ok = validate(data);
  if (!ok) {
    const details = ajv.errorsText(validate.errors, { separator: "\n" });
    throw new Error(`Contract failed: ${label}\n${details}`);
  }
}

(async () => {
  const signupSchema = await loadSchema("./schemas/waitlist.signup.response.schema.json");
  const countSchema = await loadSchema("./schemas/waitlist.count.response.schema.json");

  // 1) Count endpoint contract
  {
    const { res, json } = await readJson("/api/waitlist/count");
    if (!res.ok) throw new Error(`GET /count failed: ${res.status}`);
    validateOrThrow(countSchema, json, "GET /api/waitlist/count");
  }

  // 2) Signup endpoint contract
  {
    const payload = {
      email: `contract+${Date.now()}@example.com`,
      role: "owner",
      fleet_size: "1-5",
      company_name: "Contract Test Co"
    };

    const res = await fetch(`${BASE_URL}/api/waitlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch {
      throw new Error(`POST /signup not JSON: ${text.slice(0, 200)}`);
    }

    if (!res.ok) throw new Error(`POST /signup failed: ${res.status} body=${text.slice(0, 200)}`);
    validateOrThrow(signupSchema, json, "POST /api/waitlist/");
  }

  console.log("✅ Contract tests passed");
})().catch((err) => {
  console.error("❌ Contract tests failed");
  console.error(err?.stack || err);
  process.exit(1);
});
