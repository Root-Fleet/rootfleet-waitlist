const form = document.getElementById("waitlist-form");
const msg = document.getElementById("msg");

const emailInput = document.getElementById("email");
const roleInput = document.getElementById("role");
const fleetSizeInput = document.getElementById("fleetSize");
const companyNameInput = document.getElementById("companyName");

function setMsg(text, kind) {
  msg.textContent = text;
  msg.className = `msg ${kind || ""}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("", "");

  const email = emailInput.value.trim();
  const role = roleInput.value;
  const fleetSize = fleetSizeInput.value;
  const companyName = companyNameInput.value.trim() || null;

  if (!email) return;

  const btn = form.querySelector("button");
  btn.disabled = true;

  try {
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, role, fleetSize, companyName }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Failed to join waitlist");

    setMsg(data?.message || "You're on the list ✅", "ok");

    emailInput.value = "";
    roleInput.selectedIndex = 0;
    fleetSizeInput.selectedIndex = 0;
    companyNameInput.value = "";
  } catch (err) {
    setMsg(err?.message || "Something went wrong", "err");
  } finally {
    btn.disabled = false;
  }
});

