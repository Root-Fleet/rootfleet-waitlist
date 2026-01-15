import { expect, test } from "@playwright/test";

function uniqueEmail(prefix = "e2e") {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 10000);
  return `${prefix}+${ts}${rand}@example.com`;
}

test("E2E(UI): user joins waitlist and sees success message", async ({ page }) => {
  // Your waitlist page is the root HTML (index.html)
  await page.goto("/");

  // Fill form fields using your stable IDs
  const email = uniqueEmail("ui");
  await page.locator("#email").fill(email);

  // Select dropdowns by value (matches your <option value="...">)
  await page.locator("#role").selectOption("fleet_owner");
  await page.locator("#fleetSize").selectOption("1-5");

  // Optional company name
  await page.locator("#companyName").fill("E2ECorp");

  // Submit
  await page.locator("#submitBtn").click();

  // Expect success message:
  // Your JS does: setMsg(data.message, "ok") → class "msg ok"
  const msg = page.locator("#msg");
  await expect(msg).toBeVisible();
  await expect(msg).toHaveClass(/msg\s+ok/);

  // The exact message text depends on backend, so we assert it’s non-empty.
  await expect(msg).not.toHaveText("");

  // Bonus: form should clear after success
  await expect(page.locator("#email")).toHaveValue("");
  await expect(page.locator("#companyName")).toHaveValue("");

  // Bonus (optional): waitlist count should be a number after refresh.
  // Your UI calls fetchWaitlistCount() after success.
  const countEl = page.locator("#waitlistCount");
  await expect(countEl).not.toHaveText("—");
  await expect(countEl).toHaveText(/^\d+$/);
});
