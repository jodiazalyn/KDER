import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiError("No file provided.", 400);
    }

    if (!file.type.startsWith("video/")) {
      return apiError("Only video files are supported.", 400);
    }

    if (file.size > 100 * 1024 * 1024) {
      return apiError("Video too large. Max 100MB.", 400);
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Not authenticated.", 401);
    }

    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    const filename = `${user.id}/videos/${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("listing-media")
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return apiError(`Upload failed: ${uploadError.message}`, 500);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("listing-media").getPublicUrl(filename);

    return apiSuccess({ url: publicUrl });
  } catch {
    return apiError("Upload failed.", 500);
  }
}
