// Generatore di ID universalmente compatibile.
// crypto.randomUUID() richiede secure context (HTTPS o localhost). In HTTP su IP
// di rete (es. tablet che apre http://192.168.x.x:3001/) non è disponibile,
// quindi forniamo un fallback basato su crypto.getRandomValues + timestamp.

export function newId(): string {
  try {
    const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
    if (c && typeof c.randomUUID === 'function') {
      return c.randomUUID();
    }
    if (c && typeof c.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      c.getRandomValues(bytes);
      // RFC4122 v4
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
  } catch { /* fall through */ }
  // Ultimo fallback: timestamp + random (unicità sufficiente per uso locale)
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}
