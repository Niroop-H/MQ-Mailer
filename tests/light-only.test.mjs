import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = readFileSync(new URL("../app/root.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/index.css", import.meta.url), "utf8");
const googleAuth = readFileSync(new URL("../workers/auth/google.ts", import.meta.url), "utf8");
const settings = readFileSync(new URL("../app/routes/settings.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../app/routes/home.tsx", import.meta.url), "utf8");

test("MQ Mailer application is light only, even under OS dark mode", () => {
  assert.match(root, /<html lang="en" data-mode="light"/);
  assert.match(root, /colorScheme: "light"/);
  assert.match(root, /content="#ffffff"/);
  assert.match(styles, /:root\s*\{\s*color-scheme:\s*light;/);
  assert.doesNotMatch(styles, /prefers-color-scheme\s*:\s*dark/);
});

test("OAuth sign-in page matches the light-only layout", () => {
  assert.match(googleAuth, /style='color-scheme:light'/);
  assert.match(googleAuth, /background:#f4f6f9/);
  assert.match(googleAuth, /background:#ffffff/);
  assert.doesNotMatch(googleAuth, /background:#101827/);
  assert.doesNotMatch(googleAuth, /background:#172235/);
});

test("Owner selection describes Google login separately from the mailbox address", () => {
  assert.match(home, /Google login of mailbox owner/);
  assert.match(home, /ceo@international\.mahquantum\.tech/);
  assert.match(settings, /approved Google sign-in emails/);
  assert.doesNotMatch(settings, /Cloudflare Access sign-in emails/);
});
