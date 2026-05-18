import { prisma } from "./prisma";
import { decrypt, encrypt } from "./crypto";
import { getEnv } from "./env";

const MICROSOFT_PROVIDER = "microsoft-entra-id";
/** Refresh a few minutes before expiry to avoid clock-skew races. */
const EXPIRY_SKEW_SECONDS = 60;

export class MissingMicrosoftAccountError extends Error {
  constructor(userId: string) {
    super(`No Microsoft account linked for user ${userId}`);
    this.name = "MissingMicrosoftAccountError";
  }
}

export class TokenRefreshError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "TokenRefreshError";
  }
}

interface MicrosoftAccountTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

async function loadAccount(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: MICROSOFT_PROVIDER },
  });
  if (!account) throw new MissingMicrosoftAccountError(userId);
  return account;
}

function isExpired(expiresAt: number | null | undefined): boolean {
  if (!expiresAt) return true;
  const now = Math.floor(Date.now() / 1000);
  return expiresAt - EXPIRY_SKEW_SECONDS <= now;
}

/**
 * Exchange a refresh token for a new access token against the Microsoft
 * identity platform v2 token endpoint.
 */
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}> {
  const env = getEnv();
  const tenant = env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID || "common";
  const url = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: env.AUTH_MICROSOFT_ENTRA_ID_ID,
    client_secret: env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: "openid email profile offline_access Mail.Read",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new TokenRefreshError(
      `Microsoft token refresh failed (${res.status}): ${text}`,
      res.status,
    );
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
}

/**
 * Return a valid (non-expired) access token for the user, refreshing
 * via the stored refresh token when necessary. All token material in
 * the DB is encrypted at rest with AES-256-GCM.
 */
export async function getValidAccessToken(
  userId: string,
): Promise<MicrosoftAccountTokens> {
  const account = await loadAccount(userId);

  const refreshToken = account.refresh_token
    ? decrypt(account.refresh_token)
    : null;
  const accessToken = account.access_token
    ? decrypt(account.access_token)
    : null;

  if (accessToken && !isExpired(account.expires_at)) {
    return {
      accessToken,
      refreshToken,
      expiresAt: account.expires_at ?? null,
    };
  }

  if (!refreshToken) {
    throw new TokenRefreshError(
      "Access token expired and no refresh token is available — user must re-authenticate.",
    );
  }

  const refreshed = await refreshAccessToken(refreshToken);
  const newExpiresAt =
    Math.floor(Date.now() / 1000) + Number(refreshed.expires_in ?? 3600);

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: encrypt(refreshed.access_token),
      refresh_token: refreshed.refresh_token
        ? encrypt(refreshed.refresh_token)
        : account.refresh_token,
      expires_at: newExpiresAt,
    },
  });

  return {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? refreshToken,
    expiresAt: newExpiresAt,
  };
}
