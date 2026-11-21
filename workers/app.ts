// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { routeAgentRequest } from "agents";
import { Hono } from "hono";
import { createRequestHandler } from "react-router";
import { app as apiApp, receiveEmail } from "./index";
import { EmailMCP } from "./mcp";
import type { Env } from "./types";
import { type MailIdentity } from "./lib/access-control";
import { configured, canonicalHost, safeMethod, loginPage, startGoogleLogin, completeGoogleLogin, currentIdentity, logout, PUBLIC_ORIGIN, LOGIN_PATH, listApprovedUsers, approveUser, revokeUser, refreshUser } from "./auth/google";

export { MailboxDO } from "./durableObject";
export { EmailAgent } from "./agent";
export { EmailMCP } from "./mcp";

declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: Env;
			ctx: ExecutionContext;
		};
	}
}

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

// Main app that wraps the API and adds React Router fallback
const app = new Hono<{ Bindings: Env; Variables: { mqIdentity: MailIdentity } }>();

// Self-hosted Google OIDC authentication; no Cloudflare Zero Trust subscription.
// All routes (including assets, API, WebSockets and preview URLs) fail closed
// unless served from the one configured production hostname.
app.use("*", async (c, next) => {
  if (import.meta.env.DEV) {
    c.set("mqIdentity", { email: "local-admin@localhost.invalid", isAdmin: true });
    return next();
  }
  if (!canonicalHost(c.req.raw)) return c.text("Open https://mailer.mahquantum.tech instead.", 403);
  const path = new URL(c.req.url).pathname;
  if (path === LOGIN_PATH || path === "/auth/google/start" || path === "/auth/google/callback" || path === "/auth/logout") {
    return next();
  }
  if (!configured(c.env)) return c.text("MQ Mailer Google authentication is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and MQ_ADMIN_EMAIL as Worker secrets.", 503);
  if (!safeMethod(c.req.raw)) return c.json({ error: "Cross-site request rejected" }, 403);
  let actor: MailIdentity | null;
  try {
    actor = await currentIdentity(c.req.raw, c.env);
  } catch {
    return c.json({ error: "Authentication store unavailable" }, 503);
  }
  if (!actor) {
    const accept = c.req.header("accept") || "";
    return accept.includes("text/html") && !path.startsWith("/api/")
      ? c.redirect(LOGIN_PATH, 302)
      : c.json({ error: "Sign in to MQ Mailer before accessing this resource" }, 401);
  }
  c.set("mqIdentity", actor);
  // Agent/MCP APIs are still admin-only because upstream tool calls have no
  // independent owner checks. WebSocket requests require same-site Origin.
  if ((path === "/mcp" || path.startsWith("/mcp/") || path.startsWith("/agents/")) && !actor.isAdmin) {
    return c.json({ error: "AI/MCP requires administrator privileges" }, 403);
  }
  if (path.startsWith("/agents/") && c.req.header("origin") !== PUBLIC_ORIGIN) {
    return c.json({ error: "Cross-site WebSocket rejected" }, 403);
  }
  await next();
});

app.get("/auth/login", (c) => loginPage(c.env, Boolean(c.req.query("error"))));
app.get("/auth/google/start", (c) => startGoogleLogin(c.req.raw, c.env));
app.get("/auth/google/callback", (c) => completeGoogleLogin(c.req.raw, c.env));
app.post("/auth/logout", (c) => logout(c.req.raw, c.env));

// Administrator-managed employee sign-in allowlist, separate from mailbox ACLs.
app.get("/api/v1/auth/users", async (c) => {
  if (!c.var.mqIdentity.isAdmin) return c.json({ error: "Administrator required" }, 403);
  return c.json(await listApprovedUsers(c.env));
});
app.post("/api/v1/auth/users", async (c) => {
  if (!c.var.mqIdentity.isAdmin) return c.json({ error: "Administrator required" }, 403);
  const body = await c.req.json().catch(() => null) as {email?:unknown} | null;
  const email = await approveUser(c.env, body?.email, c.var.mqIdentity.email);
  return email ? c.json({ email, status: "approved" }, 201) : c.json({ error: "Invalid or already approved email" }, 400);
});
app.delete("/api/v1/auth/users/:email", async (c) => {
  if (!c.var.mqIdentity.isAdmin) return c.json({ error: "Administrator required" }, 403);
  const ok = await revokeUser(c.env, c.req.param("email"));
  return ok ? c.json({ revoked: true }) : c.json({ error: "Administrator cannot be revoked" }, 400);
});
app.put("/api/v1/auth/users/:email", async (c) => {
  if (!c.var.mqIdentity.isAdmin) return c.json({ error: "Administrator required" }, 403);
  const ok = await refreshUser(c.env, c.req.param("email"));
  return ok ? c.json({ restored: true }) : c.json({ error: "Account not found or protected" }, 400);
});

// MCP server endpoint — used by AI coding tools (ProtoAgent, Claude Code, Cursor, etc.)
// Must be before API routes and React Router catch-all
const mcpHandler = EmailMCP.serve("/mcp", { binding: "EMAIL_MCP" });
app.all("/mcp", async (c) => {
	return mcpHandler.fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext);
});
app.all("/mcp/*", async (c) => {
	return mcpHandler.fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext);
});

// Mount the API routes
app.route("/", apiApp);

// Agent WebSocket routing - must be before React Router catch-all
app.all("/agents/*", async (c) => {
	const response = await routeAgentRequest(c.req.raw, c.env);
	if (response) return response;
	return c.text("Agent not found", 404);
});

// React Router catch-all: serves the SPA for all non-API routes
app.all("*", (c) => {
	return requestHandler(c.req.raw, {
		cloudflare: { env: c.env, ctx: c.executionCtx as ExecutionContext },
	});
});

// Export the Hono app as the default export with an email handler
export default {
	fetch: app.fetch,
	async email(
		event: { raw: ReadableStream; rawSize: number },
		env: Env,
		ctx: ExecutionContext,
	) {
		try {
			await receiveEmail(event, env, ctx);
		} catch (e) {
			console.error("Failed to process incoming email:", (e as Error).message, (e as Error).stack);
			// Re-throw so Cloudflare's email routing can retry delivery or bounce the message.
			// Swallowing the error would silently drop the email.
			throw e;
		}
	},
};
