"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { signOutAction } from "./actions";

export interface DashboardEmail {
  id: string;
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  receivedAt: string | null;
  snippet: string | null;
  bodyPreview: string | null;
}

interface DashboardClientProps {
  user: { name: string | null; email: string | null; image: string | null };
  initialEmails: DashboardEmail[];
  lastSyncedAt: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export function DashboardClient({
  user,
  initialEmails,
  lastSyncedAt,
}: DashboardClientProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialEmails[0]?.id ?? null,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const selected = useMemo(
    () => initialEmails.find((e) => e.id === selectedId) ?? null,
    [initialEmails, selectedId],
  );

  async function handleSync() {
    setIsSyncing(true);
    setSyncError(null);
    setSyncSummary(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        upserted?: number;
        removed?: number;
        error?: string;
      };
      if (!res.ok) {
        setSyncError(data.error ?? `Sync failed (${res.status})`);
      } else {
        setSyncSummary(
          `Synced ${data.upserted ?? 0} message${
            (data.upserted ?? 0) === 1 ? "" : "s"
          }${data.removed ? `, removed ${data.removed}` : ""}.`,
        );
        startTransition(() => router.refresh());
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">
            Emailyzer
          </span>
          <span className="text-xs text-slate-500">
            Last sync: {formatRelative(lastSyncedAt)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className={clsx(
              "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition",
              isSyncing
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "bg-brand text-white hover:bg-brand-dark",
            )}
          >
            {isSyncing ? "Syncing…" : "Sync now"}
          </button>
          <div className="flex items-center gap-2">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt=""
                className="h-7 w-7 rounded-full border border-slate-200"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                {(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="hidden text-right text-xs leading-tight sm:block">
              <div className="font-medium text-slate-800">
                {user.name ?? user.email}
              </div>
              {user.email ? (
                <div className="text-slate-500">{user.email}</div>
              ) : null}
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {syncError || syncSummary ? (
        <div
          className={clsx(
            "border-b px-6 py-2 text-sm",
            syncError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          {syncError ?? syncSummary}
        </div>
      ) : null}

      <div className="grid flex-1 grid-cols-1 md:grid-cols-[360px_1fr]">
        <aside className="border-r border-slate-200 bg-white md:max-h-[calc(100vh-49px)] md:overflow-y-auto">
          {initialEmails.length === 0 ? (
            <EmptyInbox onSync={handleSync} isSyncing={isSyncing} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {initialEmails.map((email) => {
                const isActive = email.id === selectedId;
                return (
                  <li key={email.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(email.id)}
                      className={clsx(
                        "block w-full px-4 py-3 text-left transition",
                        isActive
                          ? "bg-brand/5"
                          : "hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={clsx(
                            "truncate text-sm",
                            isActive
                              ? "font-semibold text-slate-900"
                              : "font-medium text-slate-800",
                          )}
                        >
                          {email.fromName || email.fromEmail || "Unknown sender"}
                        </span>
                        <span className="shrink-0 text-xs text-slate-500">
                          {formatDate(email.receivedAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-sm text-slate-700">
                        {email.subject || "(no subject)"}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {email.snippet || ""}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="bg-slate-50 md:max-h-[calc(100vh-49px)] md:overflow-y-auto">
          {selected ? (
            <article className="mx-auto max-w-3xl px-6 py-8">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                {selected.subject || "(no subject)"}
              </h1>
              <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                <div>
                  <span className="font-medium text-slate-800">
                    {selected.fromName || selected.fromEmail || "Unknown sender"}
                  </span>
                  {selected.fromName && selected.fromEmail ? (
                    <span className="ml-2 text-slate-500">
                      &lt;{selected.fromEmail}&gt;
                    </span>
                  ) : null}
                </div>
                <div>{formatDate(selected.receivedAt)}</div>
              </div>
              <hr className="my-5 border-slate-200" />
              <div className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                {selected.bodyPreview ||
                  selected.snippet ||
                  "(No preview available for this message.)"}
              </div>
              <p className="mt-8 text-xs text-slate-500">
                Only the message preview is stored locally. Full message
                bodies remain in your Outlook mailbox.
              </p>
            </article>
          ) : (
            <div className="flex h-full items-center justify-center px-6 py-16 text-sm text-slate-500">
              Select an email to preview it here.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyInbox({
  onSync,
  isSyncing,
}: {
  onSync: () => void;
  isSyncing: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
      <h2 className="text-base font-semibold text-slate-800">
        Your inbox is empty.
      </h2>
      <p className="mt-2 max-w-xs text-sm text-slate-500">
        Run a sync to pull recent messages from Outlook via Microsoft Graph.
      </p>
      <button
        type="button"
        onClick={onSync}
        disabled={isSyncing}
        className={clsx(
          "mt-5 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium shadow-sm transition",
          isSyncing
            ? "cursor-not-allowed bg-slate-200 text-slate-500"
            : "bg-brand text-white hover:bg-brand-dark",
        )}
      >
        {isSyncing ? "Syncing…" : "Sync inbox"}
      </button>
    </div>
  );
}
