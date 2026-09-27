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

export function isValidSignalingUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
  } catch {
    return false;
  }
}
