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

/** Verdict → email hex (mirrors the web verdict palette, tuned for inboxes). */
const VERDICT_HEX: Record<string, string> = {
  essential: "#0e6e3c",
  worthwhile: "#0b6a72",
  niche: "#8f5e06",
  marginal: "#a4440e",
  redundant: "#a92220",
  "complexity-trap": "#96173c",
};

/** The editorial recap fields the email needs (a projection of lib/recap.Recap). */
export type RecapEmail = {
  date: string;
  dateLabel: string;
  summary: string; // "2 essential · 1 complexity trap"
  items: (DigestItem & { install?: string | null })[];
  lead: (DigestItem & { hook?: string | null }) | null;
  trap: (DigestItem & { hook?: string | null }) | null;
  topAdopted: { slug: string; title: string; uses: number }[];
};

function verdictStamp(verdict: string): string {
  const hex = VERDICT_HEX[verdict] ?? "#555";
  return `<span style="display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:${hex};border:1px solid ${hex}55;border-radius:3px;padding:1px 6px">${escapeHtml(verdict)}</span>`;
}

/**
 * The nightly recap email (ticket 0040): verdict-led, not a link dump. Subject
 * carries the counts; the body leads with the one that matters and names the
 * trap. Rendered from lib/recap via the send route.
 */
export function renderRecapEmail(
  recap: RecapEmail,
  token: string,
): { subject: string; html: string } {
  const unsub = publicUrl(`/newsletter/unsubscribe?token=${token}`);
  const webRecap = publicUrl(`/recap/${recap.date}`);

  const row = (i: DigestItem & { install?: string | null }) => {
    const link = publicUrl(`/item/${i.slug}`);
    const label = CATEGORY_LABELS[i.category as Category] ?? i.category;
    const install = i.install
      ? `<div style="font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#444;background:#f4f4f5;border-radius:5px;padding:5px 8px;margin-top:5px">${escapeHtml(i.install)}</div>`
      : "";
    return `<tr><td style="padding:14px 0;border-bottom:1px solid #ececec">
      <div style="margin-bottom:3px">${verdictStamp(i.verdict)} <span style="font-family:ui-monospace,monospace;font-size:12px;color:#999"> ${i.overallScore}/100</span></div>
      <a href="${link}" style="font-weight:700;color:#111;text-decoration:none;font-size:16px">${escapeHtml(i.title)}</a>
      <div style="color:#555;font-size:13px;margin:2px 0">${escapeHtml(i.tagline)}</div>
      <div style="font-size:12px;color:#999">${escapeHtml(label)}</div>
      ${install}
    </td></tr>`;
  };

  const leadBlock = recap.lead
    ? `<div style="border:1px solid #e3e3e3;border-radius:10px;padding:16px;margin:8px 0 20px">
        <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#888;margin-bottom:8px">The one that matters</div>
        ${verdictStamp(recap.lead.verdict)} <span style="font-family:ui-monospace,monospace;font-size:12px;color:#999">${recap.lead.overallScore}/100</span>
        <div style="font-weight:800;font-size:19px;margin:4px 0 2px"><a href="${publicUrl(`/item/${recap.lead.slug}`)}" style="color:#111;text-decoration:none">${escapeHtml(recap.lead.title)}</a></div>
        <div style="color:#555;font-size:14px">${escapeHtml(recap.lead.tagline)}</div>
        ${recap.lead.hook ? `<div style="border-left:3px solid #ddd;padding-left:10px;margin-top:8px;color:#666;font-size:13px;font-style:italic">Devil's advocate: ${escapeHtml(recap.lead.hook)}</div>` : ""}
      </div>`
    : "";

  const trapBlock = recap.trap
    ? `<div style="border:1px solid ${VERDICT_HEX["complexity-trap"]}44;border-radius:10px;padding:14px;margin:0 0 20px;background:#fdf3f6">
        <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${VERDICT_HEX["complexity-trap"]};margin-bottom:6px">Complexity trap of the night</div>
        <div style="font-weight:700;font-size:15px"><a href="${publicUrl(`/item/${recap.trap.slug}`)}" style="color:#111;text-decoration:none">${escapeHtml(recap.trap.title)}</a></div>
        <div style="color:#666;font-size:13px;margin-top:2px">${escapeHtml(recap.trap.hook ?? recap.trap.tagline)}</div>
      </div>`
    : "";

  const adoptedBlock =
    recap.topAdopted.length > 0
      ? `<div style="margin:20px 0 0">
          <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#888;margin-bottom:6px">What engineers are running</div>
          ${recap.topAdopted
            .map(
              (t) =>
                `<div style="font-size:13px;color:#444;padding:3px 0"><a href="${publicUrl(`/item/${t.slug}`)}" style="color:#111;text-decoration:none">${escapeHtml(t.title)}</a> <span style="color:#999">· ${t.uses} ${t.uses === 1 ? "engineer" : "engineers"}</span></div>`,
            )
            .join("")}
        </div>`
      : "";

  return {
    subject: `AIx · ${recap.dateLabel} — ${recap.summary}`,
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:auto;color:#111">
      <div style="border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:16px">
        <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#888">The nightly recap</div>
        <h1 style="margin:6px 0 2px;font-size:24px">${escapeHtml(recap.dateLabel)}</h1>
        <div style="color:#555;font-size:14px">${recap.items.length} tool${recap.items.length === 1 ? "" : "s"} judged — <b>${escapeHtml(recap.summary)}</b>.</div>
      </div>
      ${leadBlock}
      ${trapBlock}
      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#888;margin-bottom:2px">Every verdict tonight</div>
      <table style="width:100%;border-collapse:collapse">${recap.items.map(row).join("")}</table>
      ${adoptedBlock}
      <p style="margin-top:22px"><a href="${webRecap}" style="color:#2b4eea;font-size:14px;text-decoration:none">Read tonight's recap on the web →</a></p>
      <p style="color:#aaa;font-size:11px;margin-top:24px;border-top:1px solid #eee;padding-top:12px">
        You're subscribed to the AIx nightly recap. <a href="${unsub}" style="color:#aaa">Unsubscribe</a>.
      </p>
    </div>`,
  };
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );
}
