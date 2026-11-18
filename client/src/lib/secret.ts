/** Geheime Inhalte Base64url-kodiert in der URL (ohne Backend). */
export interface SecretPayload {
  t: 'begriffe' | 'zahl';
  titel: string;
  items?: string[];
  zahl?: number;
}

export function encodeSecret(p: SecretPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(p));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSecret(d: string): SecretPayload | null {
  try {
    const b64 = d.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
