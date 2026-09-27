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

app.use(express.static(staticDir));

// Basic system health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'SYNAPSE_SIGNALING_CORE',
    version: '1.1.0',
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size
  });
});

// Fallback to index.html for SPA room routes
app.get('*', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

// WebSocket Signaling Server
const wss = new WebSocketServer({ server });

// Map<roomId, Map<peerId, { ws: WebSocket, peerId: string, joinedAt: number }>>
const rooms = new Map();

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
  if (room) {
    room.delete(peerId);
    log(`Peer \x1b[33m${peerId}\x1b[0m disconnected from room \x1b[32m${roomId}\x1b[0m`, 'CORE');

    // Notify remaining peers
    for (const [otherPeerId, client] of room.entries()) {
      safeSend(client.ws, {
        type: 'peer-disconnected',
        peerId
      });
    }

    if (room.size === 0) {
      rooms.delete(roomId);
      log(`Room \x1b[32m${roomId}\x1b[0m purged (0 peers remaining)`, 'PURGE');
    }
  }

  ws.roomId = null;
  ws.peerId = null;
}

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  log(`New WebRTC signaling connection from ${req.socket.remoteAddress}`, 'CONNECT');

  ws.on('message', (messageRaw) => {
    try {
      const message = JSON.parse(messageRaw);
      const { type, roomId, peerId, target, sdp, candidate, payload } = message;

      switch (type) {
        case 'join-room': {
          if (!roomId || !peerId) {
            safeSend(ws, { type: 'error', message: 'Missing roomId or peerId' });
            return;
          }

          // Leave current room if already in one
          if (ws.roomId) {
            removeClientFromRoom(ws);
          }

          ws.roomId = roomId;
          ws.peerId = peerId;

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
          }
          const room = rooms.get(roomId);

          // Get existing peers in this room
          const existingPeers = Array.from(room.keys());

          // Register this client
          room.set(peerId, { ws, peerId, joinedAt: Date.now() });

          log(`Peer \x1b[33m${peerId}\x1b[0m joined room \x1b[32m${roomId}\x1b[0m (Total: ${room.size})`, 'ROOM');

          // Send confirmation with existing peers
          safeSend(ws, {
            type: 'room-joined',
            roomId,
            peerId,
            peers: existingPeers
          });

          // Notify existing peers about this new peer
          for (const otherPeerId of existingPeers) {
            const peerClient = room.get(otherPeerId);
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
          if (!ws.roomId || !target) return;
          const room = rooms.get(ws.roomId);
          if (!room) return;

          const targetClient = room.get(target);
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
          if (!ws.roomId || !target) return;
          const room = rooms.get(ws.roomId);
          if (!room) return;

          const targetClient = room.get(target);
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
          if (!ws.roomId || !target) return;
          const room = rooms.get(ws.roomId);
          if (!room) return;

          const targetClient = room.get(target);
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
      console.error('[MESSAGE PARSE ERROR]:', err);
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
