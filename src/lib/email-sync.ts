import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/token-crypto";

const MICROSOFT_TOKEN_ENDPOINT =
  "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const GRAPH_SCOPE = "openid email profile offline_access Mail.Read";
const MESSAGE_SELECT = "id,subject,from,receivedDateTime,bodyPreview";

type GraphMessage = {
  id: string;
  subject?: string | null;
  bodyPreview?: string | null;
  receivedDateTime?: string | null;
  from?: {
    emailAddress?: {
      address?: string | null;
      name?: string | null;
    } | null;
  } | null;
  "@removed"?: unknown;
};

type GraphDeltaResponse = {
  value: GraphMessage[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
};

type SyncResult = {
  synced: number;
  deleted: number;
  deltaTokenSaved: boolean;
  lastSyncedAt: string;
};

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  retries = 4,
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const response = await fetch(input, init);
    if (response.ok) {
      return response;
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= retries) {
      throw new Error(
        `Request failed: ${response.status} ${await response.text()}`,
      );
    }

    const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "0");
    const backoffMs =
      retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : Math.min(1000 * 2 ** attempt, 8000);
    attempt += 1;
    await sleep(backoffMs);
  }
}

async function refreshAccessToken(
  encryptedRefreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const refreshToken = decryptToken(encryptedRefreshToken);
  if (!refreshToken) {
    throw new Error("Refresh token missing or invalid");
  }

  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Microsoft OAuth credentials are missing");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: GRAPH_SCOPE,
  });

  const response = await fetchWithRetry(
    MICROSOFT_TOKEN_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
    3,
  );

  const payload = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + payload.expires_in - 60,
  };
}

async function getAccessTokenForUser(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "microsoft",
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (!account) {
    throw new Error("Microsoft account is not connected");
  }

  const decryptedAccessToken = decryptToken(account.access_token);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = account.expires_at ?? 0;
  if (decryptedAccessToken && expiresAt > now) {
    return decryptedAccessToken;
  }

  if (!account.refresh_token) {
    throw new Error("Refresh token unavailable; user must sign in again");
  }

  const refreshed = await refreshAccessToken(account.refresh_token);
  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: encryptToken(refreshed.accessToken),
      refresh_token: encryptToken(refreshed.refreshToken),
      expires_at: refreshed.expiresAt,
    },
  });

  return refreshed.accessToken;
}

async function fetchGraphMessages(
  accessToken: string,
  url: string,
): Promise<GraphDeltaResponse> {
  const response = await fetchWithRetry(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  return (await response.json()) as GraphDeltaResponse;
}

function getInitialDeltaUrl() {
  const params = new URLSearchParams({
    $select: MESSAGE_SELECT,
    $top: "50",
  });

  return `${GRAPH_BASE_URL}/me/messages/delta?${params.toString()}`;
}

export async function syncEmails(userId: string): Promise<SyncResult> {
  const accessToken = await getAccessTokenForUser(userId);
  const state = await prisma.syncState.findUnique({ where: { userId } });

  let pageUrl = state?.deltaToken ?? getInitialDeltaUrl();
  let latestDeltaToken: string | null = state?.deltaToken ?? null;
  let synced = 0;
  let deleted = 0;

  while (pageUrl) {
    const payload = await fetchGraphMessages(accessToken, pageUrl);

    for (const message of payload.value) {
      if (!message.id) {
        continue;
      }

      if (message["@removed"]) {
        await prisma.email.deleteMany({
          where: { userId, messageId: message.id },
        });
        deleted += 1;
        continue;
      }

      const subject = message.subject?.trim() || "(No subject)";
      const bodyPreview = message.bodyPreview?.trim() ?? "";
      const snippet = bodyPreview.slice(0, 160);

      await prisma.email.upsert({
        where: {
          userId_messageId: {
            userId,
            messageId: message.id,
          },
        },
        create: {
          userId,
          messageId: message.id,
          subject,
          fromEmail: message.from?.emailAddress?.address ?? null,
          fromName: message.from?.emailAddress?.name ?? null,
          receivedAt: message.receivedDateTime
            ? new Date(message.receivedDateTime)
            : new Date(),
          snippet,
          bodyPreview,
        },
        update: {
          subject,
          fromEmail: message.from?.emailAddress?.address ?? null,
          fromName: message.from?.emailAddress?.name ?? null,
          receivedAt: message.receivedDateTime
            ? new Date(message.receivedDateTime)
            : new Date(),
          snippet,
          bodyPreview,
        },
      });
      synced += 1;
    }

    pageUrl = payload["@odata.nextLink"] ?? "";
    if (payload["@odata.deltaLink"]) {
      latestDeltaToken = payload["@odata.deltaLink"];
    }
  }

  const now = new Date();
  await prisma.syncState.upsert({
    where: { userId },
    create: {
      userId,
      deltaToken: latestDeltaToken,
      lastSyncedAt: now,
    },
    update: {
      deltaToken: latestDeltaToken,
      lastSyncedAt: now,
    },
  });

  return {
    synced,
    deleted,
    deltaTokenSaved: Boolean(latestDeltaToken),
    lastSyncedAt: now.toISOString(),
  };
}
