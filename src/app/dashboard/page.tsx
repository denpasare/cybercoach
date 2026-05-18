import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDevModeEnabled } from "@/lib/dev-mode";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");

  const [emails, syncState] = await Promise.all([
    prisma.email.findMany({
      where: { userId: session.user.id },
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        subject: true,
        fromEmail: true,
        fromName: true,
        receivedAt: true,
        snippet: true,
        bodyPreview: true,
      },
    }),
    prisma.syncState.findUnique({
      where: { userId: session.user.id },
      select: { lastSyncedAt: true },
    }),
  ]);

  return (
    <DashboardClient
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }}
      initialEmails={emails.map((e) => ({
        ...e,
        receivedAt: e.receivedAt ? e.receivedAt.toISOString() : null,
      }))}
      lastSyncedAt={
        syncState?.lastSyncedAt ? syncState.lastSyncedAt.toISOString() : null
      }
      devMode={isDevModeEnabled()}
    />
  );
}
