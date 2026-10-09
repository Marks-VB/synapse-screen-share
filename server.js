import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// Input Validation Helpers
const ID_REGEX = /^[A-Za-z0-9_-]{3,64}$/;
export function isValidId(id) {
  return typeof id === 'string' && ID_REGEX.test(id);
}

export function isValidSdp(sdp) {
  if (!sdp || typeof sdp !== 'object') return false;
  if (sdp.type !== 'offer' && sdp.type !== 'answer') return false;
  if (typeof sdp.sdp !== 'string' || sdp.sdp.length > 32768) return false;
  return true;
}

export function isValidCandidate(candidate) {
  if (candidate === null) return true; // End-of-candidates notification
  if (!candidate || typeof candidate !== 'object') return false;
  if (typeof candidate.candidate !== 'string' || candidate.candidate.length > 2048) return false;
  if (candidate.sdpMid !== null && candidate.sdpMid !== undefined && typeof candidate.sdpMid !== 'string') return false;
  if (candidate.sdpMLineIndex !== null && candidate.sdpMLineIndex !== undefined && typeof candidate.sdpMLineIndex !== 'number') return false;
  return true;
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

export const ALLOWED_MESSAGE_TYPES = new Set([
  'join-room',
  'auth-response',
  'offer',
  'answer',
  'ice-candidate',
  'leave-room',
  'ping'
]);

export function createSignalingServer(options = {}) {
  const app = express();
  const server = createServer(app);

  const customDist = options.distDir || path.join(__dirname, 'dist');
  const hasDist = fs.existsSync(customDist);

  // Security HTTP Headers Middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'display-capture=(self), camera=(), microphone=(self)');
    // Hardened CSP: No 'unsafe-inline' in script-src. Includes STUN, TURN, TURNS in connect-src.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; worker-src 'self' blob:; manifest-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' ws: wss: stun: turn: turns: https:; media-src 'self' blob:; img-src 'self' data: blob:;"
    );
    next();
  });

  if (hasDist) {
    app.use(express.static(customDist));
  }

  // Basic system health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ONLINE',
      system: 'SYNAPSE_SIGNALING_CORE',
      version: '1.2.0',
      timestamp: new Date().toISOString()
    });
  });

  // SPA fallback or informative message if dist is absent
  app.get('*', (req, res) => {
    if (hasDist && fs.existsSync(path.join(customDist, 'index.html'))) {
      res.sendFile(path.join(customDist, 'index.html'));
    } else {
      res.status(503).type('html').send(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <title>Synapse - Build Required</title>
            <style>
              body { background: #050508; color: #00f0ff; font-family: monospace; padding: 2rem; }
              .card { border: 1px solid #00f0ff; padding: 1.5rem; max-width: 600px; margin: 2rem auto; border-radius: 8px; }
              code { background: #111; color: #a3e635; padding: 2px 6px; border-radius: 4px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>[SYNAPSE_SIGNALING_CORE] BUILD_REQUIRED</h2>
              <p>O diretório de produção <code>dist/</code> não foi encontrado.</p>
              <p>Para executar o frontend compilado, execute: <code>npm run build</code></p>
              <p>Para desenvolvimento interativo com HMR, execute: <code>npm run dev</code></p>
            </div>
          </body>
        </html>
      `);
    }
  });

  const MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB
  const MAX_PEERS_PER_ROOM = options.maxPeers || 8;
  const MAX_ACTIVE_ROOMS = options.maxRooms || 500;

  // Rate Limiting & Concurrency Controls
  const MAX_CONCURRENT_CONNECTIONS_PER_IP = options.maxConnectionsPerIp || 10;
  const RATE_LIMIT_WINDOW_MS = 5000;
  const RATE_LIMIT_SOCKET_MAX_MESSAGES = 60;
  const RATE_LIMIT_IP_MAX_MESSAGES = 120;

  const wss = new WebSocketServer({
    server,
    maxPayload: MAX_PAYLOAD_BYTES
  });

  const rooms = new Map();
  const ipConnections = new Map(); // Map<ip, number>
  const ipRateLimits = new Map(); // Map<ip, { count: number, resetAt: number }>

  function log(msg, level = 'INFO') {
    if (options.silent) return;
    const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
    console.log(`\x1b[36m[${ts}]\x1b[0m \x1b[35m[${level}]\x1b[0m ${msg}`);
  }

  function safeSend(ws, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
      } catch (err) {
        console.error('[WS SEND ERROR]:', err);
      }
    }
  }

  function removeClientFromRoom(ws) {
    const { roomId, peerId } = ws;
    if (!roomId || !peerId) return;

    const room = rooms.get(roomId);
    if (room && room.clients) {
      room.clients.delete(peerId);
      log(`Peer \x1b[33m${peerId}\x1b[0m disconnected from room \x1b[32m${roomId}\x1b[0m`, 'CORE');

      for (const [, client] of room.clients.entries()) {
        safeSend(client.ws, {
          type: 'peer-disconnected',
          peerId
        });
      }

      if (room.clients.size === 0) {
        rooms.delete(roomId);
        log(`Room \x1b[32m${roomId}\x1b[0m purged (0 peers remaining)`, 'PURGE');
      }
    }

    ws.roomId = null;
    ws.peerId = null;
  }

  function completeJoin(ws, room, roomId, peerId) {
    // Leave current room if already in one
    if (ws.roomId) {
      removeClientFromRoom(ws);
    }

    ws.roomId = roomId;
    ws.peerId = peerId;

    const existingPeers = Array.from(room.clients.keys());
    room.clients.set(peerId, { ws, peerId, joinedAt: Date.now() });

    log(`Peer \x1b[33m${peerId}\x1b[0m joined room \x1b[32m${roomId}\x1b[0m (Total: ${room.clients.size})`, 'ROOM');

    safeSend(ws, {
      type: 'room-joined',
      roomId,
      peerId,
      isProtected: !!room.passwordHash,
      peers: existingPeers
    });

    for (const otherPeerId of existingPeers) {
      const peerClient = room.clients.get(otherPeerId);
      if (peerClient) {
        safeSend(peerClient.ws, {
          type: 'peer-joined',
          peerId
        });
      }
    }
  }

  wss.on('connection', (ws, req) => {
    const clientIp = getClientIp(req);

    // 1. IP Concurrent Connection Limit Protection
    const currentIpConns = ipConnections.get(clientIp) || 0;
    if (currentIpConns >= MAX_CONCURRENT_CONNECTIONS_PER_IP) {
      log(`Rejected connection from ${clientIp}: max concurrent connections exceeded (${currentIpConns})`, 'SECURITY');
      ws.close(1008, 'Max concurrent connections per IP exceeded');
      return;
    }
    ipConnections.set(clientIp, currentIpConns + 1);

    ws.isAlive = true;
    ws.clientIp = clientIp;
    ws.messageCount = 0;
    ws.lastRateReset = Date.now();
    ws.pendingChallenge = null;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    log(`New WebRTC signaling connection from ${clientIp} (active from IP: ${currentIpConns + 1})`, 'CONNECT');

    ws.on('message', (messageRaw) => {
      try {
        const now = Date.now();

        // 2. Socket-level Rate Limiting
        if (now - ws.lastRateReset > RATE_LIMIT_WINDOW_MS) {
          ws.messageCount = 1;
          ws.lastRateReset = now;
        } else {
          ws.messageCount++;
          if (ws.messageCount > RATE_LIMIT_SOCKET_MAX_MESSAGES) {
            log(`Rate limit exceeded for socket (${ws.peerId || 'anonymous'})`, 'SECURITY');
            safeSend(ws, { type: 'error', message: 'Signaling rate limit exceeded. Please slow down.' });
            return;
          }
        }

        // 3. IP-level Aggregate Rate Limiting
        let ipLimit = ipRateLimits.get(clientIp);
        if (!ipLimit || now > ipLimit.resetAt) {
          ipLimit = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
          ipRateLimits.set(clientIp, ipLimit);
        } else {
          ipLimit.count++;
          if (ipLimit.count > RATE_LIMIT_IP_MAX_MESSAGES) {
            log(`Rate limit exceeded for IP address ${clientIp}`, 'SECURITY');
            safeSend(ws, { type: 'error', message: 'Rate limit exceeded for your IP address.' });
            return;
          }
        }

        // 4. Safe Payload Parsing
        let message;
        try {
          message = JSON.parse(messageRaw);
        } catch {
          safeSend(ws, { type: 'error', message: 'Malformed JSON payload' });
          return;
        }

        if (!message || typeof message !== 'object') {
          safeSend(ws, { type: 'error', message: 'Invalid payload format' });
          return;
        }

        const { type, roomId, peerId, target, sdp, candidate, passwordHash, token } = message;

        if (!ALLOWED_MESSAGE_TYPES.has(type)) {
          log(`Rejected unauthorized message type: ${type}`, 'SECURITY');
          safeSend(ws, { type: 'error', message: 'Unauthorized message type' });
          return;
        }

        switch (type) {
          case 'join-room': {
            if (!isValidId(roomId) || !isValidId(peerId)) {
              safeSend(ws, {
                type: 'error',
                message: 'Invalid roomId or peerId format (3-64 alphanumeric characters, underscores or hyphens required)'
              });
              return;
            }

            if (!rooms.has(roomId) && rooms.size >= MAX_ACTIVE_ROOMS) {
              log(`Active room capacity reached (${MAX_ACTIVE_ROOMS})`, 'WARN');
              safeSend(ws, { type: 'error', message: 'Server room capacity reached. Try again later.' });
              return;
            }

            if (!rooms.has(roomId)) {
              rooms.set(roomId, {
                clients: new Map(),
                passwordHash: typeof passwordHash === 'string' && passwordHash.trim() ? passwordHash.trim() : null
              });
            }

            const room = rooms.get(roomId);

            if (room.clients.size >= MAX_PEERS_PER_ROOM) {
              log(`Room ${roomId} is full (${room.clients.size}/${MAX_PEERS_PER_ROOM})`, 'WARN');
              safeSend(ws, {
                type: 'error',
                message: `Room capacity exceeded (maximum ${MAX_PEERS_PER_ROOM} peers)`
              });
              return;
            }

            // Room Password Verification & HMAC Challenge Protocol
            if (room.passwordHash) {
              // Check if client provided a challenge response token
              if (token && ws.pendingChallenge) {
                const expectedToken = crypto
                  .createHmac('sha256', room.passwordHash)
                  .update(ws.pendingChallenge)
                  .digest('hex');

                if (token === expectedToken) {
                  ws.pendingChallenge = null;
                  completeJoin(ws, room, roomId, peerId);
                  return;
                }
              }

              // Direct hash match (initial room setup or direct fallback)
              if (passwordHash && passwordHash === room.passwordHash) {
                completeJoin(ws, room, roomId, peerId);
                return;
              }

              // Send cryptographically secure challenge nonce
              const challenge = crypto.randomBytes(16).toString('hex');
              ws.pendingChallenge = challenge;
              ws.targetRoomId = roomId;
              ws.targetPeerId = peerId;

              log(`Issued HMAC authentication challenge to peer ${peerId} for room ${roomId}`, 'SECURITY');
              safeSend(ws, {
                type: 'auth-required',
                roomId,
                challenge,
                message: 'Este nó requer autenticação por desafio HMAC.'
              });
              return;
            }

            // Unprotected room or first peer setting room password
            if (passwordHash && room.clients.size === 0) {
              room.passwordHash = passwordHash;
            }

            completeJoin(ws, room, roomId, peerId);
            break;
          }

          case 'auth-response': {
            const targetRoom = ws.targetRoomId || roomId;
            const targetPeer = ws.targetPeerId || peerId;

            if (!isValidId(targetRoom) || !isValidId(targetPeer) || typeof token !== 'string') {
              safeSend(ws, { type: 'error', message: 'Invalid auth-response parameters' });
              return;
            }

            const room = rooms.get(targetRoom);
            if (!room || !room.passwordHash) {
              safeSend(ws, { type: 'error', message: 'Room not found or not password protected' });
              return;
            }

            if (!ws.pendingChallenge) {
              safeSend(ws, { type: 'error', message: 'No active challenge found' });
              return;
            }

            const expectedToken = crypto
              .createHmac('sha256', room.passwordHash)
              .update(ws.pendingChallenge)
              .digest('hex');

            if (token === expectedToken) {
              ws.pendingChallenge = null;
              completeJoin(ws, room, targetRoom, targetPeer);
            } else {
              log(`Peer ${targetPeer} failed challenge response authentication for room ${targetRoom}`, 'SECURITY');
              safeSend(ws, {
                type: 'auth-error',
                roomId: targetRoom,
                message: 'Senha de acesso incorreta.'
              });
            }
            break;
          }

          case 'offer': {
            if (!ws.roomId || !isValidId(target) || !isValidSdp(sdp)) {
              safeSend(ws, { type: 'error', message: 'Invalid SDP offer format or target' });
              return;
            }

            const room = rooms.get(ws.roomId);
            if (!room || !room.clients) return;

            const targetClient = room.clients.get(target);
            if (targetClient) {
              log(`Relaying SDP offer: \x1b[33m${ws.peerId}\x1b[0m -> \x1b[33m${target}\x1b[0m`, 'SIGNAL');
              safeSend(targetClient.ws, {
                type: 'offer',
                from: ws.peerId,
                sdp
              });
            }
            break;
          }

          case 'answer': {
            if (!ws.roomId || !isValidId(target) || !isValidSdp(sdp)) {
              safeSend(ws, { type: 'error', message: 'Invalid SDP answer format or target' });
              return;
            }

            const room = rooms.get(ws.roomId);
            if (!room || !room.clients) return;

            const targetClient = room.clients.get(target);
            if (targetClient) {
              log(`Relaying SDP answer: \x1b[33m${ws.peerId}\x1b[0m -> \x1b[33m${target}\x1b[0m`, 'SIGNAL');
              safeSend(targetClient.ws, {
                type: 'answer',
                from: ws.peerId,
                sdp
              });
            }
            break;
          }

          case 'ice-candidate': {
            if (!ws.roomId || !isValidId(target) || !isValidCandidate(candidate)) {
              return;
            }

            const room = rooms.get(ws.roomId);
            if (!room || !room.clients) return;

            const targetClient = room.clients.get(target);
            if (targetClient) {
              safeSend(targetClient.ws, {
                type: 'ice-candidate',
                from: ws.peerId,
                candidate
              });
            }
            break;
          }

          case 'leave-room': {
            removeClientFromRoom(ws);
            break;
          }

          case 'ping': {
            safeSend(ws, { type: 'pong', timestamp: Date.now() });
            break;
          }

          default:
            log(`Unhandled message type: ${type}`, 'WARN');
        }
      } catch (err) {
        console.error('[MESSAGE PROCESSING ERROR]:', err);
      }
    });

    const cleanupSocket = () => {
      const conns = ipConnections.get(clientIp);
      if (conns && conns > 1) {
        ipConnections.set(clientIp, conns - 1);
      } else {
        ipConnections.delete(clientIp);
      }
      removeClientFromRoom(ws);
    };

    ws.on('close', cleanupSocket);
    ws.on('error', (err) => {
      console.error(`[WS CLIENT ERROR] ${ws.peerId || 'Unknown'}:`, err);
      cleanupSocket();
    });
  });

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        log(`Terminating stale connection: ${ws.peerId || 'anonymous'}`, 'HEARTBEAT');
        removeClientFromRoom(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  // Periodic pruning of stale IP rate counters every 60 seconds
  const ipPruningInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipRateLimits.entries()) {
      if (now > data.resetAt + 60000) {
        ipRateLimits.delete(ip);
      }
    }
  }, 60000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
    clearInterval(ipPruningInterval);
  });

  return { server, app, wss, rooms, ipConnections };
}

// Direct execution entry point
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server } = createSignalingServer();
  server.listen(PORT, () => {
    console.log(`
\x1b[36m═══════════════════════════════════════════════════════════\x1b[0m
  \x1b[1m\x1b[35mSYNAPSE SCREEN SHARE\x1b[0m - Real-Time WebRTC Media Core
  \x1b[32m✔ Server listening on:\x1b[0m \x1b[4mhttp://localhost:${PORT}\x1b[0m
  \x1b[32m✔ WebSocket Signaling:\x1b[0m \x1b[4mws://localhost:${PORT}\x1b[0m
  \x1b[36mSTATUS: OPERATIONAL [CYBERNETIC_MESH_ONLINE]\x1b[0m
\x1b[36m═══════════════════════════════════════════════════════════\x1b[0m
    `);
  });
}
