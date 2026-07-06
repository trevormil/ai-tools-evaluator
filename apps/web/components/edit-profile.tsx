"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** Owner-only inline profile editor: avatar upload + display name + bio. */
export function EditProfile({ displayName, bio }: { displayName: string; bio: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(displayName);
  const [bioText, setBioText] = useState(bio);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadAvatar(file: File) {
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
    setBusy(false);
    if (res.ok) {
      setMsg("Avatar updated.");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error ?? "Upload failed.");
    }
  }

  async function saveText() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: name, bio: bioText }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg("Saved.");
      setOpen(false);
      router.refresh();
    } else {
      setMsg("Save failed.");
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost text-xs">
        Edit profile
      </button>
    );
  }

  return (
    <div className="card flex w-full flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <button className="btn-ghost text-xs" onClick={() => fileRef.current?.click()} disabled={busy}>
          Upload avatar
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadAvatar(f);
          }}
        />
        <span className="text-xs text-neutral-500">PNG/JPG/WebP/GIF, max 5 MB</span>
      </div>
      <input className="input" placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      <textarea className="input" rows={2} placeholder="Bio" value={bioText} onChange={(e) => setBioText(e.target.value)} maxLength={500} />
      <div className="flex items-center gap-3">
        <button onClick={saveText} disabled={busy} className="btn-primary">
          {busy ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setOpen(false)} className="btn-ghost text-xs">
          Close
        </button>
        {msg && <span className="text-xs text-neutral-500">{msg}</span>}
      </div>
    </div>
  );
}
