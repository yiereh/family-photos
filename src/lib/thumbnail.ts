const THUMBNAIL_MAX_SIDE = 400

export async function generateThumbnail(file: File): Promise<Blob> {
  const image = await createImageBitmap(file);
  const width = image.width;
  const height = image.height;
  const scale = Math.min(THUMBNAIL_MAX_SIDE / Math.max(width, height), 1);

  const canvas = new OffscreenCanvas(Math.round(width * scale), Math.round(height * scale));
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) throw new Error("failed to obtain 2d context");

  ctx2d.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();

  try {
    return await canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
  } catch (err) {
    return await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 });
  }
}