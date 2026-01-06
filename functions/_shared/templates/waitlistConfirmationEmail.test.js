import test from "node:test";
import assert from "node:assert/strict";
import { buildWaitlistConfirmationEmail } from "./waitlistConfirmationEmails.js";

test("buildWaitlistConfirmationEmail returns subject/html/text and includes the user details", () => {
  const out = buildWaitlistConfirmationEmail({
    email: "user@example.com",
    role: "fleet_owner",
    fleetSize: "11-50",
    companyName: "Rootfleet Ltd",
  });

  assert.equal(out.subject, "Rootfleet — waitlist confirmation");

  // HTML should include these values
  assert.match(out.html, /You're on the waitlist ✅/);
  assert.match(out.html, /user@example\.com/);
  assert.match(out.html, /Fleet Owner/);
  assert.match(out.html, /11-50/);
  assert.match(out.html, /Rootfleet Ltd/);

  // Text should include these values (unescaped raw input is OK in text)
  assert.match(out.text, /Email:\s+user@example\.com/);
  assert.match(out.text, /Role:\s+Fleet Owner/);
  assert.match(out.text, /Fleet size:\s+11-50/);
  assert.match(out.text, /Company:\s+Rootfleet Ltd/);
});

test("escapes HTML-sensitive characters to prevent injection in html output", () => {
  const out = buildWaitlistConfirmationEmail({
    email: `a&b<test>"'@example.com`,
    role: "engineer",
    fleetSize: `1"><script>alert(1)</script>`,
    companyName: `<b onclick="x()">ACME & Sons</b>`,
  });

  // Ensure dangerous raw strings don't appear
  assert.ok(!out.html.includes(`<script>`), "html must not contain raw <script>");
  assert.ok(!out.html.includes(`onclick=`), "html must not contain raw onclick=");

  // Ensure values ARE present but escaped
  assert.match(out.html, /a&amp;b&lt;test&gt;&quot;&#39;@example\.com/);
  assert.match(out.html, /1&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(out.html, /&lt;b onclick=&quot;x\(\)&quot;&gt;ACME &amp; Sons&lt;\/b&gt;/);
});

test("unknown role falls back to Other", () => {
  const out = buildWaitlistConfirmationEmail({
    email: "x@y.com",
    role: "something_new",
    fleetSize: "0-1",
    companyName: "",
  });

  assert.match(out.html, />Other</);
  assert.match(out.text, /Role:\s+Other/);
});

test("companyName missing renders as em dash", () => {
  const out = buildWaitlistConfirmationEmail({
    email: "x@y.com",
    role: "operations",
    fleetSize: "2-5",
    companyName: undefined,
  });

  // HTML uses "—"
  assert.match(out.html, />—</);

  // Text uses "—"
  assert.match(out.text, /Company:\s+—/);
});
