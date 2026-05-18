#!/usr/bin/env node
/**
 * One-command local dev bootstrap for Emailyzer.
 *
 * Responsibilities:
 *   1. Ensure .env exists with dev-friendly defaults (generate secrets).
 *   2. Bring up a local Postgres (docker compose preferred; native fallback).
 *   3. Wait for Postgres to accept connections.
 *   4. Run `prisma db push` so the schema is applied.
 *   5. exec `next dev` so logs stream directly to the user's terminal.
 *
 * Goals:
 *   - Zero external accounts required to run the full UX (dev mode mocks
 *     Microsoft auth + Graph email source).
 *   - Idempotent: safe to re-run; existing .env values are preserved.
 *   - Works whether `docker compose` is available or not (falls back to
 *     a native Postgres cluster if one is installed and writable).
 */

import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const ENV_FILE = path.join(ROOT, ".env");
const ENV_EXAMPLE = path.join(ROOT, ".env.example");

const DEV_DB = {
  host: "127.0.0.1",
  port: 5432,
  user: "emailyzer",
  password: "emailyzer",
  database: "emailyzer",
};

const DEV_DATABASE_URL = `postgresql://${DEV_DB.user}:${DEV_DB.password}@${DEV_DB.host}:${DEV_DB.port}/${DEV_DB.database}?schema=public`;

const PURPLE = "\x1b[35m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function log(tag, msg, color = CYAN) {
  process.stdout.write(`${color}[dev:${tag}]${RESET} ${msg}\n`);
}

function warn(tag, msg) {
  log(tag, msg, YELLOW);
}

function fail(tag, msg) {
  log(tag, msg, RED);
  process.exit(1);
}

function parseEnvFile(contents) {
  const out = {};
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return {};
  return parseEnvFile(fs.readFileSync(ENV_FILE, "utf8"));
}

function writeEnvFile(values) {
  // Preserve any keys already in .env (or .env.example) that we didn't touch.
  const example = fs.existsSync(ENV_EXAMPLE)
    ? parseEnvFile(fs.readFileSync(ENV_EXAMPLE, "utf8"))
    : {};
  const merged = { ...example, ...loadEnvFile(), ...values };

  const ordered = [
    "DATABASE_URL",
    "AUTH_SECRET",
    "NEXTAUTH_URL",
    "AUTH_MICROSOFT_ENTRA_ID_ID",
    "AUTH_MICROSOFT_ENTRA_ID_SECRET",
    "AUTH_MICROSOFT_ENTRA_ID_TENANT_ID",
    "TOKEN_ENCRYPTION_KEY",
    "ENABLE_DEV_AUTH",
  ];

  const lines = [
    "# Auto-managed by scripts/dev-bootstrap.mjs.",
    "# Safe to edit; existing values are preserved on re-run.",
    "",
  ];
  for (const key of ordered) {
    if (merged[key] !== undefined) {
      lines.push(`${key}="${merged[key]}"`);
      delete merged[key];
    }
  }
  for (const [key, value] of Object.entries(merged)) {
    lines.push(`${key}="${value}"`);
  }
  fs.writeFileSync(ENV_FILE, lines.join("\n") + "\n", { mode: 0o600 });
}

function ensureEnv() {
  const env = loadEnvFile();
  const generated = {};

  if (!env.DATABASE_URL) generated.DATABASE_URL = DEV_DATABASE_URL;
  if (!env.NEXTAUTH_URL) generated.NEXTAUTH_URL = "http://localhost:3000";
  if (!env.AUTH_SECRET) {
    generated.AUTH_SECRET = crypto.randomBytes(32).toString("base64");
  }
  if (!env.TOKEN_ENCRYPTION_KEY) {
    generated.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
  }
  if (!env.AUTH_MICROSOFT_ENTRA_ID_ID) {
    generated.AUTH_MICROSOFT_ENTRA_ID_ID = "dev-placeholder-client-id";
  }
  if (!env.AUTH_MICROSOFT_ENTRA_ID_SECRET) {
    generated.AUTH_MICROSOFT_ENTRA_ID_SECRET = "dev-placeholder-client-secret";
  }
  if (!env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID) {
    generated.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID = "common";
  }
  if (env.ENABLE_DEV_AUTH === undefined) {
    generated.ENABLE_DEV_AUTH = "true";
  }

  if (Object.keys(generated).length === 0) {
    log("env", `.env looks good ${DIM}(${ENV_FILE})${RESET}`);
    return { ...env };
  }

  writeEnvFile(generated);
  for (const key of Object.keys(generated)) {
    log("env", `set ${key}${key.includes("SECRET") || key.includes("KEY") ? " (generated)" : ""}`);
  }
  return { ...env, ...generated };
}

function tryPing(host, port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

async function waitForPort(host, port, { tries = 60, intervalMs = 1000 } = {}) {
  for (let i = 0; i < tries; i++) {
    if (await tryPing(host, port)) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

function hasBinary(name) {
  const r = spawnSync("sh", ["-c", `command -v ${name} >/dev/null 2>&1`]);
  return r.status === 0;
}

function dockerComposeCmd() {
  if (hasBinary("docker")) {
    const r = spawnSync("docker", ["compose", "version"], { stdio: "ignore" });
    if (r.status === 0) return ["docker", ["compose"]];
  }
  if (hasBinary("docker-compose")) {
    return ["docker-compose", []];
  }
  return null;
}

async function bringUpDockerPostgres() {
  const cmd = dockerComposeCmd();
  if (!cmd) return false;
  const [bin, base] = cmd;
  log("db", "starting Postgres via docker compose…");
  const args = [...base, "up", "-d", "postgres"];
  const r = spawnSync(bin, args, { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) {
    warn("db", "docker compose up failed — falling back to native Postgres if available");
    return false;
  }
  return true;
}

function tryNativePostgres() {
  // Best-effort: if a `pg_ctl` is present and there's a writable cluster
  // setup, start it. We don't try to install anything.
  if (!hasBinary("pg_isready")) return false;
  const ready = spawnSync("pg_isready", [
    "-h",
    DEV_DB.host,
    "-p",
    String(DEV_DB.port),
  ]);
  if (ready.status === 0) {
    log("db", "native Postgres already accepting connections");
    return true;
  }
  // We deliberately do not auto-start system Postgres clusters here —
  // they require sudo and OS-specific commands. Surface a hint instead.
  return false;
}

async function ensurePostgres() {
  if (await tryPing(DEV_DB.host, DEV_DB.port)) {
    log("db", `Postgres reachable on ${DEV_DB.host}:${DEV_DB.port}`);
    return;
  }

  const docker = await bringUpDockerPostgres();
  if (!docker) {
    if (!tryNativePostgres()) {
      warn(
        "db",
        "Could not start Postgres automatically. Install Docker Desktop, or run your own Postgres on 127.0.0.1:5432 with user/db 'emailyzer'.",
      );
    }
  }

  log("db", "waiting for Postgres to accept connections…");
  const ok = await waitForPort(DEV_DB.host, DEV_DB.port, { tries: 60 });
  if (!ok) {
    fail(
      "db",
      `Postgres never came up on ${DEV_DB.host}:${DEV_DB.port}. ` +
        "Check 'docker compose logs postgres' or your local Postgres.",
    );
  }
  log("db", "Postgres is up", GREEN);
}

function runPrismaPush(env) {
  log("db", "applying Prisma schema (prisma db push)…");
  const r = spawnSync(
    "npx",
    ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, ...env },
    },
  );
  if (r.status !== 0) {
    fail("db", "prisma db push failed");
  }
  log("db", "schema applied", GREEN);
}

function startNextDev(env) {
  log("next", "starting Next.js dev server…", PURPLE);
  const child = spawn("npx", ["next", "dev"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  const onSignal = (sig) => () => {
    if (!child.killed) child.kill(sig);
  };
  process.on("SIGINT", onSignal("SIGINT"));
  process.on("SIGTERM", onSignal("SIGTERM"));
  child.on("exit", (code) => process.exit(code ?? 0));
}

function banner(env) {
  const devMode = (env.ENABLE_DEV_AUTH ?? "").toLowerCase() === "true";
  const lines = [
    "",
    `${PURPLE}┌──────────────────────────────────────────────────────────┐${RESET}`,
    `${PURPLE}│${RESET}  Emailyzer dev environment                              ${PURPLE}│${RESET}`,
    `${PURPLE}│${RESET}  • DB: ${DEV_DB.host}:${DEV_DB.port}/${DEV_DB.database}                         ${PURPLE}│${RESET}`,
    `${PURPLE}│${RESET}  • Mode: ${devMode ? `${GREEN}DEV (mock Microsoft + mock Graph)${RESET}${PURPLE}     │${RESET}` : `${YELLOW}REAL Microsoft Entra ID${RESET}${PURPLE}              │${RESET}`}`,
    `${PURPLE}│${RESET}  • URL: http://localhost:3000                           ${PURPLE}│${RESET}`,
    `${PURPLE}└──────────────────────────────────────────────────────────┘${RESET}`,
    "",
  ];
  process.stdout.write(lines.join("\n"));
}

async function main() {
  const env = ensureEnv();
  banner(env);
  await ensurePostgres();
  runPrismaPush(env);
  startNextDev(env);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
