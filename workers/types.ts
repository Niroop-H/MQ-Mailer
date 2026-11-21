// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

export interface Env extends Cloudflare.Env {
	D1_MAIL: D1Database;
	BUCKET?: R2Bucket;
	EMAIL?: SendEmail;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	BREVO_API_KEY?: string;
	MQ_ADMIN_EMAIL: string;
}
