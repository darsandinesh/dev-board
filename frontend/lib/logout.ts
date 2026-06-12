"use client";

import { signOut } from "next-auth/react";

const ISSUER = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;

/**
 * Full sign-out: clear the local next-auth session AND end the Keycloak SSO
 * session, so the next "Sign in" actually prompts (and you can switch users).
 * Plain signOut() only drops the local cookie — Keycloak would silently
 * re-authenticate from its still-valid SSO cookie.
 */
export async function federatedSignOut(idToken?: string) {
  // Clear the local session first (no redirect — we redirect to Keycloak next).
  await signOut({ redirect: false });

  const origin = window.location.origin;
  if (!ISSUER) {
    window.location.href = "/";
    return;
  }
  const params = new URLSearchParams({ post_logout_redirect_uri: `${origin}/` });
  if (idToken) params.set("id_token_hint", idToken);
  else params.set("client_id", "devboard-app");

  window.location.href = `${ISSUER}/protocol/openid-connect/logout?${params.toString()}`;
}
