// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { routeAgentRequest } from "agents";
import { Hono } from "hono";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { createRequestHandler } from "react-router";
import { app as apiApp, receiveEmail } from "./index";
import { EmailMCP } from "./mcp";
import type { Env } from "./types";
import { normalizeIdentity, type MailIdentity } from "./lib/access-control";

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

function getAccessUrls(teamDomain: string) {
	const certsPath = "/cdn-cgi/access/certs";
	const teamUrl = new URL(teamDomain);
	const issuer = teamUrl.origin;
	const certsUrl = teamUrl.pathname.endsWith(certsPath)
		? teamUrl
		: new URL(certsPath, issuer);

	return { issuer, certsUrl };
}

// Main app that wraps the API and adds React Router fallback
const app = new Hono<{ Bindings: Env; Variables: { mqIdentity: MailIdentity } }>();

// Cloudflare Access JWT validation middleware (production only)
app.use("*", async (c, next) => {
	// Development-only trusted stub. Never expose local dev publicly.
	if (import.meta.env.DEV) {
		c.set("mqIdentity", { email: "local-admin@localhost.invalid", isAdmin: true });
		return next();
	}

	const { POLICY_AUD, TEAM_DOMAIN, MQ_ADMIN_EMAIL } = c.env;

	// Fail closed in production if Access is not configured.
	if (!POLICY_AUD || !TEAM_DOMAIN || !MQ_ADMIN_EMAIL) {
		return c.text(
			"MAH Quantum Mail access must be configured. Set POLICY_AUD, TEAM_DOMAIN, and MQ_ADMIN_EMAIL.",
			500,
		);
	}

	const token = c.req.header("cf-access-jwt-assertion");
	if (!token) {
		return c.text("Missing required CF Access JWT", 403);
	}

	try {
		const { issuer, certsUrl } = getAccessUrls(TEAM_DOMAIN);
		const JWKS = createRemoteJWKSet(certsUrl);
		const { payload } = await jwtVerify(token, JWKS, {
			issuer,
			audience: POLICY_AUD,
		});
		const authenticatedEmail = normalizeIdentity(payload.email);
		const adminEmail = normalizeIdentity(MQ_ADMIN_EMAIL);
		if (!authenticatedEmail || !adminEmail) {
			return c.text("Cloudflare Access identity is not a valid email", 403);
		}
		c.set("mqIdentity", {
			email: authenticatedEmail,
			isAdmin: authenticatedEmail === adminEmail,
		});
	} catch {
		return c.text("Invalid or expired Access token", 403);
	}

	// AI agent and MCP have their own Durable Object lifecycles. Until their
	// internal tool executions enforce mailbox ACLs, disallow employee access.
	// The administrator can use them; employees still have isolated webmail.
	const path = new URL(c.req.url).pathname;
	if ((path === "/mcp" || path.startsWith("/mcp/") || path.startsWith("/agents/"))
		&& !c.var.mqIdentity.isAdmin) {
		return c.text("AI/MCP is currently restricted to mailbox administrators", 403);
	}
	return next();
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
