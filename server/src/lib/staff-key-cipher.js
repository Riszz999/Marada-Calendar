const encoder = new TextEncoder();
const aad = encoder.encode('marada/staff-key/v1');
async function keyFrom(secret) {
  if (!/^[a-f0-9]{64}$/i.test(secret || '')) throw new Error('Staff key encryption is not configured');
  const bytes = Uint8Array.from(secret.match(/../g), part => Number.parseInt(part, 16));
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const pack = bytes => btoa(String.fromCharCode(...bytes));
const unpack = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
export async function encryptStaffKey(value, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, await keyFrom(secret), encoder.encode(value));
  return `v1.${pack(iv)}.${pack(new Uint8Array(ciphertext))}`;
}
export async function decryptStaffKey(value, secret) {
  if (!value) return null;
  const [version, iv, ciphertext] = value.split('.');
  if (version !== 'v1' || !iv || !ciphertext) throw new Error('Invalid staff key ciphertext');
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unpack(iv), additionalData: aad }, await keyFrom(secret), unpack(ciphertext));
  return new TextDecoder().decode(plaintext);
}
