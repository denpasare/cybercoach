import type { Adapter, AdapterAccount } from "next-auth/adapters";
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/token-crypto";

function withEncryptedTokenAdapter(): Adapter {
  const adapter = PrismaAdapter(prisma);

  return {
    ...adapter,
    async linkAccount(account: AdapterAccount) {
      return prisma.account.upsert({
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
    },
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: withEncryptedTokenAdapter(),
  providers: [
    MicrosoftEntraID({
      id: "microsoft",
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
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
    strategy: "database",
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
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
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }

      return session;
    },
  },
  trustHost: true,
});
