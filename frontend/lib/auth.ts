import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import KeycloakProvider from "next-auth/providers/keycloak";

const ISSUER = process.env.KEYCLOAK_ISSUER!; // e.g. http://localhost:8080/realms/devboard

/**
 * Refresh the Keycloak access token using the stored refresh_token.
 * (This is the Day-6 graceful-expiry piece; included here so the app survives
 * the short 5-min access-token lifetime during normal use.)
 */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const res = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.KEYCLOAK_CLIENT_ID!,
        client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
        refresh_token: token.refreshToken ?? "",
      }),
    });
    const refreshed = await res.json();
    if (!res.ok) throw refreshed;
    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: ISSUER,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: stash Keycloak tokens.
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.idToken = account.id_token; // needed for Keycloak federated logout
        token.expiresAt = account.expires_at;
        return token;
      }
      // Still valid (60s skew buffer).
      if (token.expiresAt && Date.now() / 1000 < token.expiresAt - 60) {
        return token;
      }
      // Expired: refresh.
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.idToken = token.idToken;
      session.error = token.error;
      return session;
    },
  },
};
