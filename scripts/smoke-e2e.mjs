#!/usr/bin/env node
/**
 * End-to-end smoke test (no browser required).
 *
 * Assumes the dev server is running on http://localhost:3000 with
 * ENABLE_DEV_AUTH=true. Walks the full flow:
 *
 *   1. GET  /                       → expect redirect/200
 *   2. GET  /dashboard              → expect redirect to /login (no cookie)
 *   3. GET  /api/dev/signin         → expect 307 + session cookie
 *   4. GET  /dashboard              → expect 200 with cookie
 *   5. POST /api/sync               → expect { ok: true, upserted >= 1 }
 *   6. POST /api/sync (x6)          → expect a 429 from the rate limiter
 *
 * Usage:
 *   npm run test:e2e
 *   BASE_URL=http://localhost:3000 npm run test:e2e
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

let failed = 0;
let cookie = "";

function pass(name) {
  console.log(`  ${GREEN}✓${RESET} ${name}`);
}

function fail(name, detail) {
  failed += 1;
  console.log(`  ${RED}✗${RESET} ${name}`);
  if (detail) console.log(`    ${DIM}${detail}${RESET}`);
}

async function call(path, opts = {}) {
  const headers = new Headers(opts.headers ?? {});
  if (cookie) headers.set("cookie", cookie);
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    ...opts,
    headers,
  });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const raw of setCookies) {
    const pair = raw.split(";")[0];
    cookie = cookie ? `${cookie}; ${pair}` : pair;
  }
  return res;
}

async function step1Landing() {
  const res = await call("/");
  if (res.status === 200) pass("GET / → 200");
  else fail("GET / → expected 200", `got ${res.status}`);
}

async function step2DashboardUnauth() {
  const res = await call("/dashboard");
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location") ?? "";
    if (loc.includes("/login")) {
      pass(`GET /dashboard (unauth) → ${res.status} → ${loc}`);
      return;
    }
  }
  fail(
    "GET /dashboard (unauth) → expected redirect to /login",
    `got ${res.status} ${res.headers.get("location") ?? ""}`,
  );
}

async function step3DevSignin() {
  const res = await call("/api/dev/signin");
  const ok = res.status === 307 || res.status === 302 || res.status === 303;
  const hasCookie = /authjs\.session-token/.test(cookie);
  if (ok && hasCookie) pass(`GET /api/dev/signin → ${res.status} + session cookie`);
  else
    fail(
      "GET /api/dev/signin → expected redirect with session cookie",
      `status=${res.status} cookie=${cookie || "(none)"}`,
    );
}

async function step4DashboardAuth() {
  const res = await call("/dashboard");
  if (res.status === 200) pass("GET /dashboard (auth) → 200");
  else fail("GET /dashboard (auth) → expected 200", `got ${res.status}`);
}

async function step5Sync() {
  const res = await call("/api/sync", { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (res.status === 200 && body.ok && (body.upserted ?? 0) >= 1) {
    pass(
      `POST /api/sync → 200 (upserted=${body.upserted}, removed=${body.removed ?? 0})`,
    );
  } else {
    fail(
      "POST /api/sync → expected ok:true with upserted >= 1",
      `status=${res.status} body=${JSON.stringify(body)}`,
    );
  }
}

async function step6RateLimit() {
  let saw429 = false;
  for (let i = 0; i < 8; i++) {
    const res = await call("/api/sync", { method: "POST" });
    if (res.status === 429) {
      saw429 = true;
      break;
    }
  }
  if (saw429) pass("POST /api/sync (rapid x8) → eventually 429");
  else fail("POST /api/sync rate limit", "never hit 429 within 8 calls");
}

async function main() {
  console.log(`\nEmailyzer E2E smoke @ ${BASE}\n`);
  try {
    await step1Landing();
    await step2DashboardUnauth();
    await step3DevSignin();
    await step4DashboardAuth();
    await step5Sync();
    await step6RateLimit();
  } catch (err) {
    fail("uncaught error", err instanceof Error ? err.message : String(err));
  }
  console.log("");
  if (failed > 0) {
    console.log(`${RED}${failed} step(s) failed${RESET}\n`);
    process.exit(1);
  }
  console.log(`${GREEN}All E2E steps passed${RESET}\n`);
}

main();
