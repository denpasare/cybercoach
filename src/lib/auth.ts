import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { createEncryptedPrismaAdapter } from "./auth-adapter";
import { getEnv } from "./env";

const env = (() => {
  try {
    return getEnv();
  } catch {
    return null;
  }
})();

/**
 * Single source of truth for Auth.js (NextAuth v5).
 *
 * - Database sessions (Session model) — session token rides in an
 *   HTTP-only, Secure, SameSite=Lax cookie.
 * - Microsoft Entra ID is the ONLY provider. Scopes include Mail.Read
 *   so the same login flow grants Graph access for inbox sync.
 * - Tokens are encrypted via the wrapped Prisma adapter before write.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createEncryptedPrismaAdapter(),
  session: { strategy: "database" },
  secret: env?.AUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    MicrosoftEntraID({
      clientId:
        env?.AUTH_MICROSOFT_ENTRA_ID_ID ??
        process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret:
        env?.AUTH_MICROSOFT_ENTRA_ID_SECRET ??
        process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: `https://login.microsoftonline.com/${
        env?.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ??
        process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ??
        "common"
      }/v2.0`,
      authorization: {
        params: {
          scope:
            "openid email profile offline_access Mail.Read",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
