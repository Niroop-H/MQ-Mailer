// Google OAuth security unit tests; no Google credentials, DNS or real users required.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const dir = await mkdtemp(path.join(process.cwd(), ".mq-auth-test-"));
await build({
  entryPoints: ["workers/auth/google.ts"], outfile: path.join(dir, "google.mjs"),
  bundle: true, platform: "node", target: "node22", format: "esm",
  packages: "external",
});
const auth = await import(pathToFileURL(path.join(dir, "google.mjs")).href);
test.after(async()=>await rm(dir,{recursive:true,force:true}));
const publicOrigin = "https://mailer.mahquantum.tech";
const admin = "owner@gmail.com";
function mockDb(session = null) {
  const calls = [];
  const db = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          calls.push({sql,args});
          if (sql.includes("mq_auth_sessions") && sql.includes("SELECT")) return session;
          return null;
        },
        all: async () => ({results: []}),
        run: async () => { calls.push({sql,args}); return {success:true}; },
      }),
    }),
  };
  return {db,calls};
}
const fakeEnv = (db) => ({
  D1_MAIL: db, GOOGLE_CLIENT_ID:"example.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "dummy-secret-in-server-only", MQ_ADMIN_EMAIL:admin,
});

test("login config fails closed and never asks user to enter a password", () => {
  assert.equal(auth.configured({D1_MAIL:{},GOOGLE_CLIENT_ID:"",GOOGLE_CLIENT_SECRET:"",MQ_ADMIN_EMAIL:admin}),false);
  const page = auth.loginPage({ D1_MAIL: {} });
  assert.equal(page.status,503);
});

test("only the configured custom domain accepts login; Workers dev is forbidden", async () => {
  const {db} = mockDb();
  const env = fakeEnv(db);
  assert.equal(auth.canonicalHost(new Request(publicOrigin + "/auth/google/start")),true);
  assert.equal(auth.canonicalHost(new Request("https://mq-mailer.mahquantum.workers.dev/auth/google/start")),false);
  const denied=await auth.startGoogleLogin(new Request("https://mq-mailer.mahquantum.workers.dev/auth/google/start"),env);
  assert.equal(denied.status,403);
});

test("OAuth starts use PKCE S256, nonce, randomized state, and secure cookies", async () => {
  const {db,calls}=mockDb();
  const result=await auth.startGoogleLogin(new Request(publicOrigin+"/auth/google/start"),fakeEnv(db));
  assert.equal(result.status,303);
  const url=new URL(result.headers.get("location"));
  assert.equal(url.hostname,"accounts.google.com");
  assert.equal(url.searchParams.get("scope"),"openid email profile");
  assert.equal(url.searchParams.get("code_challenge_method"),"S256");
  assert.equal(url.searchParams.get("redirect_uri"),publicOrigin+"/auth/google/callback");
  assert.ok(url.searchParams.get("nonce")?.length>=25);
  assert.ok(url.searchParams.get("state")?.length>=25);
  assert.ok(url.searchParams.get("code_challenge")?.length>=40);
  const c=result.headers.get("set-cookie")||"";
  assert.ok(c.includes("__Host-mq_oauth="));
  assert.ok(c.includes("HttpOnly"));
  assert.ok(c.includes("SameSite=Lax"));
  assert.ok(c.includes("Secure"));
  assert.equal(c.includes("dummy-secret"),false);
  assert.ok(calls.some(x=>x.sql.includes("INSERT INTO mq_auth_flows")));
});

test("cross-site POSTs and cookies cannot invoke privileged API mutations", () => {
  assert.equal(auth.safeMethod(new Request(publicOrigin+"/api/v1/mailboxes",{method:"POST"})),false);
  assert.equal(auth.safeMethod(new Request(publicOrigin+"/api/v1/mailboxes",{method:"POST",headers:{origin:"https://evil.example"}})),false);
  assert.equal(auth.safeMethod(new Request(publicOrigin+"/api/v1/mailboxes",{method:"POST",headers:{origin:publicOrigin,"sec-fetch-site":"cross-site"}})),false);
  assert.equal(auth.safeMethod(new Request(publicOrigin+"/api/v1/mailboxes",{method:"POST",headers:{origin:publicOrigin,"sec-fetch-site":"same-origin"}})),true);
  assert.equal(auth.safeMethod(new Request(publicOrigin+"/api/v1/mailboxes")),true);
});

test("sign-in trusts Gmail and verified Workspace hosted domains, not unaffiliated email aliases", () => {
  assert.equal(auth.googleEmailAllowed("owner@gmail.com"),true);
  assert.equal(auth.googleEmailAllowed("user@company.com","company.com"),true);
  assert.equal(auth.googleEmailAllowed("user@company.com"),false);
  assert.equal(auth.googleEmailAllowed("user@company.com","evil.com"),false);
  assert.equal(auth.googleEmailAllowed("someone@yahoo.com"),false);
  // Free Google Accounts can be created with an existing international mailbox.
  assert.equal(auth.googleEmailAllowed("ceo@international.mahquantum.tech"),true);
  assert.equal(auth.googleEmailAllowed("ceo@international.mahquantum.tech","international.mahquantum.tech"),true);
  assert.equal(auth.googleEmailAllowed("ceo@international.mahquantum.tech","evil.example"),false);
  assert.equal(auth.googleEmailAllowed("ceo@mahquantum.tech"),false);
});

test("single-use OAuth callback state is required before any network exchange", async () => {
  const {db}=mockDb(); const env=fakeEnv(db);
  const response=await auth.completeGoogleLogin(new Request(publicOrigin+"/auth/google/callback?code=fake-code&state=unknown"),env);
  assert.equal(response.status,303);
  assert.ok(response.headers.get("location").includes("error=1"));
});

test("session resolution validates administrator identity and expiry on every request", async () => {
  const secret="very-long-random-session-token_abcdefghijklmnopqrstuvwxyzABCDE";
  const hash=createHash("sha256").update(secret).digest("hex");
  const {db,calls}=mockDb({email:admin,google_sub:"google-sub-123",expires_at:9999999999});
  const actor=await auth.currentIdentity(new Request(publicOrigin+"/",{headers:{cookie:"__Host-mq_session="+secret}}),fakeEnv(db));
  assert.deepEqual(actor,{email:admin,isAdmin:true});
  assert.ok(calls.some(x=>x.args[0]===hash));
  const missing=await auth.currentIdentity(new Request(publicOrigin+"/"),fakeEnv(db));
  assert.equal(missing,null);
});

test("logout requires same-origin POST and revokes the hashed session", async () => {
  const {db,calls}=mockDb(); const env=fakeEnv(db);
  const malicious=await auth.logout(new Request(publicOrigin+"/auth/logout",{method:"POST",headers:{origin:"https://evil.example"}}),env);
  assert.equal(malicious.status,403);
  const good=await auth.logout(new Request(publicOrigin+"/auth/logout",{method:"POST",headers:{origin:publicOrigin,cookie:"__Host-mq_session=abc123","sec-fetch-site":"same-origin"}}),env);
  assert.equal(good.status,303);
  assert.ok(good.headers.get("set-cookie")?.includes("Max-Age=0"));
  assert.ok(calls.some(x=>x.sql.includes("DELETE FROM mq_auth_sessions")));
});
