import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";

/** Email runs now (spec §8). Resend; falls back to a console log when unset. */
export async function sendEmail(input: { to: string | string[]; subject: string; html: string; text?: string; replyTo?: string }) {
  const key = env.resendApiKey();
  if (!key) {
    console.log(`[email:dry-run] to=${Array.isArray(input.to) ? input.to.join(",") : input.to} subject="${input.subject}"`);
    return { ok: false, dryRun: true as const };
  }
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: env.emailFrom(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return { ok: true as const, id: data?.id };
}

export function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0d0c0a;color:#efe6d2;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="border-bottom:2px solid #d4a94f;padding-bottom:10px;margin-bottom:16px">
<strong style="color:#d4a94f;letter-spacing:.12em;text-transform:uppercase">Midnight Fusion</strong></div>
<h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
${body}
<p style="color:#7d725c;font-size:12px;margin-top:28px">Midnight Fusion LLC · Reply to this email and a human answers.</p>
</div></body></html>`;
}
