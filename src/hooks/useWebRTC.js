import { useState, useRef, useEffect, useCallback } from 'react';
import { parseWebRTCStats } from '../utils/statsParser';

export function useWebRTC({
  signalingUrl,
  roomId,
  operatorId,
  isScreenSharing,
  activeQuality,
  onRemoteStreamReceived
}) {
  const [connectionState, setConnectionState] = useState('idle');
  const [iceState, setIceState] = useState('new');
  const [remoteStream, setRemoteStream] = useState(null);
  const [remotePeerId, setRemotePeerId] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'init-sys',
      sender: 'SYSTEM',
      text: 'Synapse DataChannel initialized. Secure peer messaging ready.',
      timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      isSystem: true
    }
  ]);
  const [diagLogs, setDiagLogs] = useState([
    {
      id: 'init-diag',
      timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      level: 'SYS_INIT',
      msg: 'Synapse WebRTC media core initialized.'
    }
  ]);
  const [metrics, setMetrics] = useState({
    resolution: '0x0',
    fps: 0,
    bitrateMbps: '0.00',
    rttMs: null,
    packetLossPct: 0
  });

  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const dataChannelRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const statsIntervalRef = useRef(null);
  const prevStatsStateRef = useRef({});

  // Append to diagnostics log
  const logDiag = useCallback((msg, level = 'INFO') => {
    const timeStr =
      new Date().toLocaleTimeString('en-GB', { hour12: false }) +
      '.' +
      String(new Date().getMilliseconds()).padStart(3, '0');
    setDiagLogs((prev) => [
      ...prev.slice(-150), // keep latest 150 lines
      { id: Math.random().toString(36).substring(2, 9), timestamp: timeStr, level, msg }
    ]);
  }, []);

  // Append to chat messages
  const addChatMessage = useCallback((sender, text, isSystem = false) => {
    const timeStr = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setChatMessages((prev) => [
      ...prev,
      { id: Math.random().toString(36).substring(2, 9), sender, text, timestamp: timeStr, isSystem }
    ]);
  }, []);

  // Safe WebSocket send
  const sendSignaling = useCallback((payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  // Flush queued candidates once remoteDescription is set
  const drainPendingCandidates = useCallback(async (pc) => {
    if (pc && pendingCandidatesRef.current.length > 0) {
      logDiag(`Flushing ${pendingCandidatesRef.current.length} queued ICE candidates...`, 'INFO');
      while (pendingCandidatesRef.current.length > 0) {
        const candidate = pendingCandidatesRef.current.shift();
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          // ignore duplicate/stale
        }
      }
    }
  }, [logDiag]);

  // Setup DataChannel listeners
  const setupDataChannel = useCallback((channel) => {
    dataChannelRef.current = channel;
    channel.onopen = () => {
      logDiag('RTCDataChannel is OPEN. Terminal link online.', 'SUCCESS');
      addChatMessage('SYSTEM', 'DataChannel established. Direct P2P link active.', true);
    };
    channel.onclose = () => {
      logDiag('RTCDataChannel closed.', 'WARN');
    };
    channel.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        addChatMessage(payload.sender, payload.text);
      } catch (err) {
        addChatMessage('REMOTE', e.data);
      }
    };
  }, [addChatMessage, logDiag]);

  // Telemetry HUD Polling
  const startTelemetry = useCallback((pc) => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    statsIntervalRef.current = setInterval(async () => {
      if (!pc || pc.signalingState === 'closed') return;
      try {
        const stats = await pc.getStats();
        const { metrics: newMetrics, nextState } = parseWebRTCStats(stats, prevStatsStateRef.current);
        prevStatsStateRef.current = nextState;
        setMetrics(newMetrics);
      } catch (e) {
        // stats error
      }
    }, 1000);
  }, []);

  const stopTelemetry = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    setMetrics({
      resolution: '0x0',
      fps: 0,
      bitrateMbps: '0.00',
      rttMs: null,
      packetLossPct: 0
    });
  }, []);

  // Initialize or return PeerConnection
  const ensurePeerConnection = useCallback(() => {
    if (pcRef.current && pcRef.current.signalingState !== 'closed') {
      return pcRef.current;
    }

    logDiag('Initializing new RTCPeerConnection (STUN: Google Public)...', 'INFO');
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && remotePeerId) {
        sendSignaling({
          type: 'ice-candidate',
          target: remotePeerId,
          candidate: event.candidate
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      setIceState(pc.iceConnectionState);
      logDiag(`ICE State changed -> ${pc.iceConnectionState}`, 'INFO');
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        startTelemetry(pc);
      } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        stopTelemetry();
      }
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      logDiag(`Connection State -> ${pc.connectionState}`, 'INFO');
    };

    // Incoming remote track
    pc.ontrack = (event) => {
      logDiag(`Remote media track arrived: ${event.track.kind}`, 'SUCCESS');
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        if (onRemoteStreamReceived) {
          onRemoteStreamReceived(event.streams[0]);
        }
      }
    };

    // Incoming data channel
    pc.ondatachannel = (event) => {
      logDiag('Remote DataChannel arrived: ' + event.channel.label, 'INFO');
      setupDataChannel(event.channel);
    };

    pcRef.current = pc;
    return pc;
  }, [logDiag, onRemoteStreamReceived, remotePeerId, sendSignaling, setupDataChannel, startTelemetry, stopTelemetry]);

  // Create and send SDP Offer
  const sendOffer = useCallback(async (targetPeer = remotePeerId) => {
    const pc = ensurePeerConnection();
    try {
      logDiag(`Formulating SDP Offer for peer ${targetPeer}...`, 'SIGNAL');
      
      // Ensure local DataChannel exists for host
      if (!dataChannelRef.current) {
        const dc = pc.createDataChannel('synapse-terminal', { ordered: true });
        setupDataChannel(dc);
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      sendSignaling({
        type: 'offer',
        target: targetPeer,
        sdp: pc.localDescription
      });
    } catch (err) {
      logDiag(`SDP Offer creation failed: ${err.message}`, 'ERROR');
    }
  }, [ensurePeerConnection, logDiag, remotePeerId, sendSignaling, setupDataChannel]);

  // Handle incoming SDP Offer
  const handleOffer = useCallback(async (sdp, fromPeer) => {
    const pc = ensurePeerConnection();
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await drainPendingCandidates(pc);

      logDiag(`SDP Offer ingested from ${fromPeer}. Creating Answer...`, 'SIGNAL');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendSignaling({
        type: 'answer',
        target: fromPeer,
        sdp: pc.localDescription
      });
    } catch (err) {
      logDiag(`SDP Offer handling failed: ${err.message}`, 'ERROR');
    }
  }, [drainPendingCandidates, ensurePeerConnection, logDiag, sendSignaling]);

  // Handle incoming SDP Answer
  const handleAnswer = useCallback(async (sdp) => {
    if (!pcRef.current) return;
    try {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      await drainPendingCandidates(pcRef.current);
      logDiag('Remote SDP Answer synced.', 'SUCCESS');
    } catch (err) {
      logDiag(`SDP Answer handling failed: ${err.message}`, 'ERROR');
    }
  }, [drainPendingCandidates, logDiag]);

  // Handle incoming ICE Candidate
  const handleRemoteCandidate = useCallback(async (candidateInit) => {
    const candidate = new RTCIceCandidate(candidateInit);
    if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
      try {
        await pcRef.current.addIceCandidate(candidate);
      } catch (err) {
        // ignore duplicate
      }
    } else {
      pendingCandidatesRef.current.push(candidate);
    }
  }, []);

  // Connect WebSocket Signaling Server
  useEffect(() => {
    if (!signalingUrl) return;

    logDiag(`Connecting to signaling uplink: ${signalingUrl}`, 'INFO');
    const ws = new WebSocket(signalingUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      logDiag(`Signaling channel OPEN. Authenticating as ${operatorId}...`, 'SUCCESS');
      setConnectionState('connected');
      ws.send(
        JSON.stringify({
          type: 'join-room',
          roomId,
          peerId: operatorId
        })
      );
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'room-joined': {
            logDiag(`Uplink established in Node [${msg.roomId}]. Peers: ${msg.peers.length}`, 'SUCCESS');
            if (msg.peers.length > 0) {
              setRemotePeerId(msg.peers[0]);
              logDiag(`Target peer identified: ${msg.peers[0]}`, 'INFO');
              if (isScreenSharing) {
                await sendOffer(msg.peers[0]);
              }
            }
            break;
          }
          case 'peer-joined': {
            logDiag(`Remote peer entered Node: ${msg.peerId}`, 'INFO');
            setRemotePeerId(msg.peerId);
            addChatMessage('SYSTEM', `Peer ${msg.peerId} established uplink.`, true);
            if (isScreenSharing) {
              await sendOffer(msg.peerId);
            }
            break;
          }
          case 'offer': {
            setRemotePeerId(msg.from);
            await handleOffer(msg.sdp, msg.from);
            break;
          }
          case 'answer': {
            await handleAnswer(msg.sdp);
            break;
          }
          case 'ice-candidate': {
            if (msg.candidate) {
              await handleRemoteCandidate(msg.candidate);
            }
            break;
          }
          case 'peer-disconnected': {
            logDiag(`Peer ${msg.peerId} disconnected.`, 'WARN');
            addChatMessage('SYSTEM', `Peer ${msg.peerId} severed link.`, true);
            setRemotePeerId((current) => (current === msg.peerId ? null : current));
            setRemoteStream(null);
            stopTelemetry();
            break;
          }
          default:
            break;
        }
      } catch (err) {
        logDiag(`Signaling error: ${err.message}`, 'ERROR');
      }
    };

    ws.onclose = () => {
      logDiag('Signaling server link disconnected.', 'WARN');
      setConnectionState('disconnected');
    };

    ws.onerror = () => {
      logDiag('Signaling WebSocket error.', 'ERROR');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'leave-room' }));
      }
      ws.close();
      stopTelemetry();
    };
  }, [
    signalingUrl,
    roomId,
    operatorId,
    isScreenSharing,
    handleOffer,
    handleAnswer,
    handleRemoteCandidate,
    logDiag,
    addChatMessage,
    sendOffer,
    stopTelemetry
  ]);

  // Send message over DataChannel
  const sendMessage = useCallback((text) => {
    if (!text || !text.trim()) return;
    const trimmed = text.trim();
    const payload = {
      sender: operatorId,
      text: trimmed,
      timestamp: Date.now()
    };

    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(payload));
    } else {
      logDiag('DataChannel not connected; message cached locally.', 'WARN');
    }

    addChatMessage(operatorId, trimmed);
  }, [addChatMessage, logDiag, operatorId]);

  // Attach local media stream tracks to RTCPeerConnection
  const attachLocalStream = useCallback((stream) => {
    const pc = ensurePeerConnection();
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });
    logDiag('Local media tracks attached to RTCPeerConnection.', 'SUCCESS');
  }, [ensurePeerConnection, logDiag]);

  // Disconnect / terminate WebRTC link
  const closeConnection = useCallback(() => {
    logDiag('Severing WebRTC link and media transceivers...', 'WARN');
    stopTelemetry();

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setRemoteStream(null);
    setConnectionState('idle');
    setIceState('new');
    addChatMessage('SYSTEM', 'Uplink terminated.', true);
  }, [addChatMessage, logDiag, stopTelemetry]);

  const clearLogs = useCallback(() => {
    setDiagLogs([]);
  }, []);

  return {
    pcRef,
    connectionState,
    iceState,
    remoteStream,
    remotePeerId,
    chatMessages,
    diagLogs,
    metrics,
    sendMessage,
    attachLocalStream,
    sendOffer,
    closeConnection,
    clearLogs,
    logDiag
  };
}
