import "server-only";

/**
 * Sends email through Microsoft Graph (`/users/{sender}/sendMail`) as the
 * mailbox in REMINDER_SENDER_MAILBOX.
 *
 * Authenticates with the client-credentials flow using the same Entra app
 * registration that handles sign-in, so it needs the *application* permission
 * Mail.Send with admin consent. That permission can send as any mailbox in the
 * tenant unless an Exchange Online application access policy scopes it down to
 * the sender — see setup-reminders.ps1.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

let cachedToken: { value: string; expiresAt: number } | null = null;

/** The tenant id is the GUID in the issuer, e.g. https://login.microsoftonline.com/<tenant>/v2.0 */
function tenantId(): string {
  const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ?? "";
  const match = issuer.match(/login\.microsoftonline\.com\/([^/]+)/);
  if (!match) {
    throw new Error("Cannot derive tenant id from AUTH_MICROSOFT_ENTRA_ID_ISSUER.");
  }
  return match[1];
}

async function getToken(): Promise<string> {
  // Refresh a minute early so a token never expires mid-run.
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.value;

  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing AUTH_MICROSOFT_ENTRA_ID_ID / AUTH_MICROSOFT_ENTRA_ID_SECRET.");
  }

  const res = await fetch(`https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) {
    throw new Error(`Graph token request failed (${res.status}): ${await res.text()}`);
  }

  const body = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

export function senderMailbox(): string {
  const sender = process.env.REMINDER_SENDER_MAILBOX;
  if (!sender) throw new Error("Missing REMINDER_SENDER_MAILBOX.");
  return sender;
}

/** Sends one HTML email. Throws on failure so the caller can skip recording it as sent. */
export async function sendMail(msg: { to: string; subject: string; html: string }): Promise<void> {
  const token = await getToken();
  const res = await fetch(`${GRAPH}/users/${encodeURIComponent(senderMailbox())}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: msg.subject,
        body: { contentType: "HTML", content: msg.html },
        toRecipients: [{ emailAddress: { address: msg.to } }],
      },
      // Keep reminders out of the shared mailbox's Sent Items.
      saveToSentItems: false,
    }),
  });
  // Graph answers 202 Accepted with an empty body on success.
  if (!res.ok) {
    throw new Error(`Graph sendMail failed (${res.status}): ${await res.text()}`);
  }
}
