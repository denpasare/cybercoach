import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { prisma } from "./prisma";
import { encryptOptional } from "./crypto";

/**
 * Wraps the Prisma adapter so OAuth access/refresh tokens are encrypted
 * at rest using AES-256-GCM before they ever hit the database.
 *
 * Reads stay simple: callers that need a plaintext token must use the
 * dedicated `getDecryptedAccount` helper in `src/lib/tokens.ts`.
 */
export function createEncryptedPrismaAdapter(): Adapter {
  const base = PrismaAdapter(prisma) as Adapter;

  const linkAccount = base.linkAccount?.bind(base);
  if (linkAccount) {
    base.linkAccount = (async (account: AdapterAccount) => {
      const encrypted: AdapterAccount = {
        ...account,
        access_token: encryptOptional(account.access_token) ?? undefined,
        refresh_token: encryptOptional(account.refresh_token) ?? undefined,
        id_token: encryptOptional(account.id_token) ?? undefined,
      };
      await linkAccount(encrypted);
    }) as Adapter["linkAccount"];
  }

  return base;
}
