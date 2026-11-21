// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
// https://opensource.org/licenses/Apache-2.0
//
// MAH Quantum sending: free Brevo transactional API adapter.
// Never activate the Cloudflare paid send_email binding. Inbound is separate.

import type { Env } from "./types";

export interface SendEmailParams {
  to: string | string[];
  from: string | { email: string; name: string };
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string | { email: string; name: string };
  attachments?: {
    content: string; // base64
    filename: string;
    type: string;
    disposition: "attachment" | "inline";
    contentId?: string;
  }[];
  headers?: Record<string, string>;
}
type Address = { email: string; name?: string };
function parseAddress(value: string): Address {
  if (typeof value !== "string" || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value) || value.length > 254) {
    throw new Error("Invalid email address for the sending provider");
  }
  return { email: value.trim().toLowerCase() };
}
function recipients(value?: string | string[]): Address[] | undefined {
  if (!value) return undefined;
  const arr = Array.isArray(value) ? value : [value];
  if (arr.length < 1 || arr.length > 30) throw new Error("Unsupported recipient count");
  return arr.map(parseAddress);
}
export function buildBrevoMessage(params: SendEmailParams): Record<string,unknown> {
  const sender = typeof params.from === "string" ? parseAddress(params.from) :
    { ...parseAddress(params.from.email), name: params.from.name };
  // This app must not use the existing Zoho apex domain as a sender.
  if (!sender.email.endsWith("@international.mahquantum.tech")) {
    throw new Error("Only @international.mahquantum.tech is authorized to send");
  }
  if (!params.subject || params.subject.length > 998 || /[\r\n]/.test(params.subject)) {
    throw new Error("Email subject is required and must not contain newlines");
  }
  if (!params.html && !params.text) throw new Error("Email content is required");
  const to = recipients(params.to)!;
  const cc = recipients(params.cc);
  const bcc = recipients(params.bcc);
  if (to.length + (cc?.length||0) + (bcc?.length||0) > 30) throw new Error("Too many recipients");
  const message: Record<string,unknown> = {
    sender, to, subject: params.subject,
    ...(params.html ? { htmlContent: params.html } : {}),
    ...(params.text ? { textContent: params.text } : {}),
  };
  if (cc) message.cc=cc;
  if (bcc) message.bcc=bcc;
  if (params.replyTo) message.replyTo = typeof params.replyTo === "string" ?
    parseAddress(params.replyTo) : { ...parseAddress(params.replyTo.email), name: params.replyTo.name };
  if (params.attachments?.length) {
    if (params.attachments.length > 10) throw new Error("Attachment count exceeds free mailbox policy");
    const total = params.attachments.reduce((n,a)=>n+(a.content?.length||0),0);
    if (total > 4*1024*1024) throw new Error("Attachments exceed 3 MiB decoded limit");
    message.attachment = params.attachments.map(a=>{
      if (!a.filename || a.filename.includes("/") || a.filename.includes("\\") || a.filename.length > 180) {
        throw new Error("Invalid attachment filename");
      }
      return { name: a.filename, content: a.content };
    });
  }
  // Brevo supports custom headers, but threading headers such as In-Reply-To
  // and References are not guaranteed to be passed through or honored.
  return message;
}
export async function sendEmail(
  env: Env,
  params: SendEmailParams,
): Promise<{ messageId: string }> {
  if (!env.BREVO_API_KEY) {
    throw new Error("Outbound email is disabled: configure a verified Brevo free account and BREVO_API_KEY Worker secret");
  }
  const message=buildBrevoMessage(params);
  const response=await fetch("https://api.brevo.com/v3/smtp/email",{
    method:"POST",
    headers:{ "api-key": env.BREVO_API_KEY,"Content-Type":"application/json","Accept":"application/json" },
    body:JSON.stringify(message),
    signal:AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    throw new Error("Brevo did not accept the message (HTTP "+response.status+")");
  }
  const result = await response.json() as { messageId?:string };
  if (!result.messageId) throw new Error("Brevo returned no message identifier");
  // Accepted by provider, not guaranteed delivered to recipient inbox.
  return { messageId:result.messageId };
}
