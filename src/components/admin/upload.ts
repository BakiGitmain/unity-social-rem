"use client";

import { createClient } from "@/lib/supabase/client";
import { logUpload } from "@/lib/admin/actions/content";

const TYPES = ["image/webp", "image/png", "image/jpeg"];

/**
 * Upload an image to Supabase Storage (bucket "media", public). Storage RLS only lets admins with 2FA write.
 * Returns the public URL and the natural size.
 */
export async function uploadImage(file: File, folder: string): Promise<{ url: string; width: number; height: number }> {
  if (!TYPES.includes(file.type)) throw new Error("Use a WebP, PNG or JPEG image");
  if (file.size > 5 * 1024 * 1024) throw new Error("Max 5 MB");
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-60) || "image";
  const path = `${folder}/${Date.now()}-${safe}`;
  const supabase = createClient();
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (error) throw new Error("Upload failed");
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  await logUpload(path);
  const size = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 900, height: 600 });
    img.src = URL.createObjectURL(file);
  });
  return { url: data.publicUrl, ...size };
}
