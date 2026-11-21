// MAH Quantum Mail: passwordless, independent Google OIDC + D1 sessions.
// No Cloudflare Access, paid identity provider, stored passwords, or Google refresh tokens.
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "../types";
import { normalizeIdentity, type MailIdentity } from "../lib/access-control";

export const PUBLIC_ORIGIN = "https://mailer.mahquantum.tech";
export const LOGIN_PATH = "/auth/login";
const CALLBACK_PATH = "/auth/google/callback";
const GOOGLE_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const FLOW_COOKIE = "__Host-mq_oauth";
const SESSION_COOKIE = "__Host-mq_session";
const FLOW_TTL = 10 * 60;
const SESSION_TTL = 12 * 60 * 60;

function token(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash).map((v) => v.toString(16).padStart(2, "0")).join("");
}
function getCookie(request: Request, name: string): string | null {
  const pairs = (request.headers.get("cookie") || "").split(";");
  const found = pairs.map((part) => part.trim()).filter((part) => part.startsWith(name + "="));
  return found.length === 1 ? found[0].slice(name.length + 1) : null;
}
function cookie(name: string, value: string, seconds: number): string {
  return name + "=" + value + "; Path=/; Max-Age=" + seconds + "; HttpOnly; Secure; SameSite=Lax";
}
function clearCookie(name: string): string {
  return cookie(name, "", 0);
}
function redirect(location: string, setCookies: string[] = []): Response {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 303, headers });
}
function denied(reason: string, status = 403): Response {
  return new Response(reason, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
function now(): number { return Math.floor(Date.now() / 1000); }

export function configured(env: Env): boolean {
  return Boolean(env.D1_MAIL && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET &&
    normalizeIdentity(env.MQ_ADMIN_EMAIL));
}
export function canonicalHost(request: Request): boolean {
  const url = new URL(request.url);
  return url.origin === PUBLIC_ORIGIN;
}
export function safeMethod(request: Request): boolean {
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return true;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  // Same-origin fetch includes Origin on writes; legacy clients may instead send
  // Sec-Fetch-Site. Never accept missing both or any cross-site signal.
  return origin === PUBLIC_ORIGIN && (!fetchSite || fetchSite === "same-origin");
}
export function googleEmailAllowed(email: string, hostedDomain?: unknown): boolean {
  const normalized = normalizeIdentity(email);
  if (!normalized || normalized !== email) return false;
  if (normalized.endsWith("@gmail.com")) return true;
  if (typeof hostedDomain !== "string" || !hostedDomain) return false;
  return normalized.endsWith("@" + hostedDomain.toLowerCase()) &&
    hostedDomain.includes(".") && !hostedDomain.includes("/");
}
export function isAuthPath(path: string): boolean {
  return path === LOGIN_PATH || path === "/auth/google/start" || path === CALLBACK_PATH ||
    path === "/auth/logout";
}

interface DbSession { email: string; google_sub: string; expires_at: number }
interface DbUser { email: string; google_sub: string | null; disabled: number }
export async function currentIdentity(request: Request, env: Env): Promise<MailIdentity | null> {
  const raw = getCookie(request, SESSION_COOKIE);
  const admin = normalizeIdentity(env.MQ_ADMIN_EMAIL);
  if (!raw || raw.length < 35 || raw.length > 150 || !admin || !env.D1_MAIL) return null;
  const hash = await digest(raw);
  const session = await env.D1_MAIL.prepare(
    "SELECT email,google_sub,expires_at FROM mq_auth_sessions WHERE session_hash=? AND expires_at>?"
  ).bind(hash, now()).first<DbSession>();
  if (!session) return null;
  const email = normalizeIdentity(session.email);
  if (!email || !session.google_sub || email !== session.email) return null;
  if (email === admin) return { email, isAdmin: true };
  const user = await env.D1_MAIL.prepare(
    "SELECT email,google_sub,disabled FROM mq_auth_users WHERE email=? AND google_sub=? AND disabled=0"
  ).bind(email, session.google_sub).first<DbUser>();
  return user ? { email, isAdmin: false } : null;
}

export function loginPage(env: Env, error = false): Response {
  const ready = configured(env);
  const status = !ready
    ? "<p class='warning'>Google sign-in is not configured yet. The administrator must add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and MQ_ADMIN_EMAIL to the Worker secrets.</p>"
    : error ? "<p class='warning'>Sign-in was not completed. Please try again or ask the administrator for access.</p>" : "";
  const link = ready ? "<a class='button' href='/auth/google/start'>Continue with Google</a>" : "";
  const html = "<!doctype html><html lang='en' style='color-scheme:light'><head><meta charset='utf-8'><meta name='theme-color' content='#ffffff'><meta name='color-scheme' content='light'><meta name='viewport' content='width=device-width,initial-scale=1'><meta name='robots' content='noindex,nofollow'><title>MQ Mailer | Secure sign in</title>" +
    "<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#f4f6f9;color:#172334;font-family:Aptos,Inter,Arial,sans-serif;display:grid;place-items:center;padding:24px}" +
    "main{width:min(440px,100%);padding:40px 34px;background:#ffffff;border:1px solid #e1e5eb;border-radius:18px;box-shadow:0 18px 65px #1c2f4a12}" +
    "h1{font-size:29px;margin:10px 0;color:#182335}p{line-height:1.6;color:#4c5b70}small{color:#63738a}.over{font-size:12px;letter-spacing:.19em;color:#796021;font-weight:750}" +
    ".button{display:block;text-decoration:none;text-align:center;background:#172f4b;color:#fff;border-radius:9px;padding:15px;font-weight:700;margin:25px 0}" +
    ".button:hover{background:#24466a}.warning{color:#714516;padding:12px;background:#fff6df;border:1px solid #f0dcae;border-radius:8px}</style></head>" +
    "<body><main><span class='over'>MAH QUANTUM</span><h1>MQ Mailer</h1><p>International email workspace. Sign in with an approved Google account to access only your assigned mailboxes.</p>" +
    status + link + "<small>Protected with server-verified Google identity and encrypted HTTPS session cookies. Existing Zoho mail is separate.</small></main></body></html>";
  return new Response(html, { status: ready ? 200 : 503, headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "X-Frame-Options": "DENY",
  } });
}

export async function startGoogleLogin(request: Request, env: Env): Promise<Response> {
  if (!canonicalHost(request)) return denied("Use mailer.mahquantum.tech to sign in.");
  if (!configured(env)) return loginPage(env);
  const state = token(32);
  const verifier = token(48);
  const nonce = token(32);
  const challenge = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challengeBase64 = btoa(String.fromCharCode(...new Uint8Array(challenge))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  await env.D1_MAIL.prepare("DELETE FROM mq_auth_flows WHERE expires_at<?").bind(now()).run();
  await env.D1_MAIL.prepare("INSERT INTO mq_auth_flows(state_hash,verifier,nonce,expires_at) VALUES(?,?,?,?)")
    .bind(await digest(state), verifier, nonce, now() + FLOW_TTL).run();
  const url = new URL(GOOGLE_AUTHORIZE);
  url.search = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: PUBLIC_ORIGIN + CALLBACK_PATH,
    response_type: "code",
    scope: "openid email profile",
    state, nonce,
    code_challenge: challengeBase64,
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  }).toString();
  return redirect(url.toString(), [cookie(FLOW_COOKIE, state, FLOW_TTL)]);
}

interface AuthFlow { verifier: string; nonce: string }
interface GoogleTokens { id_token?: string }
export async function completeGoogleLogin(request: Request, env: Env): Promise<Response> {
  if (!canonicalHost(request)) return denied("Use the MQ Mailer custom domain.");
  if (!configured(env)) return loginPage(env);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = getCookie(request, FLOW_COOKIE);
  const reset = clearCookie(FLOW_COOKIE);
  if (!code || code.length > 4096 || !state || state.length > 150 || !savedState ||
      state !== savedState || url.searchParams.has("error")) return redirect(PUBLIC_ORIGIN + LOGIN_PATH + "?error=1", [reset]);
  const flow = await env.D1_MAIL.prepare(
    "DELETE FROM mq_auth_flows WHERE state_hash=? AND expires_at>? RETURNING verifier,nonce"
  ).bind(await digest(state), now()).first<AuthFlow>();
  if (!flow) return redirect(PUBLIC_ORIGIN + LOGIN_PATH + "?error=1", [reset]);
  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: PUBLIC_ORIGIN + CALLBACK_PATH,
        grant_type: "authorization_code", code_verifier: flow.verifier,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) return redirect(PUBLIC_ORIGIN + LOGIN_PATH + "?error=1", [reset]);
    const tokens = await tokenResponse.json() as GoogleTokens;
    if (!tokens.id_token) throw new Error("Google did not return an ID token");
    const { payload } = await jwtVerify(tokens.id_token, GOOGLE_JWKS, {
      audience: env.GOOGLE_CLIENT_ID,
      issuer: ["https://accounts.google.com", "accounts.google.com"],
    });
    if (payload.nonce !== flow.nonce || payload.email_verified !== true ||
        typeof payload.sub !== "string" || !payload.sub || typeof payload.email !== "string") {
      throw new Error("Google identity verification rejected");
    }
    const email = normalizeIdentity(payload.email);
    if (!email || !googleEmailAllowed(email, payload.hd)) throw new Error("Google email must be Gmail or Workspace");
    const admin = normalizeIdentity(env.MQ_ADMIN_EMAIL);
    if (email !== admin) {
      const approved = await env.D1_MAIL.prepare(
        "SELECT email,google_sub,disabled FROM mq_auth_users WHERE email=?"
      ).bind(email).first<DbUser>();
      if (!approved || approved.disabled || (approved.google_sub && approved.google_sub !== payload.sub)) {
        return denied("This account is not approved. Ask the MQ Mailer administrator for access.");
      }
      // Bind first approved Google subject atomically; future address reassignments
      // cannot give a different Google account the prior employee's access.
      if (!approved.google_sub) {
        await env.D1_MAIL.prepare(
          "UPDATE mq_auth_users SET google_sub=? WHERE email=? AND google_sub IS NULL AND disabled=0"
        ).bind(payload.sub, email).run();
        const bound = await env.D1_MAIL.prepare(
          "SELECT google_sub FROM mq_auth_users WHERE email=? AND disabled=0"
        ).bind(email).first<{google_sub:string}>();
        if (!bound || bound.google_sub !== payload.sub) throw new Error("Employee identity changed during login");
      }
    }
    const sid = token(48);
    const issued = now();
    await env.D1_MAIL.prepare("INSERT INTO mq_auth_sessions(session_hash,email,google_sub,created_at,expires_at) VALUES(?,?,?,?,?)")
      .bind(await digest(sid),email,payload.sub,issued,issued+SESSION_TTL).run();
    return redirect(PUBLIC_ORIGIN + "/", [reset,cookie(SESSION_COOKIE,sid,SESSION_TTL)]);
  } catch {
    return redirect(PUBLIC_ORIGIN + LOGIN_PATH + "?error=1", [reset]);
  }
}

export async function logout(request: Request, env: Env): Promise<Response> {
  if (!canonicalHost(request) || !safeMethod(request)) return denied("Cross-site logout rejected.");
  const raw = getCookie(request, SESSION_COOKIE);
  if (raw && env.D1_MAIL) {
    await env.D1_MAIL.prepare("DELETE FROM mq_auth_sessions WHERE session_hash=?").bind(await digest(raw)).run();
  }
  return redirect(PUBLIC_ORIGIN + LOGIN_PATH, [clearCookie(SESSION_COOKIE),clearCookie(FLOW_COOKIE)]);
}

export async function listApprovedUsers(env: Env): Promise<{email:string; disabled:number; bound:boolean}[]> {
  const r = await env.D1_MAIL.prepare(
    "SELECT email,disabled,(google_sub IS NOT NULL) AS bound FROM mq_auth_users ORDER BY email LIMIT 200"
  ).all<{email:string;disabled:number;bound:number}>();
  return (r.results || []).map((x) => ({email:x.email,disabled:x.disabled,bound:Boolean(x.bound)}));
}
export async function approveUser(env: Env, emailRaw: unknown, admin: string): Promise<string | null> {
  const email = normalizeIdentity(emailRaw);
  if (!email || email === normalizeIdentity(env.MQ_ADMIN_EMAIL)) return null;
  const registered = await env.D1_MAIL.prepare("SELECT email FROM mq_auth_users WHERE email=?").bind(email).first();
  if (registered) return null;
  await env.D1_MAIL.prepare("INSERT INTO mq_auth_users(email,approved_by,approved_at,disabled) VALUES(?,?,?,0)")
    .bind(email, admin, now()).run();
  return email;
}
export async function revokeUser(env: Env, emailRaw: unknown): Promise<boolean> {
  const email = normalizeIdentity(emailRaw);
  if (!email || email === normalizeIdentity(env.MQ_ADMIN_EMAIL)) return false;
  await env.D1_MAIL.batch([
    env.D1_MAIL.prepare("UPDATE mq_auth_users SET disabled=1 WHERE email=?").bind(email),
    env.D1_MAIL.prepare("DELETE FROM mq_auth_sessions WHERE email=?").bind(email),
  ]);
  return true;
}
export async function refreshUser(env: Env, emailRaw: unknown): Promise<boolean> {
  const email = normalizeIdentity(emailRaw);
  if (!email || email === normalizeIdentity(env.MQ_ADMIN_EMAIL)) return false;
  const found = await env.D1_MAIL.prepare("SELECT email FROM mq_auth_users WHERE email=?").bind(email).first();
  if (!found) return false;
  // Re-enable only the same bound Google account. To change the subject,
  // the administrator must perform a separately audited identity recovery.
  await env.D1_MAIL.prepare("UPDATE mq_auth_users SET disabled=0 WHERE email=?").bind(email).run();
  return true;
}
