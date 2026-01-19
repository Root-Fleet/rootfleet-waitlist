import Ajv from "ajv";
import addFormats from "ajv-formats";

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  throw new Error("Missing BASE_URL. Example: BASE_URL=http://localhost:8788");
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

async function readJson(path, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "content-type": "application/json", ...(init.headers || {}) },
    ...init,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Response not JSON for ${path}: ${text.slice(0, 200)}`);
  }
  return { res, json, text };
}

async function loadSchema(relPath) {
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
    throw new Error(
      `Contract failed: ${label}\n${details}\n\nResponse:\n${JSON.stringify(
        data,
        null,
        2
      )}`
    );
  }
}

(async () => {
  const signupSchema = await loadSchema("./schemas/waitlist.signup.response.schema.json");
  const countSchema = await loadSchema("./schemas/waitlist.count.response.schema.json");
  const errorSchema = await loadSchema("./schemas/waitlist.error.response.schema.json");

  // 1) Count endpoint contract (success)
  {
    const { res, json } = await readJson("/api/waitlist/count");
    if (!res.ok) throw new Error(`GET /api/waitlist/count failed: ${res.status}`);
    validateOrThrow(countSchema, json, "GET /api/waitlist/count (200)");
  }

  // 2) Signup endpoint contract (success)
  {
    const payload = {
      email: `contract+${Date.now()}@example.com`,
      role: "fleet_owner",
      fleetSize: "1-5",
      companyName: "Contract Test Co",
    };

    const { res, json, text } = await readJson("/api/waitlist", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(
        `POST /api/waitlist expected 200 but got ${res.status} body=${text.slice(0, 200)}`
      );
    }

    validateOrThrow(signupSchema, json, "POST /api/waitlist (200)");
  }

  // 3) Signup endpoint contract (error response shape)
  // We intentionally send a bad role to force a 400/422.
  {
    const payload = {
      email: `contract+bad-${Date.now()}@example.com`,
      role: "owner",         // invalid on purpose (your API expects fleet_owner, operations, etc.)
      fleetSize: "1-5",
      companyName: "Contract Test Co",
    };

    const { res, json } = await readJson("/api/waitlist", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!(res.status === 400 || res.status === 422)) {
      throw new Error(
        `POST /api/waitlist expected 400/422 but got ${res.status}`
      );
    }

    validateOrThrow(errorSchema, json, "POST /api/waitlist (400/422)");
  }

  console.log("✅ Contract tests passed");
})().catch((err) => {
  console.error("❌ Contract tests failed");
  console.error(err?.stack || err);
  process.exit(1);
});
