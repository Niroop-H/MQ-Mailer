-- D1 free-tier object store schema for MQ Mailer; 512 KiB chunks.
-- Run: npx wrangler d1 execute mq-mailer-free --remote --file=migrations/0001_mail_objects.sql
CREATE TABLE IF NOT EXISTS mq_objects (
    key TEXT PRIMARY KEY,
    size INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS mq_chunks (
    key TEXT NOT NULL,
    idx INTEGER NOT NULL,
    payload BLOB NOT NULL,
    PRIMARY KEY (key, idx)
);
CREATE INDEX IF NOT EXISTS mq_objects_key_idx ON mq_objects(key);
