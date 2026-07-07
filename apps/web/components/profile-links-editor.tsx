"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  PROFILE_LINK_KINDS,
  PROFILE_LINK_META,
  type ProfileLinkKind,
} from "@/lib/profile-link-kinds";
import { ProfileLinkIcon } from "@/components/profile-link-icon";

/** Owner-only editor: one URL field per service, saved as a full replace. */
export function ProfileLinksEditor({ initial }: { initial: Record<string, string> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>(() => ({ ...initial }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const links = PROFILE_LINK_KINDS.map((kind) => ({
      kind,
      url: (urls[kind] ?? "").trim(),
    })).filter((l) => l.url);
    const res = await fetch("/api/profile/links", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ links }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Saved.");
      setOpen(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error ?? "Check your URLs (must be full https:// links).");
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost text-xs">
        Edit links
      </button>
    );
  }

  return (
    <div className="card flex flex-col gap-2 p-3">
      {PROFILE_LINK_KINDS.map((kind: ProfileLinkKind) => (
        <label key={kind} className="flex items-center gap-2">
          <span className="text-neutral-500">
            <ProfileLinkIcon kind={kind} className="h-4 w-4" />
          </span>
          <input
            className="input flex-1"
            placeholder={PROFILE_LINK_META[kind].placeholder}
            value={urls[kind] ?? ""}
            onChange={(e) => setUrls((u) => ({ ...u, [kind]: e.target.value }))}
          />
        </label>
      ))}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? "Saving…" : "Save links"}
        </button>
        <button onClick={() => setOpen(false)} className="btn-ghost text-xs">
          Cancel
        </button>
        {msg && <span className="text-xs text-neutral-500">{msg}</span>}
      </div>
    </div>
  );
}
