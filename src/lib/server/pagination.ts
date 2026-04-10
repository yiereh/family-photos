import { z } from "zod";

export function parseLimit(param: string | null): number | null {
  if (!param) return null;

  const limit = parseInt(param);
  if (!limit) {
    return null;
  }

  return limit;
}

const CursorSchema = z.object({
  ts: z.number(),
  id: z.uuidv4(),
})

export type CursorType = z.infer<typeof CursorSchema>;

export function encodeCursor(cursor: CursorType | null): string | null {
  if (!cursor) return null;

  return btoa(JSON.stringify(cursor));
}


// payload should be a JSON string with base64 encoding
export function decodeCursor(payload: string | null): CursorType | null {
  if (!payload) return null;

  try {
    const raw = atob(payload);
    const result = CursorSchema.safeParse(JSON.parse(raw));
    if (!result.success) {
      console.log(`failed to parse cursor: ${z.prettifyError(result.error)}`);
      return null;
    }
    return result.data;
  } catch (err) {
    return null;
  }

}

export function createCursor(ts: Date, id: string): CursorType {
  return { ts: ts.getTime(), id } satisfies CursorType
}