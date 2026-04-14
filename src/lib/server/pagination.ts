import { z } from "zod";

export const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100
const LimitSchema = z.coerce.number().int().positive().max(MAX_LIMIT);

export function parseLimit(param: string | null): number | null {
  if (!param) return null;

  const result = LimitSchema.safeParse(param);
  if (!result.success) {
    return null;
  }

  return result.data;
}

const CursorSchema = z.object({
  ts: z.number(),
  id: z.uuidv4(),
})

export type CursorType = z.infer<typeof CursorSchema>;

const strToBufSource = (str: string) => new TextEncoder().encode(str)
const extractKey = (keyStr: string) => {
  return crypto.subtle.importKey(
    'raw',
    strToBufSource(keyStr),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ['sign', 'verify'],
  )
}

export async function encodeCursor(cursor: CursorType | null, keyStr: string): Promise<string | null> {
  if (!(cursor && keyStr)) return null;

  const key = await extractKey(keyStr);
  const payloadB64 = btoa(JSON.stringify(cursor));
  const sig = await crypto.subtle.sign('HMAC', key, strToBufSource(payloadB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return payloadB64 + '.' + sigB64;
}


// plStr is a JSON string with base64 encoding
export async function decodeCursor(plStr: string | null, keyStr?: string): Promise<CursorType | null> {
  if (!(plStr && keyStr)) return null;

  const dot = plStr.lastIndexOf('.');
  if (dot <= 0 || dot === plStr.length - 1) return null;

  const payloadB64 = plStr.substring(0, dot); // still base64 encoded
  const sigB64 = plStr.substring(dot + 1); // still base64 encoded

  try {
    const key = await extractKey(keyStr);
    const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
    const res = await crypto.subtle.verify('HMAC', key, sigBytes, strToBufSource(payloadB64))
    if (!res) return null;

    const raw = atob(payloadB64);
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
