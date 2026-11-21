-- Passwordless MQ Mailer authentication, D1 Free tier.
-- Emails are an administrator-maintained allowlist; Google subject binds on first approved sign-in.
CREATE TABLE IF NOT EXISTS mq_auth_users (
  email TEXT PRIMARY KEY NOT NULL,
  google_sub TEXT UNIQUE,
  approved_by TEXT NOT NULL,
  approved_at INTEGER NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0,1))
);
CREATE TABLE IF NOT EXISTS mq_auth_flows (
  state_hash TEXT PRIMARY KEY NOT NULL,
  verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS mq_auth_flows_expiration ON mq_auth_flows(expires_at);
CREATE TABLE IF NOT EXISTS mq_auth_sessions (
  session_hash TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  google_sub TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS mq_auth_sessions_expiration ON mq_auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS mq_auth_sessions_email ON mq_auth_sessions(email);
