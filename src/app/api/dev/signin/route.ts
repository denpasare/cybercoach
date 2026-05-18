import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEV_USER, isDevModeEnabled } from "@/lib/dev-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dev-only sign in.
 *
 * Creates (or reuses) a dev user, opens a DB-backed Session row, and sets
 * the NextAuth session cookie. Mirrors what the OAuth flow would do, minus
 * Microsoft. Returns 404 in production-style deployments.
 */
async function handle(): Promise<NextResponse> {
  if (!isDevModeEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await prisma.user.upsert({
    where: { email: DEV_USER.email },
    create: { email: DEV_USER.email, name: DEV_USER.name },
    update: { name: DEV_USER.name },
  });

  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires },
  });

  const isHttps = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  const cookieName = isHttps
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const res = NextResponse.redirect(
    new URL("/dashboard", process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
  );
  res.cookies.set({
    name: cookieName,
    value: sessionToken,
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    expires,
  });
  return res;
}

export async function POST() {
  return handle();
}

// Allow GET so the link from the login page works without JS.
export async function GET() {
  return handle();
}
