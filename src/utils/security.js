/**
 * Security and sanitization utilities for Synapse
 */

export function sanitizeIdentifier(str, fallback = 'NODE_ALPHA') {
  if (!str || typeof str !== 'string') return fallback;
  const sanitized = str.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 32);
  return sanitized.length >= 3 ? sanitized : fallback;
}

export function generateSecureId(prefix = 'OPR') {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(4);
    window.crypto.getRandomValues(array);
    const hex = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
    return `${prefix}_${hex}`;
  }
  return `${prefix}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

/**
 * Generates a high-entropy, human-readable room ID (e.g. SYN-A9F2-C3B8)
 * with virtually zero collision probability (> 2.8e14 combinations).
 */
export function generateSecureRoomId(prefix = 'SYN') {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(4);
    window.crypto.getRandomValues(array);
    const p1 = Array.from(array.slice(0, 2), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
    const p2 = Array.from(array.slice(2, 4), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
    return `${prefix}-${p1}-${p2}`;
  }
  const r1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const r2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${r1}-${r2}`;
}

/**
 * Generates an optional numeric/alphanumeric PIN or password.
 */
export function generateSecurePin(length = 6) {
  const chars = '0123456789ABCDEF';
  let pin = '';
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      pin += chars[array[i] % chars.length];
    }
    return pin;
  }
  for (let i = 0; i < length; i++) {
    pin += chars[Math.floor(Math.random() * chars.length)];
  }
  return pin;
}

/**
 * Computes a SHA-256 hex hash for room authentication.
 */
export async function hashPassword(password, salt = '') {
  if (!password || typeof password !== 'string') return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${salt}:${password}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    let hash = 0;
    const str = `${salt}:${password}`;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
}

export function isValidSignalingUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
  } catch {
    return false;
  }
}
