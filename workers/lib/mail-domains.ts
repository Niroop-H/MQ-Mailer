/** Domain boundary for MQ-Mailer-managed mailboxes.
 * No employee can create or access a root-domain Zoho mailbox through this service.
 */
import { normalizeMailboxId } from "./access-control";

export function allowedDomains(raw: string | undefined): string[] {
  return (raw || "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => /^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/.test(domain))
    .filter((domain, index, list) => list.indexOf(domain) === index);
}

export function isManagedMailbox(email: string, configuredDomains: string | undefined): boolean {
  const canonical = normalizeMailboxId(email);
  if (!canonical || canonical !== email) return false;
  const domain = canonical.slice(canonical.lastIndexOf("@") + 1);
  return allowedDomains(configuredDomains).includes(domain);
}
