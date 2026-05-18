import { prisma } from "./prisma";
import { getValidAccessToken } from "./tokens";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const MESSAGE_SELECT =
  "id,subject,from,receivedDateTime,bodyPreview,internetMessageId";
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGES_PER_SYNC = 10; // hard cap to keep a single sync bounded

interface GraphMessage {
  id: string;
  subject?: string | null;
  from?: {
    emailAddress?: { address?: string | null; name?: string | null } | null;
  } | null;
  receivedDateTime?: string | null;
  bodyPreview?: string | null;
  "@removed"?: { reason?: string };
}

interface GraphDeltaResponse {
  value: GraphMessage[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

export interface SyncResult {
  upserted: number;
  removed: number;
  pages: number;
  deltaTokenAdvanced: boolean;
}

/** Sleep helper for backoff between paginated Graph calls. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function graphFetch(
  url: string,
  accessToken: string,
): Promise<GraphDeltaResponse> {
  // Respect Microsoft Graph throttling. Retry once on 429/503 honoring
  // the Retry-After header so a sync doesn't blow up on transient limits.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: `odata.maxpagesize=${DEFAULT_PAGE_SIZE}`,
      },
      cache: "no-store",
    });

    if (res.ok) {
      return (await res.json()) as GraphDeltaResponse;
    }

    if (res.status === 429 || res.status === 503) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "2");
      const waitMs = Math.min(30_000, Math.max(1, retryAfter) * 1000);
      await sleep(waitMs);
      continue;
    }

    const text = await res.text();
    throw new Error(`Graph request failed (${res.status}): ${text}`);
  }
  throw new Error("Graph request failed after retries");
}

function pickFromAddress(msg: GraphMessage) {
  const addr = msg.from?.emailAddress;
  return {
    fromEmail: addr?.address ?? null,
    fromName: addr?.name ?? null,
  };
}

/**
 * Sync the user's Inbox using the Microsoft Graph delta endpoint.
 *
 * - First call (no delta token): pulls Inbox and stores a delta token.
 * - Subsequent calls: only fetches changes since the last delta token.
 * - Pagination is followed up to MAX_PAGES_PER_SYNC pages per run.
 */
export async function syncEmails(userId: string): Promise<SyncResult> {
  const { accessToken } = await getValidAccessToken(userId);

  const state = await prisma.syncState.findUnique({ where: { userId } });

  let nextUrl: string;
  if (state?.deltaToken) {
    nextUrl = state.deltaToken;
  } else {
    const params = new URLSearchParams({
      $select: MESSAGE_SELECT,
      $top: String(DEFAULT_PAGE_SIZE),
    });
    nextUrl = `${GRAPH_BASE}/me/mailFolders/Inbox/messages/delta?${params.toString()}`;
  }

  let pages = 0;
  let upserted = 0;
  let removed = 0;
  let finalDeltaLink: string | undefined;

  while (nextUrl && pages < MAX_PAGES_PER_SYNC) {
    const data = await graphFetch(nextUrl, accessToken);
    pages += 1;

    for (const msg of data.value ?? []) {
      if (msg["@removed"]) {
        await prisma.email
          .delete({ where: { userId_messageId: { userId, messageId: msg.id } } })
          .then(() => {
            removed += 1;
          })
          .catch(() => {
            /* not in DB, nothing to remove */
          });
        continue;
      }

      const { fromEmail, fromName } = pickFromAddress(msg);
      const receivedAt = msg.receivedDateTime
        ? new Date(msg.receivedDateTime)
        : null;
      const snippet = msg.bodyPreview ?? null;

      await prisma.email.upsert({
        where: { userId_messageId: { userId, messageId: msg.id } },
        create: {
          userId,
          messageId: msg.id,
          subject: msg.subject ?? null,
          fromEmail,
          fromName,
          receivedAt,
          snippet,
          bodyPreview: snippet,
        },
        update: {
          subject: msg.subject ?? null,
          fromEmail,
          fromName,
          receivedAt,
          snippet,
          bodyPreview: snippet,
        },
      });
      upserted += 1;
    }

    if (data["@odata.deltaLink"]) {
      finalDeltaLink = data["@odata.deltaLink"];
      break;
    }
    if (!data["@odata.nextLink"]) break;
    nextUrl = data["@odata.nextLink"];
  }

  // Persist whichever continuation token we have so the next sync resumes.
  const tokenToStore = finalDeltaLink ?? nextUrl ?? state?.deltaToken ?? null;
  await prisma.syncState.upsert({
    where: { userId },
    create: {
      userId,
      deltaToken: tokenToStore,
      lastSyncedAt: new Date(),
    },
    update: {
      deltaToken: tokenToStore,
      lastSyncedAt: new Date(),
    },
  });

  return {
    upserted,
    removed,
    pages,
    deltaTokenAdvanced: Boolean(finalDeltaLink),
  };
}
