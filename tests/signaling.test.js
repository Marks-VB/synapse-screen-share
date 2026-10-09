import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import crypto from 'crypto';
import { createSignalingServer } from '../server.js';

describe('Signaling Server Protocol Integration Test', () => {
  let serverInstance;
  let port;
  let wsUrl;

  beforeAll(async () => {
    return new Promise((resolve) => {
      const { server } = createSignalingServer({ silent: true });
      serverInstance = server.listen(0, () => {
        port = serverInstance.address().port;
        wsUrl = `ws://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    return new Promise((resolve) => {
      if (serverInstance) {
        serverInstance.close(() => resolve());
      } else {
        resolve();
      }
    });
  });

  function createClient() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      ws.on('open', () => resolve(ws));
      ws.on('error', (err) => reject(err));
    });
  }

  function waitForMessage(ws, predicate, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout waiting for WS message'));
      }, timeoutMs);

      const handler = (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (predicate(parsed)) {
            clearTimeout(timer);
            ws.off('message', handler);
            resolve(parsed);
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.on('message', handler);
    });
  }

  it('completes room join and full WebRTC offer/answer/candidate relay', async () => {
    const host = await createClient();
    const viewer = await createClient();

    // 1. Host joins room
    host.send(
      JSON.stringify({
        type: 'join-room',
        roomId: 'ROOM_ALPHA',
        peerId: 'HOST_1'
      })
    );

    const hostJoined = await waitForMessage(host, (m) => m.type === 'room-joined');
    expect(hostJoined.roomId).toBe('ROOM_ALPHA');
    expect(hostJoined.peers).toHaveLength(0);

    // 2. Viewer joins room
    const hostPeerJoinedPromise = waitForMessage(host, (m) => m.type === 'peer-joined');
    viewer.send(
      JSON.stringify({
        type: 'join-room',
        roomId: 'ROOM_ALPHA',
        peerId: 'VIEWER_1'
      })
    );

    const viewerJoined = await waitForMessage(viewer, (m) => m.type === 'room-joined');
    expect(viewerJoined.roomId).toBe('ROOM_ALPHA');
    expect(viewerJoined.peers).toContain('HOST_1');

    const peerJoinedMsg = await hostPeerJoinedPromise;
    expect(peerJoinedMsg.peerId).toBe('VIEWER_1');

    // 3. Host relays SDP offer to Viewer
    const viewerOfferPromise = waitForMessage(viewer, (m) => m.type === 'offer');
    host.send(
      JSON.stringify({
        type: 'offer',
        target: 'VIEWER_1',
        sdp: { type: 'offer', sdp: 'v=0\r\no=host 1234 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' }
      })
    );

    const receivedOffer = await viewerOfferPromise;
    expect(receivedOffer.from).toBe('HOST_1');
    expect(receivedOffer.sdp.type).toBe('offer');

    // 4. Viewer relays SDP answer to Host
    const hostAnswerPromise = waitForMessage(host, (m) => m.type === 'answer');
    viewer.send(
      JSON.stringify({
        type: 'answer',
        target: 'HOST_1',
        sdp: { type: 'answer', sdp: 'v=0\r\no=viewer 5678 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' }
      })
    );

    const receivedAnswer = await hostAnswerPromise;
    expect(receivedAnswer.from).toBe('VIEWER_1');
    expect(receivedAnswer.sdp.type).toBe('answer');

    // 5. ICE candidate relay
    const viewerCandidatePromise = waitForMessage(viewer, (m) => m.type === 'ice-candidate');
    host.send(
      JSON.stringify({
        type: 'ice-candidate',
        target: 'VIEWER_1',
        candidate: { candidate: 'candidate:1 1 UDP 2122260223 127.0.0.1 5000 typ host', sdpMid: '0', sdpMLineIndex: 0 }
      })
    );

    const receivedCandidate = await viewerCandidatePromise;
    expect(receivedCandidate.from).toBe('HOST_1');
    expect(receivedCandidate.candidate.candidate).toContain('127.0.0.1');

    // 6. Disconnection notification
    const hostDisconnectedPromise = waitForMessage(host, (m) => m.type === 'peer-disconnected');
    viewer.close();

    const disconnectedMsg = await hostDisconnectedPromise;
    expect(disconnectedMsg.peerId).toBe('VIEWER_1');

    host.close();
  });

  it('enforces HMAC challenge-response for password-protected rooms', async () => {
    const host = await createClient();
    const guest = await createClient();

    const roomPasswordHash = crypto.createHash('sha256').update('ROOM_SECURE:pass123').digest('hex');

    // Host creates protected room
    host.send(
      JSON.stringify({
        type: 'join-room',
        roomId: 'ROOM_SECURE',
        peerId: 'HOST_SECURE',
        passwordHash: roomPasswordHash
      })
    );

    const hostJoined = await waitForMessage(host, (m) => m.type === 'room-joined');
    expect(hostJoined.isProtected).toBe(true);

    // Guest attempts to join without credentials
    guest.send(
      JSON.stringify({
        type: 'join-room',
        roomId: 'ROOM_SECURE',
        peerId: 'GUEST_SECURE'
      })
    );

    // Server challenges guest with random nonce
    const challengeMsg = await waitForMessage(guest, (m) => m.type === 'auth-required');
    expect(challengeMsg.challenge).toBeDefined();
    expect(typeof challengeMsg.challenge).toBe('string');

    // Guest signs challenge with HMAC-SHA256
    const expectedToken = crypto
      .createHmac('sha256', roomPasswordHash)
      .update(challengeMsg.challenge)
      .digest('hex');

    guest.send(
      JSON.stringify({
        type: 'auth-response',
        roomId: 'ROOM_SECURE',
        peerId: 'GUEST_SECURE',
        token: expectedToken
      })
    );

    // Guest successfully enters room
    const guestJoined = await waitForMessage(guest, (m) => m.type === 'room-joined');
    expect(guestJoined.roomId).toBe('ROOM_SECURE');
    expect(guestJoined.peers).toContain('HOST_SECURE');

    host.close();
    guest.close();
  });
});
