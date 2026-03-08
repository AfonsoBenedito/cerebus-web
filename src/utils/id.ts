/**
 * Generate a short, unique ID (~12 chars, base36).
 * 8 random bytes = 64 bits of entropy — collision-resistant for local-first apps.
 */
export function generateId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return n.toString(36);
}
