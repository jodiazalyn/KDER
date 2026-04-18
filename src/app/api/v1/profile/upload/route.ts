import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

/**
 * POST /api/v1/profile/upload — upload a creator profile photo to Supabase Storage.
 *
 * Mirrors /api/v1/listings/upload pattern but writes to a `profile/` subfolder
 * under the existing `listing-media` bucket so no new bucket setup is needed.
 * The bucket's existing RLS policy (insert scoped to first folder = auth.uid())
 * still applies because the path starts with `${user.id}/`.
 *
 * Expects multipart/form-data with a "file" field. Returns { url: publicUrl }.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiError("No file provided.", 400);
    }

    if (!file.type.startsWith("image/")) {
      return apiError("Only image files are supported.", 400);
    }

    // Profile photos are avatars — smaller than plate photos, 5MB ceiling.
    if (file.size > 5 * 1024 * 1024) {
      return apiError("File too large. Max 5MB.", 400);
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Not authenticated.", 401);
    }

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const filename = `${user.id}/profile/${Date.now()}.${ext}`;
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
