import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { uploadImage, isStorageConfigured, MAX_UPLOAD_BYTES } from "@/lib/storage";
import { setAvatar } from "@/lib/profile";

export const dynamic = "force-dynamic";

/** Upload a new avatar (multipart form field `file`) → Spaces → users.avatarUrl. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!isStorageConfigured()) {
      return NextResponse.json({ error: "Image uploads aren't configured yet." }, { status: 503 });
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES)
      return NextResponse.json({ error: "Image too large (max 5 MB)." }, { status: 413 });

    const url = await uploadImage("avatars", await file.arrayBuffer(), file.type, user.username);
    setAvatar(user.id, url);
    return NextResponse.json({ url });
  } catch (err) {
    return errorResponse(err);
  }
}
