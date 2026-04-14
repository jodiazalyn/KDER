import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiError("No file provided.", 400);
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return apiError("Only image files are supported.", 400);
    }

    // Max 5MB
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

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${user.id}/${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("message-media")
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return apiError("Upload failed.", 500);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("message-media").getPublicUrl(filename);

    return apiSuccess({ url: publicUrl });
  } catch {
    return apiError("Upload failed.", 500);
  }
}
