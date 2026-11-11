/** Server-side check of an uploaded handwriting image: real PNG/WebP/JPEG, ≤ 200 KB. Pure (tested). */
export const MAX_IMAGE_BYTES = 200 * 1024;

export type ImageCheck = { ok: true; bytes: Uint8Array; mediaType: "image/png" | "image/webp" | "image/jpeg" } | { ok: false; error: "bad_image" | "too_big" };

export function checkImage(base64: unknown): ImageCheck {
  if (typeof base64 !== "string" || !base64) return { ok: false, error: "bad_image" };
  // base64 of 200 KB is ~273 KB of text: refuse anything bigger before decoding.
  if (base64.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8) return { ok: false, error: "too_big" };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return { ok: false, error: "bad_image" };
  const bin = atob(base64);
  if (bin.length > MAX_IMAGE_BYTES) return { ok: false, error: "too_big" };
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const b = (i: number) => bytes[i] ?? -1;
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return { ok: true, bytes, mediaType: "image/png" };
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50)
    return { ok: true, bytes, mediaType: "image/webp" };
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return { ok: true, bytes, mediaType: "image/jpeg" };
  return { ok: false, error: "bad_image" };
}
