import { useState, useRef, useEffect, useCallback } from 'react';

import { computeChallengeResponse } from '../utils/security';

const MAX_FAST_RECONNECT_ATTEMPTS = 5;
const BACKGROUND_RECONNECT_INTERVAL_MS = 10000;

/**
 * Custom hook dedicated strictly to WebSocket signaling transport.
 * Manages connection lifecycle, heartbeats, exponential backoff reconnection and message dispatch.
 */
export function useSignaling({
  signalingUrl,
  roomId,
  operatorId,
  passwordHash,
  onMessage,
  onLog
}) {
  const [connectionState, setConnectionState] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isManuallyClosedRef = useRef(false);
  const retryCountRef = useRef(0);

  // Preserve latest callbacks and credentials in mutable refs
  const passwordHashRef = useRef(passwordHash);
  passwordHashRef.current = passwordHash;

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;

  const log = useCallback((msg, level = 'INFO') => {
    if (onLogRef.current) {
      onLogRef.current(msg, level);
    }
  }, []);

  // Safe message sender
  const send = useCallback((payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  // Internal connection executor
  const performConnect = useCallback((isManualReset = false) => {
    if (!signalingUrl) {
      setConnectionState('disconnected');
      return;
    }

    if (isManualReset) {
      retryCountRef.current = 0;
      isManuallyClosedRef.current = false;
    }

    // Clean up existing socket if manually resetting or stale
    if (wsRef.current) {
      if (!isManualReset && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }
      try {
        wsRef.current.close();
      } catch {
        // Safe ignore
      }
      wsRef.current = null;
    }

    log(`[SIGNALING] Connecting to uplink: ${signalingUrl}`, 'INFO');
    setConnectionState('connecting');

    try {
      const ws = new WebSocket(signalingUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retryCountRef.current = 0;
        log(`[SIGNALING] Channel OPEN. Authenticating Node [${roomId}] as ${operatorId}...`, 'SUCCESS');
        setConnectionState('connected');
        send({
          type: 'join-room',
          roomId,
          peerId: operatorId,
          passwordHash: passwordHashRef.current || null
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle HMAC challenge response automatically if password hash is present
          if (data && data.type === 'auth-required' && data.challenge && passwordHashRef.current) {
            computeChallengeResponse(passwordHashRef.current, data.challenge).then((token) => {
              if (token) {
                log('[SIGNALING] Submitting HMAC challenge response for authentication...', 'SECURITY');
                send({
                  type: 'auth-response',
                  roomId,
                  peerId: operatorId,
                  token
                });
              }
            });
          }

          if (onMessageRef.current) {
            onMessageRef.current(data);
          }
        } catch (err) {
          log(`[SIGNALING] Message parse error: ${err.message}`, 'ERROR');
        }
      };

      ws.onclose = (event) => {
        wsRef.current = null;

        if (isManuallyClosedRef.current) {
          setConnectionState('disconnected');
          log(`[SIGNALING] Channel closed cleanly (code: ${event.code}).`, 'WARN');
          return;
        }

        if (retryCountRef.current < MAX_FAST_RECONNECT_ATTEMPTS) {
          retryCountRef.current += 1;
          const delay = Math.min(1000 * Math.pow(1.8, retryCountRef.current - 1), 6000);
          setConnectionState('reconnecting');
          log(
            `[SIGNALING] Conectando ao canal (${retryCountRef.current}/${MAX_FAST_RECONNECT_ATTEMPTS})...`,
            'INFO'
          );

          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            performConnect(false);
          }, delay);
        } else {
          setConnectionState('standby');
          log(
            `[SIGNALING] Canal em modo de espera (STANDBY). Use 'npm run server' ou configure a URL de sinalização em Configurações. Tentando novamente em segundo plano...`,
            'INFO'
          );
          // Keep a low-frequency background heartbeat reconnect attempt
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            performConnect(false);
          }, BACKGROUND_RECONNECT_INTERVAL_MS);
        }
      };

      ws.onerror = () => {
        // Silently handled in onclose
      };
    } catch (err) {
      setConnectionState('standby');
      log(`[SIGNALING] Inicialização em modo de espera: ${err.message}`, 'INFO');
    }
  }, [signalingUrl, roomId, operatorId, send, log]);

  // Connect cleanly on demand
  const connect = useCallback(() => {
    performConnect(true);
  }, [performConnect]);

  // Disconnect cleanly
  const disconnect = useCallback(() => {
    isManuallyClosedRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'leave-room' }));
        } catch {
          // Ignore
        }
      }
      try {
        wsRef.current.close();
      } catch {
        // Ignore
      }
      wsRef.current = null;
    }
    setConnectionState('disconnected');
  }, []);

  // Connect when parameters change
  useEffect(() => {
    isManuallyClosedRef.current = false;
    performConnect(true);

    return () => {
      isManuallyClosedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: 'leave-room' }));
          } catch {
            // Ignore
          }
        }
        try {
          wsRef.current.close();
        } catch {
          // Ignore
        }
        wsRef.current = null;
      }
    };
  }, [performConnect]);

  // Re-authenticate if passwordHash updates while socket is already open
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && passwordHash) {
      log(`[SIGNALING] Updating authentication credentials for Node [${roomId}]...`, 'INFO');
      send({
        type: 'join-room',
        roomId,
        peerId: operatorId,
        passwordHash
      });
    }
  }, [passwordHash, roomId, operatorId, send, log]);

  return {
    connectionState,
    send,
    connect,
    disconnect
  };
}
