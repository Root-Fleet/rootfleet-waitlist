const form = document.getElementById("waitlist-form");
const msg = document.getElementById("msg");

const emailInput = document.getElementById("email");
const roleInput = document.getElementById("role");
const fleetSizeInput = document.getElementById("fleetSize");
const companyNameInput = document.getElementById("companyName");

const waitlistCountEl = document.getElementById("waitlistCount");
const submitBtn = document.getElementById("submitBtn");
const yearEl = document.getElementById("year");

function setMsg(text, kind) {
  if (!msg) return;
  msg.textContent = text;
  msg.className = `msg ${kind || ""}`;
}

async function fetchWaitlistCount() {
  if (!waitlistCountEl) return;

  try {
    const res = await fetch("/api/waitlist/count", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data?.ok) {
      waitlistCountEl.textContent = String(data.count);
    } else {
      waitlistCountEl.textContent = "—";
    }
  } catch {
    waitlistCountEl.textContent = "—";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  fetchWaitlistCount();
});

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("", "");

    const email = emailInput.value.trim();
    const role = roleInput.value;
    const fleetSize = fleetSizeInput.value;
    const companyName = companyNameInput.value.trim() || null;

    if (!email) return;

    const btn = submitBtn || form.querySelector("button");
    if (btn) btn.disabled = true;

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role, fleetSize, companyName }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.ok === false) {
        throw new Error(data?.error || "Failed to join waitlist");
      }

      setMsg(data.message, "ok");


      // Clear form
      emailInput.value = "";
      roleInput.selectedIndex = 0;
      fleetSizeInput.selectedIndex = 0;
      companyNameInput.value = "";

      // Refresh count
      fetchWaitlistCount();
    } catch (err) {
      setMsg(err?.message || "Something went wrong", "err");
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

