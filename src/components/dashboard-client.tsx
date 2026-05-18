"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/dashboard-client.module.css";

type EmailItem = {
  id: string;
  subject: string;
  fromName: string | null;
  fromEmail: string | null;
  receivedAt: string;
  snippet: string;
  bodyPreview: string;
};

type DashboardClientProps = {
  userName: string | null | undefined;
  emails: EmailItem[];
  lastSyncedAt: string | null;
};

export function DashboardClient({
  userName,
  emails,
  lastSyncedAt,
}: DashboardClientProps) {
  const router = useRouter();
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(
    emails[0]?.id ?? null,
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, startSyncTransition] = useTransition();

  const selectedEmail = useMemo(
    () => emails.find((email) => email.id === selectedEmailId) ?? emails[0] ?? null,
    [emails, selectedEmailId],
  );

  const onSyncNow = () => {
    startSyncTransition(async () => {
      setSyncError(null);

      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setSyncError(payload.error ?? "Sync failed");
        return;
      }

      router.refresh();
    });
  };

  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Inbox Dashboard</h1>
          <p className={styles.subtitle}>
            Signed in as <strong>{userName ?? "Microsoft User"}</strong>
          </p>
          <p className={styles.meta}>
            Last synced: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : "Never"}
          </p>
        </div>
        <button className={styles.syncButton} onClick={onSyncNow} disabled={isSyncing}>
          {isSyncing ? "Syncing..." : "Sync now"}
        </button>
      </header>

      {syncError && <p className={styles.error}>{syncError}</p>}

      <section className={styles.grid}>
        <aside className={styles.listPanel}>
          {emails.length === 0 ? (
            <p className={styles.empty}>No emails synced yet. Click "Sync now".</p>
          ) : (
            <ul className={styles.list}>
              {emails.map((email) => {
                const sender = email.fromName || email.fromEmail || "Unknown sender";
                return (
                  <li key={email.id}>
                    <button
                      className={`${styles.listItem} ${
                        selectedEmail?.id === email.id ? styles.active : ""
                      }`}
                      onClick={() => setSelectedEmailId(email.id)}
                    >
                      <p className={styles.subject}>{email.subject}</p>
                      <p className={styles.sender}>{sender}</p>
                      <p className={styles.date}>
                        {new Date(email.receivedAt).toLocaleString()}
                      </p>
                      <p className={styles.snippet}>{email.snippet}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <article className={styles.previewPanel}>
          {!selectedEmail ? (
            <p className={styles.empty}>Select an email to preview it.</p>
          ) : (
            <>
              <h2 className={styles.previewSubject}>{selectedEmail.subject}</h2>
              <p className={styles.previewMeta}>
                From: {selectedEmail.fromName || "Unknown"} ({selectedEmail.fromEmail || "n/a"})
              </p>
              <p className={styles.previewMeta}>
                Received: {new Date(selectedEmail.receivedAt).toLocaleString()}
              </p>
              <pre className={styles.previewBody}>{selectedEmail.bodyPreview || selectedEmail.snippet}</pre>
            </>
          )}
        </article>
      </section>
    </main>
  );
}
