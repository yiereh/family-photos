export function getOriginalKey(id: string): string {
  return `original/${id}`
}

export function getThumbnailKey(id: string, ext: string = 'webp'): string {
  return `thumbnails/${id}.${ext}`
}