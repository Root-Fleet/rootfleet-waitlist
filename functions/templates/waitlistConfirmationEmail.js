function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function roleLabel(role) {
  const map = {
    fleet_owner: "Fleet Owner",
    operations: "Operations / Dispatcher",
    fleet_staff: "Driver / Fleet staff",
    engineer: "Engineer / Technical",
    other: "Other",
  };
  return map[role] || "Other";
}

/**
 * “Industrial standard” confirmation email:
 * - short, clear, transactional
 * - includes submitted info
 * - no reply expectation
 */
export function buildWaitlistConfirmationEmail({ email, role, fleetSize, companyName }) {
  const safeCompany = companyName ? escapeHtml(companyName) : "Rootfleet";
  const safeRole = escapeHtml(roleLabel(role));
  const safeFleet = escapeHtml(fleetSize);

  const subject = "Rootfleet waitlist confirmation";

  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height: 1.5; color:#0f172a;">
      <h2 style="margin:0 0 12px;">You're on the waitlist ✅</h2>

      <p style="margin:0 0 12px;">
        Thanks for joining the Rootfleet waitlist. We'll email you when early access opens.
      </p>

      <div style="margin:16px 0; padding:12px 14px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:10px;">
        <div style="font-size:13px; color:#475569; font-weight:600; margin-bottom:6px;">Your details</div>
        <div style="font-size:13px; color:#475569;">Email: <strong style="color:#0f172a;">${escapeHtml(email)}</strong></div>
        <div style="font-size:13px; color:#475569;">Role: <strong style="color:#0f172a;">${safeRole}</strong></div>
        <div style="font-size:13px; color:#475569;">Fleet size: <strong style="color:#0f172a;">${safeFleet}</strong></div>
        <div style="font-size:13px; color:#475569;">Company: <strong style="color:#0f172a;">${safeCompany}</strong></div>
      </div>

      <p style="margin:0; font-size:12px; color:#64748b;">
        This is an automated message — please do not reply.
      </p>
    </div>
  `;

  // Optional plain text fallback (good practice)
  const text =
`You're on the Rootfleet waitlist ✅

Thanks for joining the Rootfleet waitlist. We'll email you when early access opens.

Your details:
Email: ${email}
Role: ${roleLabel(role)}
Fleet size: ${fleetSize}
Company: ${companyName || "—"}

This is an automated message — please do not reply.
`;

  return { subject, html, text };
}

