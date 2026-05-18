import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncEmails } from "@/lib/graph";
import { rateLimit } from "@/lib/rate-limit";
import {
  MissingMicrosoftAccountError,
  TokenRefreshError,
} from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYNC_LIMIT = 5; // requests
const SYNC_WINDOW_MS = 60_000; // per minute

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(
    `sync:${session.user.id}`,
    SYNC_LIMIT,
    SYNC_WINDOW_MS,
  );
  if (!limit.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((limit.resetAt - Date.now()) / 1000),
    );
    return NextResponse.json(
      { error: "Too many sync requests. Try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  try {
    const result = await syncEmails(session.user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof MissingMicrosoftAccountError) {
      return NextResponse.json(
        { error: "No Microsoft account linked. Please sign in again." },
        { status: 400 },
      );
    }
    if (err instanceof TokenRefreshError) {
      return NextResponse.json(
        { error: "Microsoft token refresh failed. Please sign in again." },
        { status: 401 },
      );
    }
    console.error("[/api/sync] failed", err);
    return NextResponse.json(
      { error: "Sync failed. Please try again." },
      { status: 500 },
    );
  }
}
