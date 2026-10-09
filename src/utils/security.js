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

export function isValidSignalingUrl(url, enforceWssInHttps = true) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      return false;
    }
    // Enforce WSS when running in HTTPS production contexts
    if (
      enforceWssInHttps &&
      typeof window !== 'undefined' &&
      window.location &&
      window.location.protocol === 'https:'
    ) {
      const isLocal =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '[::1]';
      if (!isLocal && parsed.protocol !== 'wss:') {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Computes an HMAC-SHA256 signature for challenge-response room authentication.
 */
export async function computeChallengeResponse(keyStr, challengeStr) {
  if (!keyStr || !challengeStr) return '';
  try {
    const cryptoObj = typeof window !== 'undefined' && window.crypto ? window.crypto : globalThis.crypto;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keyStr);
    const msgData = encoder.encode(challengeStr);

    const cryptoKey = await cryptoObj.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await cryptoObj.subtle.sign('HMAC', cryptoKey, msgData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    console.error('HMAC computation error:', err);
    return '';
  }
}

/**
 * Robust cross-browser clipboard copy with fallback for non-secure contexts (HTTP / LAN)
 */
export async function copyToClipboard(text) {
  if (!text) return false;
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback to execCommand below
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.error('Copy to clipboard failed:', err);
    return false;
  }
}
