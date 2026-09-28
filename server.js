import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const app = express();
const server = createServer(app);

import fs from 'fs';

// Serve static assets from dist (production build) or public folder
const staticDir = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, 'public');

// Security HTTP Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'display-capture=(self), camera=(), microphone=(self)');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; worker-src 'self' blob:; manifest-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' ws: wss: stun:; media-src 'self' blob:; img-src 'self' data: blob:;"
  );
  next();
});

app.use(express.static(staticDir));

// Basic system health check - sanitized output
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'SYNAPSE_SIGNALING_CORE',
    version: '1.1.0',
    timestamp: new Date().toISOString()
  });
});

// Fallback to index.html for SPA room routes
app.get('*', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

// WebSocket Signaling Server with 64KB max payload protection against memory exhaustion
const MAX_PAYLOAD_BYTES = 64 * 1024; // 64 KB
const MAX_PEERS_PER_ROOM = 8;
const MAX_ACTIVE_ROOMS = 500;
const RATE_LIMIT_WINDOW_MS = 5000;
const RATE_LIMIT_MAX_MESSAGES = 60;

const wss = new WebSocketServer({
  server,
  maxPayload: MAX_PAYLOAD_BYTES
});

// Map<roomId, { clients: Map<peerId, { ws: WebSocket, peerId: string, joinedAt: number }>, passwordHash: string | null }>
const rooms = new Map();

// Input Validation Helpers
const ID_REGEX = /^[A-Za-z0-9_-]{3,64}$/;
function isValidId(id) {
  return typeof id === 'string' && ID_REGEX.test(id);
}

function isValidSdp(sdp) {
  if (!sdp || typeof sdp !== 'object') return false;
  if (sdp.type !== 'offer' && sdp.type !== 'answer') return false;
  if (typeof sdp.sdp !== 'string' || sdp.sdp.length > 32768) return false;
  return true;
}

function isValidCandidate(candidate) {
  if (candidate === null) return true; // End-of-candidates notification
  if (!candidate || typeof candidate !== 'object') return false;
  if (typeof candidate.candidate !== 'string' || candidate.candidate.length > 2048) return false;
  if (candidate.sdpMid !== null && candidate.sdpMid !== undefined && typeof candidate.sdpMid !== 'string') return false;
  if (candidate.sdpMLineIndex !== null && candidate.sdpMLineIndex !== undefined && typeof candidate.sdpMLineIndex !== 'number') return false;
  return true;
}

function log(msg, level = 'INFO') {
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

    // Notify remaining peers
    for (const [otherPeerId, client] of room.clients.entries()) {
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

const ALLOWED_MESSAGE_TYPES = new Set([
  'join-room',
  'offer',
  'answer',
  'ice-candidate',
  'leave-room',
  'ping'
]);

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.messageCount = 0;
  ws.lastRateReset = Date.now();

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  const remoteIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  log(`New WebRTC signaling connection from ${remoteIp}`, 'CONNECT');

  ws.on('message', (messageRaw) => {
    try {
      // 1. Rate Limiting Protection (Anti-DoS / Anti-Flooding)
      const now = Date.now();
      if (now - ws.lastRateReset > RATE_LIMIT_WINDOW_MS) {
        ws.messageCount = 1;
        ws.lastRateReset = now;
      } else {
        ws.messageCount++;
        if (ws.messageCount > RATE_LIMIT_MAX_MESSAGES) {
          log(`Rate limit exceeded for socket (${ws.peerId || 'anonymous'})`, 'SECURITY');
          safeSend(ws, { type: 'error', message: 'Signaling rate limit exceeded. Please slow down.' });
          return;
        }
      }

      // 2. Safe Parsing
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

      const { type, roomId, peerId, target, sdp, candidate, passwordHash } = message;

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

          // Check global room quota if creating a new room
          if (!rooms.has(roomId) && rooms.size >= MAX_ACTIVE_ROOMS) {
            log(`Active room capacity reached (${MAX_ACTIVE_ROOMS})`, 'WARN');
            safeSend(ws, { type: 'error', message: 'Server room capacity reached. Try again later.' });
            return;
          }

          // Leave current room if already in one
          if (ws.roomId) {
            removeClientFromRoom(ws);
          }

          if (!rooms.has(roomId)) {
            rooms.set(roomId, {
              clients: new Map(),
              passwordHash: typeof passwordHash === 'string' && passwordHash.trim() ? passwordHash.trim() : null
            });
          }

          const room = rooms.get(roomId);

          // Room Password Verification
          if (room.passwordHash) {
            if (!passwordHash || passwordHash !== room.passwordHash) {
              log(`Peer \x1b[33${peerId}\x1b[0m failed password authentication for room \x1b[32m${roomId}\x1b[0m`, 'SECURITY');
              safeSend(ws, {
                type: 'auth-required',
                roomId,
                message: 'Este nó requer uma senha de acesso válida.'
              });
              return;
            }
          } else if (passwordHash && room.clients.size === 0) {
            // First peer sets the room password
            room.passwordHash = passwordHash;
          }

          // Check peer quota per room
          if (room.clients.size >= MAX_PEERS_PER_ROOM) {
            log(`Room ${roomId} is full (${room.clients.size}/${MAX_PEERS_PER_ROOM})`, 'WARN');
            safeSend(ws, {
              type: 'error',
              message: `Room capacity exceeded (maximum ${MAX_PEERS_PER_ROOM} peers)`
            });
            return;
          }

          ws.roomId = roomId;
          ws.peerId = peerId;

          // Get existing peers in this room
          const existingPeers = Array.from(room.clients.keys());

          // Register this client
          room.clients.set(peerId, { ws, peerId, joinedAt: Date.now() });

          log(`Peer \x1b[33m${peerId}\x1b[0m joined room \x1b[32m${roomId}\x1b[0m (Total: ${room.clients.size})`, 'ROOM');

          // Send confirmation with existing peers
          safeSend(ws, {
            type: 'room-joined',
            roomId,
            peerId,
            isProtected: !!room.passwordHash,
            peers: existingPeers
          });

          // Notify existing peers about this new peer
          for (const otherPeerId of existingPeers) {
            const peerClient = room.clients.get(otherPeerId);
            if (peerClient) {
              safeSend(peerClient.ws, {
                type: 'peer-joined',
                peerId
              });
            }
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

  ws.on('close', () => {
    removeClientFromRoom(ws);
  });

  ws.on('error', (err) => {
    console.error(`[WS CLIENT ERROR] ${ws.peerId || 'Unknown'}:`, err);
    removeClientFromRoom(ws);
  });
});

// Periodic heartbeat / ping to detect dead sockets
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

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

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
