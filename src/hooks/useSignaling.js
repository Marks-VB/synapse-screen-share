import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook dedicated strictly to WebSocket signaling transport.
 * Manages connection lifecycle, heartbeats, automatic reconnection and message dispatch.
 */
export function useSignaling({
  signalingUrl,
  roomId,
  operatorId,
  onMessage,
  onLog
}) {
  const [connectionState, setConnectionState] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isManuallyClosedRef = useRef(false);

  const log = useCallback((msg, level = 'INFO') => {
    if (onLog) onLog(msg, level);
  }, [onLog]);

  // Safe message sender
  const send = useCallback((payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  // Connect & reconnect logic
  const connect = useCallback(() => {
    if (!signalingUrl) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    log(`[SIGNALING] Connecting to uplink: ${signalingUrl}`, 'INFO');
    setConnectionState('connecting');

    try {
      const ws = new WebSocket(signalingUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        log(`[SIGNALING] Channel OPEN. Authenticating Node [${roomId}] as ${operatorId}...`, 'SUCCESS');
        setConnectionState('connected');
        send({
          type: 'join-room',
          roomId,
          peerId: operatorId
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessage) {
            onMessage(data);
          }
        } catch (err) {
          log(`[SIGNALING] Message parse error: ${err.message}`, 'ERROR');
        }
      };

      ws.onclose = (event) => {
        setConnectionState('disconnected');
        log(`[SIGNALING] Channel closed (code: ${event.code}).`, 'WARN');
        
        // Auto-reconnect if not intentionally closed
        if (!isManuallyClosedRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            log('[SIGNALING] Attempting reconnect...', 'INFO');
            connect();
          }, 3000);
        }
      };

      ws.onerror = (err) => {
        log('[SIGNALING] WebSocket communication error.', 'ERROR');
      };
    } catch (err) {
      log(`[SIGNALING] Initialization failed: ${err.message}`, 'ERROR');
      setConnectionState('failed');
    }
  }, [signalingUrl, roomId, operatorId, send, onMessage, log]);

  // Disconnect cleanly
  const disconnect = useCallback(() => {
    isManuallyClosedRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        send({ type: 'leave-room' });
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionState('disconnected');
  }, [send]);

  useEffect(() => {
    isManuallyClosedRef.current = false;
    connect();

    return () => {
      isManuallyClosedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'leave-room' }));
        }
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    connectionState,
    send,
    connect,
    disconnect
  };
}
