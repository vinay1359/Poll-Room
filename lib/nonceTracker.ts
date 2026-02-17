// Nonce tracker to prevent replay attacks
// Each page load gets a unique nonce that can only be used once

interface NonceEntry {
  used: boolean;
  expiresAt: number;
}

const nonceStore = new Map<string, NonceEntry>();

// Clean up expired nonces every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [nonce, entry] of nonceStore.entries()) {
    if (entry.expiresAt < now) {
      nonceStore.delete(nonce);
    }
  }
}, 5 * 60 * 1000);

// Nonces are valid for 5 minutes
const NONCE_EXPIRY_MS = 5 * 60 * 1000;

export function generateNonce(): string {
  // Generate cryptographically random nonce
  const buffer = new Uint8Array(32);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(buffer);
  } else {
    // Fallback for server-side (shouldn't happen, but just in case)
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function validateNonce(nonce: string): { valid: boolean; reason?: string } {
  if (!nonce || nonce.length !== 64) {
    return { valid: false, reason: "Invalid nonce format" };
  }

  const entry = nonceStore.get(nonce);
  const now = Date.now();

  if (!entry) {
    // First time seeing this nonce - register it as used
    nonceStore.set(nonce, { used: true, expiresAt: now + NONCE_EXPIRY_MS });
    return { valid: true };
  }

  // Nonce already used - replay attack detected
  if (entry.used) {
    return { valid: false, reason: "Nonce already used (replay detected)" };
  }

  // Nonce expired
  if (entry.expiresAt < now) {
    nonceStore.delete(nonce);
    return { valid: false, reason: "Nonce expired" };
  }

  return { valid: false, reason: "Unknown nonce error" };
}
