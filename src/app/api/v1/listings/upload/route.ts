import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

/**
 * POST /api/v1/listings/upload — upload a listing photo to Supabase Storage.
 *
 * Mirrors /api/v1/messages/upload pattern. Expects multipart/form-data with
 * a "file" field. Returns { url: publicUrl }.
 *
 * Requires a `listing-media` Storage bucket in Supabase with public read + authenticated write.
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

    // Plate photos can be higher quality than chat photos; 8MB ceiling.
    if (file.size > 8 * 1024 * 1024) {
      return apiError("File too large. Max 8MB.", 400);
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
    const filename = `${user.id}/${Date.now()}.${ext}`;
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
