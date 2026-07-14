/**
 * Sends transactional email via Resend if RESEND_API_KEY is configured;
 * otherwise logs and no-ops so alerts still work end-to-end in dev
 * without an email provider set up.
 */
export async function sendEmail(to: string, subject: string, body: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email:dev-noop] to=${to} subject="${subject}"`);
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.ALERTS_FROM_EMAIL ?? "alerts@iqf-app.local",
      to,
      subject,
      text: body,
    }),
  });
}
