const form = document.getElementById("waitlist-form");
const emailInput = document.getElementById("email");
const msg = document.getElementById("msg");

function setMsg(text, kind) {
  msg.textContent = text;
  msg.className = `msg ${kind || ""}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("", "");

  const email = emailInput.value.trim();
  if (!email) return;

  const btn = form.querySelector("button");
  btn.disabled = true;

  try {
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Failed to join waitlist");

    setMsg(data?.message || "You’re on the list ✅", "ok");
    emailInput.value = "";
  } catch (err) {
    setMsg(err.message || "Something went wrong", "err");
  } finally {
    btn.disabled = false;
  }
});

