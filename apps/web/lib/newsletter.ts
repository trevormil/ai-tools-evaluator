import { getEnv } from "@/lib/env";
import { CATEGORY_LABELS, type Category } from "@aix/core";

/**
 * Newsletter delivery. Uses Resend's free tier when `RESEND_API_KEY` is set;
 * otherwise logs the email (dev / unconfigured). Sender is intentionally thin so
 * it can be swapped for SMTP later without touching callers.
 */

export type Email = { to: string; subject: string; html: string };

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendEmail(email: Email): Promise<{ ok: boolean; skipped?: boolean }> {
  const env = getEnv();
  const from = env.NEWSLETTER_FROM ?? "AIx <newsletter@aix.trevormil.com>";
  if (!env.RESEND_API_KEY) {
    console.log(`[newsletter] (log-only, no RESEND_API_KEY) → ${email.to}: ${email.subject}`);
    return { ok: true, skipped: true };
  }
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: email.to, subject: email.subject, html: email.html }),
  });
  if (!res.ok) {
    console.error(`[newsletter] send failed ${res.status}: ${await res.text().catch(() => "")}`);
    return { ok: false };
  }
  return { ok: true };
}

export function publicUrl(path: string): string {
  const base = getEnv().AIX_PUBLIC_URL ?? "https://aix.trevormil.com";
  return `${base.replace(/\/$/, "")}${path}`;
}

/** Digest item shape for the email (a subset of the items row). */
export type DigestItem = {
  slug: string;
  title: string;
  verdict: string;
  overallScore: number;
  tagline: string;
  category: string;
  coverImageUrl: string | null;
};

export function renderConfirmEmail(token: string): { subject: string; html: string } {
  const url = publicUrl(`/newsletter/confirm?token=${token}`);
  return {
    subject: "Confirm your AIx newsletter subscription",
    html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto">
      <h2>One click to confirm</h2>
      <p>You asked for the daily AIx digest — trending dev tools & papers, each with a harsh verdict.</p>
      <p><a href="${url}" style="display:inline-block;background:#ea580c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Confirm subscription</a></p>
      <p style="color:#888;font-size:12px">If you didn't request this, ignore this email — you won't be subscribed.</p>
    </div>`,
  };
}

export function renderDigestEmail(items: DigestItem[], token: string): { subject: string; html: string } {
  const unsub = publicUrl(`/newsletter/unsubscribe?token=${token}`);
  const rows = items
    .map((i) => {
      const link = publicUrl(`/item/${i.slug}`);
      const label = CATEGORY_LABELS[i.category as Category] ?? i.category;
      return `<tr><td style="padding:12px 0;border-bottom:1px solid #eee">
        <a href="${link}" style="font-weight:600;color:#111;text-decoration:none;font-size:16px">${i.title}</a>
        <div style="color:#666;font-size:13px;margin:2px 0">${escapeHtml(i.tagline)}</div>
        <div style="font-size:12px;color:#999">${label} · <b>${i.verdict}</b> · ${i.overallScore}/100</div>
      </td></tr>`;
    })
    .join("");
  return {
    subject: `AIx daily — ${items.length} new tool${items.length === 1 ? "" : "s"} evaluated`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto">
      <h2 style="margin-bottom:4px">AIx daily digest</h2>
      <p style="color:#888;margin-top:0;font-size:13px">The fast-moving world of dev tools, distilled and judged.</p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <p style="color:#aaa;font-size:11px;margin-top:24px">
        You're subscribed to the AIx daily digest.
        <a href="${unsub}" style="color:#aaa">Unsubscribe</a>.
      </p>
    </div>`,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
