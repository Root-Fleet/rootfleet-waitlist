// tests/helpers/bootstrap.js
if (!process.env.BASE_URL) {
  throw new Error(
    "BASE_URL is required for integration/e2e/smoke tests.\n" +
    "Example:\n" +
    "BASE_URL=http://127.0.0.1:8787 npm run test:integration"
  );
}
