import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/dashboard-client";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/");
  }

  const [emails, syncState] = await Promise.all([
    prisma.email.findMany({
      where: { userId },
      orderBy: { receivedAt: "desc" },
      take: 100,
    }),
    prisma.syncState.findUnique({
      where: { userId },
    }),
  ]);

  return (
    <DashboardClient
      userName={session.user?.name}
      lastSyncedAt={syncState?.lastSyncedAt?.toISOString() ?? null}
      emails={emails.map((email) => ({
        id: email.id,
        subject: email.subject,
        fromName: email.fromName,
        fromEmail: email.fromEmail,
        receivedAt: email.receivedAt.toISOString(),
        snippet: email.snippet,
        bodyPreview: email.bodyPreview,
      }))}
    />
  );
}
