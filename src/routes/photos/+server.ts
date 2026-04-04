import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { PhotonImage, SamplingFilter, resize } from "@cf-wasm/photon";
import { photos } from '$lib/server/db/schema'

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const THUMBNAIL_MAX_SIDE = 400;

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  const bucket = platform!.env.BUCKET;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    error(400, 'no file provided');
  }
  if (file.size > MAX_FILE_SIZE) {
    error(413, 'file too large')
  }
  if (!file.type.startsWith('image/')) {
    error(400, 'not an image')
  }

  const id = crypto.randomUUID();
  const bytes = new Uint8Array(await file.arrayBuffer());

  // save original file to bucket
  const originalKey = `originals/${id}`;
  await bucket.put(originalKey, bytes, { httpMetadata: { contentType: file.type } })

  // generate thumbnail
  const inputImsage = PhotonImage.new_from_byteslice(bytes);
  const w = inputImsage.get_width();
  const h = inputImsage.get_height();

  // scale to thumbnail fixed size
  const scale = Math.min(THUMBNAIL_MAX_SIDE / Math.max(w, h), 1);
  const newW = Math.round(w * scale);
  const newH = Math.round(h * scale);

  // Lanczos3 is slower than Nearest but better in quality
  const thumbImage = resize(inputImsage, newW, newH, SamplingFilter.Lanczos3);
  const thumbBytes = thumbImage.get_bytes_webp();
  // don't forget to free the memory it's written in Rust 
  inputImsage.free();
  thumbImage.free();

  const thumbnailKey = `thumbnails/${id}.webp`;
  await bucket.put(thumbnailKey, thumbBytes, { httpMetadata: { contentType: 'image/webp' } });

  // insert data into DB
  await locals.db.insert(photos).values({
    id,
    originalKey,
    thumbnailKey,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    description: formData.get('description') as string | null
  });

  return json({ id, filename: file.name }, { status: 201 })
}