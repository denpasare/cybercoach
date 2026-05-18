import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { syncEmails } from "@/lib/email-sync";
import { checkRateLimit } from "@/lib/rate-limit";

const syncRequestSchema = z.object({}).passthrough();

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const validBody = syncRequestSchema.safeParse(body);
  if (!validBody.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { allowed, retryAfterSeconds } = checkRateLimit(`sync:${userId}`, 5, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfterSeconds.toString(),
        },
      },
    );
  }

  try {
    const result = await syncEmails(userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Email sync failed unexpectedly";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
