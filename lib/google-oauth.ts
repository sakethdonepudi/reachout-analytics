import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import type { NextRequest } from "next/server";
import { signPayload, verifyPayload } from "@/lib/signed-cookie";
import { createPkce, createOAuthState } from "@/lib/oauth-pkce";

export const GOOGLE_STATE_COOKIE = "ro_oauth_state";
export const GOOGLE_STATE_TTL = 10 * 60 * 1000;
export const GOOGLE_SCOPES = ["openid", "email", "profile"];

export type GoogleState = {
  state: string;
  nonce: string;
  verifier: string;
  next?: string | null;
};

export function googleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET && !!process.env.ADMIN_SESSION_SECRET;
}

export function redirectUri(req: NextRequest): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  return `${new URL(req.url).origin}/api/auth/google/callback`;
}

export function googleClient(req: NextRequest): OAuth2Client {
  return new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: redirectUri(req),
  });
}

export function setGoogleStateCookie(response: Response, payload: GoogleState) {
  const token = signPayload(payload as unknown as Record<string, unknown>, process.env.ADMIN_SESSION_SECRET ?? "", GOOGLE_STATE_TTL);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${GOOGLE_STATE_COOKIE}=${token}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=600${secure}`,
  );
}

export function readGoogleStateCookie(req: NextRequest): GoogleState | null {
  const token = req.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  return verifyPayload<GoogleState>(token, process.env.ADMIN_SESSION_SECRET ?? "");
}

export function clearGoogleStateCookie(response: Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${GOOGLE_STATE_COOKIE}=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

export function createGoogleFlow() {
  const pkce = createPkce();
  const { state, nonce } = createOAuthState();
  return { ...pkce, state, nonce };
}

export function googleAuthUrl(req: NextRequest, flow: ReturnType<typeof createGoogleFlow>): string {
  const client = googleClient(req);
  return client.generateAuthUrl({
    access_type: "online",
    scope: GOOGLE_SCOPES,
    prompt: "select_account",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: flow.challenge,
    code_challenge_method: CodeChallengeMethod.S256,
    include_granted_scopes: true,
  });
}

export type GoogleProfile = { email: string; name: string; picture: string | null };

/** Verify the ID token with Google's library (signature, iss, aud, exp, nonce, email_verified). */
export async function verifyGoogleIdToken(req: NextRequest, idToken: string, nonce: string): Promise<GoogleProfile> {
  const client = googleClient(req);
  const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload) throw new Error("Missing ID token payload");
  if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") throw new Error("Invalid issuer");
  if (payload.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error("Invalid audience");
  if (payload.email_verified !== true) throw new Error("Email is not verified");
  if (payload.nonce !== nonce) throw new Error("Invalid nonce");
  if (!payload.email) throw new Error("Missing email");
  return { email: payload.email.toLowerCase(), name: payload.name ?? "", picture: payload.picture ?? null };
}

export async function exchangeGoogleCode(req: NextRequest, code: string, verifier: string) {
  const client = googleClient(req);
  const { tokens } = await client.getToken({ code, codeVerifier: verifier, redirect_uri: redirectUri(req) });
  if (!tokens.id_token) throw new Error("No ID token returned");
  return tokens;
}

export function isGoogleEmailVerified(payload: { email_verified?: unknown }): boolean {
  return payload.email_verified === true;
}
