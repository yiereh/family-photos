export function getOriginalKey(id: string): string {
  return `original/${id}`
}

export function getThumbnailKey(id: string, contentType: string = "image/webp"): string {
  const ext = contentType === "image/webp" ? "webp" : "jpg";
  return `thumbnails/${id}.${ext}`
}