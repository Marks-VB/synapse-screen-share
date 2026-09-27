import { useState, useRef, useEffect, useCallback } from 'react';
import { useSignaling } from './useSignaling';
import { parseWebRTCStats } from '../utils/statsParser';

/**
 * Custom hook dedicated strictly to WebRTC PeerConnection, SDP handshake, ICE candidates,
 * DataChannel and media track transceivers.
 * Uses useSignaling internally for clean transport separation.
 */
export function useWebRTC({
  signalingUrl,
  roomId,
  operatorId,
  isScreenSharing,
  activeQuality,
  onRemoteStreamReceived
}) {
  const [webrtcState, setWebrtcState] = useState('idle');
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

  // Persistent references preventing unnecessary re-renders
  const pcRef = useRef(null);
  const dataChannelRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const statsIntervalRef = useRef(null);
  const prevStatsStateRef = useRef({});

  // Append diagnostic log
  const logDiag = useCallback((msg, level = 'INFO') => {
    const timeStr =
      new Date().toLocaleTimeString('en-GB', { hour12: false }) +
      '.' +
      String(new Date().getMilliseconds()).padStart(3, '0');
    setDiagLogs((prev) => [
      ...prev.slice(-150),
      { id: Math.random().toString(36).substring(2, 9), timestamp: timeStr, level, msg }
    ]);
  }, []);

  // Append chat message
  const addChatMessage = useCallback((sender, text, isSystem = false) => {
    const timeStr = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setChatMessages((prev) => [
      ...prev,
      { id: Math.random().toString(36).substring(2, 9), sender, text, timestamp: timeStr, isSystem }
    ]);
  }, []);

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
        // Stats sampling error or peer closed
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

  // Flush queued candidates once remoteDescription is set
  const drainPendingCandidates = useCallback(async (pc) => {
    if (pc && pendingCandidatesRef.current.length > 0) {
      logDiag(`Flushing ${pendingCandidatesRef.current.length} queued ICE candidates...`, 'INFO');
      while (pendingCandidatesRef.current.length > 0) {
        const candidate = pendingCandidatesRef.current.shift();
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          // Ignore duplicate / stale candidates
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
        if (payload && typeof payload.text === 'string') {
          const sender = typeof payload.sender === 'string' ? payload.sender.slice(0, 32) : 'REMOTE';
          const text = payload.text.slice(0, 1000);
          addChatMessage(sender, text);
        }
      } catch {
        if (typeof e.data === 'string') {
          addChatMessage('REMOTE', e.data.slice(0, 1000));
        }
      }
    };
  }, [addChatMessage, logDiag]);

  // Initialize or return PeerConnection
  const ensurePeerConnection = useCallback((sendSignalingFn) => {
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
      if (event.candidate && remotePeerId && sendSignalingFn) {
        sendSignalingFn({
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
      setWebrtcState(pc.connectionState);
      logDiag(`Connection State -> ${pc.connectionState}`, 'INFO');
    };

    // Incoming remote track handling with MediaStream ref
    pc.ontrack = (event) => {
      logDiag(`Remote media track arrived: ${event.track.kind}`, 'SUCCESS');
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
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
  }, [logDiag, onRemoteStreamReceived, remotePeerId, setupDataChannel, startTelemetry, stopTelemetry]);

  // Cleanly close WebRTC connection and media transceivers
  const closeConnection = useCallback(() => {
    logDiag('Severing WebRTC link and media transceivers...', 'WARN');
    stopTelemetry();

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => {
        try {
          if (sender.track) sender.track.stop();
        } catch (e) {
          // sender stop error
        }
      });
      pcRef.current.close();
      pcRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    setRemoteStream(null);
    setWebrtcState('idle');
    setIceState('new');
    addChatMessage('SYSTEM', 'Uplink terminated.', true);
  }, [addChatMessage, logDiag, stopTelemetry]);

  // Handle incoming signaling messages
  const handleSignalingMessage = useCallback(async (msg, sendSignalingFn) => {
    switch (msg.type) {
      case 'room-joined': {
        logDiag(`Uplink established in Node [${msg.roomId}]. Peers: ${msg.peers.length}`, 'SUCCESS');
        if (msg.peers.length > 0) {
          setRemotePeerId(msg.peers[0]);
          logDiag(`Target peer identified: ${msg.peers[0]}`, 'INFO');
        }
        break;
      }
      case 'peer-joined': {
        logDiag(`Remote peer entered Node: ${msg.peerId}`, 'INFO');
        setRemotePeerId(msg.peerId);
        addChatMessage('SYSTEM', `Peer ${msg.peerId} established uplink.`, true);
        break;
      }
      case 'offer': {
        if (!msg.from || !msg.sdp || typeof msg.sdp.sdp !== 'string' || !['offer', 'answer'].includes(msg.sdp.type)) {
          logDiag('Rejected malformed SDP Offer payload.', 'WARN');
          return;
        }
        setRemotePeerId(msg.from);
        const pc = ensurePeerConnection(sendSignalingFn);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          await drainPendingCandidates(pc);

          logDiag(`SDP Offer ingested from ${msg.from}. Creating Answer...`, 'SIGNAL');
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          sendSignalingFn({
            type: 'answer',
            target: msg.from,
            sdp: pc.localDescription
          });
        } catch (err) {
          logDiag(`SDP Offer handling failed: ${err.message}`, 'ERROR');
        }
        break;
      }
      case 'answer': {
        if (!pcRef.current || !msg.sdp || typeof msg.sdp.sdp !== 'string') {
          logDiag('Rejected malformed SDP Answer payload.', 'WARN');
          return;
        }
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          await drainPendingCandidates(pcRef.current);
          logDiag('Remote SDP Answer synced.', 'SUCCESS');
        } catch (err) {
          logDiag(`SDP Answer handling failed: ${err.message}`, 'ERROR');
        }
        break;
      }
      case 'ice-candidate': {
        if (msg.candidate && typeof msg.candidate.candidate === 'string') {
          const candidate = new RTCIceCandidate(msg.candidate);
          if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
            try {
              await pcRef.current.addIceCandidate(candidate);
            } catch {
              // Ignore duplicate candidate
            }
          } else {
            pendingCandidatesRef.current.push(candidate);
          }
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
  }, [addChatMessage, drainPendingCandidates, ensurePeerConnection, logDiag, stopTelemetry]);

  // Dedicated WebSocket Transport Hook
  const {
    connectionState: signalingState,
    send: sendSignaling,
    disconnect: disconnectSignaling
  } = useSignaling({
    signalingUrl,
    roomId,
    operatorId,
    onMessage: (msg) => handleSignalingMessage(msg, sendSignaling),
    onLog: logDiag
  });

  // Create and send SDP Offer
  const sendOffer = useCallback(async (targetPeer = remotePeerId) => {
    const pc = ensurePeerConnection(sendSignaling);
    try {
      logDiag(`Formulating SDP Offer for peer ${targetPeer}...`, 'SIGNAL');

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

  // Send message over DataChannel
  const sendMessage = useCallback((text) => {
    if (!text || typeof text !== 'string' || !text.trim()) return;
    const clampedText = text.trim().slice(0, 1000);
    const payload = {
      sender: operatorId,
      text: clampedText,
      timestamp: Date.now()
    };

    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(payload));
    } else {
      logDiag('DataChannel not connected; message cached locally.', 'WARN');
    }

    addChatMessage(operatorId, clampedText);
  }, [addChatMessage, logDiag, operatorId]);

  // Attach local media stream tracks to RTCPeerConnection
  const attachLocalStream = useCallback((stream) => {
    const pc = ensurePeerConnection(sendSignaling);
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });
    logDiag('Local media tracks attached to RTCPeerConnection.', 'SUCCESS');
  }, [ensurePeerConnection, logDiag, sendSignaling]);

  const clearLogs = useCallback(() => {
    setDiagLogs([]);
  }, []);

  // Cleanup WebRTC & telemetry on unmount
  useEffect(() => {
    return () => {
      closeConnection();
    };
  }, [closeConnection]);

  // Consolidated connection status
  const connectionState = signalingState === 'connected' ? (webrtcState === 'connected' ? 'connected' : 'standby') : signalingState;

  return {
    pcRef,
    connectionState,
    signalingState,
    webrtcState,
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
    disconnectSignaling,
    clearLogs,
    logDiag
  };
}
