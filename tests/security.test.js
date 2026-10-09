import { describe, it, expect } from 'vitest';
import {
  sanitizeIdentifier,
  generateSecureId,
  generateSecureRoomId,
  generateSecurePin,
  hashPassword,
  computeChallengeResponse,
  isValidSignalingUrl
} from '../src/utils/security';

describe('security utils', () => {
  describe('sanitizeIdentifier', () => {
    it('sanitizes valid string to uppercase alphanumeric', () => {
      expect(sanitizeIdentifier('node_alpha-123')).toBe('NODE_ALPHA-123');
      expect(sanitizeIdentifier('  bad!@#chars$  ')).toBe('BADCHARS');
    });

    it('returns fallback if result is too short or invalid', () => {
      expect(sanitizeIdentifier('', 'FALLBACK')).toBe('FALLBACK');
      expect(sanitizeIdentifier('a!', 'DEFAULT')).toBe('DEFAULT');
      expect(sanitizeIdentifier(null, 'DEFAULT')).toBe('DEFAULT');
    });
  });

  describe('generateSecureId & generateSecureRoomId', () => {
    it('generates IDs with expected prefix and length', () => {
      const id = generateSecureId('OPR');
      expect(id).toMatch(/^OPR_[A-Z0-9]+$/);

      const roomId = generateSecureRoomId('SYN');
      expect(roomId).toMatch(/^SYN-[A-Z0-9]+-[A-Z0-9]+$/);
    });
  });

  describe('generateSecurePin', () => {
    it('generates PIN of specified length', () => {
      const pin = generateSecurePin(6);
      expect(pin).toHaveLength(6);
      expect(pin).toMatch(/^[0-9A-F]{6}$/);
    });
  });

  describe('hashPassword', () => {
    it('produces SHA-256 hex digest for password and salt', async () => {
      const hash1 = await hashPassword('secret123', 'ROOM_1');
      const hash2 = await hashPassword('secret123', 'ROOM_1');
      const hashDiff = await hashPassword('secret123', 'ROOM_2');

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(hash1).not.toBe(hashDiff);
    });
  });

  describe('computeChallengeResponse', () => {
    it('computes HMAC-SHA256 digest for key and challenge nonce', async () => {
      const key = 'secret_key_123';
      const challenge = 'aabbccddeeff001122334455';
      const token1 = await computeChallengeResponse(key, challenge);
      const token2 = await computeChallengeResponse(key, challenge);
      const tokenDiff = await computeChallengeResponse(key, 'different_challenge');

      expect(token1).toHaveLength(64);
      expect(token1).toBe(token2);
      expect(token1).not.toBe(tokenDiff);
    });
  });

  describe('isValidSignalingUrl', () => {
    it('validates ws and wss urls correctly', () => {
      expect(isValidSignalingUrl('ws://localhost:3000')).toBe(true);
      expect(isValidSignalingUrl('wss://synapse.example.com')).toBe(true);
      expect(isValidSignalingUrl('http://invalid.com')).toBe(false);
      expect(isValidSignalingUrl('not-a-url')).toBe(false);
      expect(isValidSignalingUrl('')).toBe(false);
    });
  });
});
