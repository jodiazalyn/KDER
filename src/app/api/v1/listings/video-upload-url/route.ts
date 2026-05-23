import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

/**
 * POST /api/v1/listings/video-upload-url — mint a short-lived signed URL
 * that the client uses to PUT the raw video bytes directly to Supabase
 * Storage.
 *
 * Why direct-to-storage: Netlify Functions cap request bodies at ~6MB, and
 * a 60-second mobile video is routinely 20–100MB. POSTing the file through
 * our own API route would always 413 on cellular. With signed URLs we only
 * push a tiny JSON request through the function — the bytes bypass Netlify
 * entirely.
 */
export async function POST(request: NextRequest) {
  try {
    const { ext = "mp4", contentType = "video/mp4" } = (await request
      .json()
      .catch(() => ({}))) as { ext?: string; contentType?: string };

    // Whitelist the formats iOS / Android cameras actually produce.
    const allowed = ["mp4", "mov", "webm", "m4v", "quicktime"];
    if (!allowed.includes(ext.toLowerCase())) {
      return apiError("Unsupported video format.", 400);
    }

    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiError("Not authenticated.", 401);

    const path = `${user.id}/videos/${Date.now()}.${ext.toLowerCase()}`;

    // Signed upload URLs are valid for 2 hours and authorize a single PUT
    // to this exact path. No service-role key on the client.
    const { data, error } = await supabase.storage
      .from("listing-media")
      .createSignedUploadUrl(path);

    if (error) {
      return apiError(`Could not prepare upload: ${error.message}`, 500);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("listing-media").getPublicUrl(path);

    return apiSuccess({
      uploadUrl: data.signedUrl,
      token: data.token,
      path,
      publicUrl,
      contentType,
    });
  } catch {
    return apiError("Could not prepare upload.", 500);
  }
}
