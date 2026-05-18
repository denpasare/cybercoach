import type { NextAuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import AzureAD from "next-auth/providers/azure-ad";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/token-crypto";

function withEncryptedTokenAdapter(): Adapter {
  const adapter = PrismaAdapter(prisma) as Adapter;

  return {
    ...adapter,
    async linkAccount(
      account: Parameters<NonNullable<Adapter["linkAccount"]>>[0],
    ) {
      await prisma.account.upsert({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        create: {
          userId: account.userId,
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          refresh_token: encryptToken(account.refresh_token),
          access_token: encryptToken(account.access_token),
          expires_at: account.expires_at,
          token_type: account.token_type,
          scope: account.scope,
          id_token: account.id_token,
          session_state: account.session_state?.toString() ?? null,
        },
        update: {
          refresh_token: encryptToken(account.refresh_token),
          access_token: encryptToken(account.access_token),
          expires_at: account.expires_at,
          token_type: account.token_type,
          scope: account.scope,
          id_token: account.id_token,
          session_state: account.session_state?.toString() ?? null,
        },
      });

      return;
    },
  } as Adapter;
}

export const authOptions: NextAuthOptions = {
  adapter: withEncryptedTokenAdapter(),
  providers: [
    AzureAD({
      id: "microsoft",
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID ?? "",
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ?? "",
      tenantId: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ?? "common",
      authorization: {
        params: {
          scope: "openid email profile offline_access Mail.Read",
        },
      },
      profile(profile) {
        const microsoftProfile = profile as {
          sub: string;
          name?: string;
          email?: string;
          preferred_username?: string;
          picture?: string;
        };

        return {
          id: microsoftProfile.sub,
          name: microsoftProfile.name ?? null,
          email:
            microsoftProfile.email ??
            microsoftProfile.preferred_username ??
            `${microsoftProfile.sub}@unknown.microsoft`,
          image: microsoftProfile.picture ?? null,
        };
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.provider !== "microsoft") {
        return false;
      }

      if (!user.id) {
        return false;
      }

      await prisma.account.upsert({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        create: {
          userId: user.id,
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          refresh_token: encryptToken(account.refresh_token),
          access_token: encryptToken(account.access_token),
          expires_at: account.expires_at,
          token_type: account.token_type,
          scope: account.scope,
          id_token: account.id_token,
          session_state: account.session_state?.toString() ?? null,
        },
        update: {
          refresh_token: encryptToken(account.refresh_token),
          access_token: encryptToken(account.access_token),
          expires_at: account.expires_at,
          token_type: account.token_type,
          scope: account.scope,
          id_token: account.id_token,
          session_state: account.session_state?.toString() ?? null,
        },
      });

      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }

      return session;
    },
  },
};
