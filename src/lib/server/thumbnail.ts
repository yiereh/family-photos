import { PhotonImage, SamplingFilter, resize } from "@cf-wasm/photon";

const THUMBNAIL_MAX_SIDE = 400;

export function generateThumbnail(bytes: Uint8Array): Uint8Array {
  const input = PhotonImage.new_from_byteslice(bytes);
  const w = input.get_width();
  const h = input.get_height();

  const scale = Math.min(THUMBNAIL_MAX_SIDE / Math.max(w, h), 1);
  const thumb = resize(input, Math.round(w * scale), Math.round(h * scale), SamplingFilter.Lanczos3);
  const thumbBytes = thumb.get_bytes_webp();
  input.free();
  thumb.free();

  return thumbBytes;
}

export async function writeThumbnail(bucket: R2Bucket, key: string, bytes: Uint8Array<ArrayBufferLike>, ext: string = 'webp'): Promise<void> {
  await bucket.put(key, bytes, { httpMetadata: { contentType: `image/${ext}` } });
}