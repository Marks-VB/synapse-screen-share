import { useState, useRef, useEffect, useCallback } from 'react';

const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Custom hook dedicated strictly to WebSocket signaling transport.
 * Manages connection lifecycle, heartbeats, exponential backoff reconnection and message dispatch.
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
  const retryCountRef = useRef(0);

  // Preserve latest callbacks in mutable refs to keep connect() callback reference stable
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

    // Prevent clobbering an existing healthy or pending socket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        return;
      }
      if (wsRef.current.readyState === WebSocket.CONNECTING) {
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
          peerId: operatorId
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
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

        if (retryCountRef.current < MAX_RECONNECT_ATTEMPTS) {
          retryCountRef.current += 1;
          const delay = Math.min(1000 * Math.pow(1.8, retryCountRef.current - 1), 10000);
          setConnectionState('reconnecting');
          log(
            `[SIGNALING] Connection lost. Retrying (${retryCountRef.current}/${MAX_RECONNECT_ATTEMPTS}) in ${(delay / 1000).toFixed(1)}s...`,
            'WARN'
          );

          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            performConnect(false);
          }, delay);
        } else {
          setConnectionState('error');
          log(
            `[SIGNALING] Max reconnection attempts reached (${MAX_RECONNECT_ATTEMPTS}). Signaling server unreachable at ${signalingUrl}. Verify settings or start local server.`,
            'ERROR'
          );
        }
      };

      ws.onerror = () => {
        log('[SIGNALING] WebSocket communication error (endpoint unreachable or connection rejected).', 'ERROR');
      };
    } catch (err) {
      log(`[SIGNALING] Initialization failed: ${err.message}`, 'ERROR');
      setConnectionState('error');
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

  return {
    connectionState,
    send,
    connect,
    disconnect
  };
}
