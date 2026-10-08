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
  passwordHash,
  isScreenSharing,
  activeQuality,
  onRemoteStreamReceived,
  onAuthRequired
}) {
  const onAuthRequiredRef = useRef(onAuthRequired);
  onAuthRequiredRef.current = onAuthRequired;

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

  // Persistent references preventing unnecessary re-renders & closure staleness
  const pcRef = useRef(null);
  const dataChannelRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remotePeerIdRef = useRef(null);
  const pendingRemoteCandidatesRef = useRef([]);
  const pendingLocalCandidatesRef = useRef([]);
  const statsIntervalRef = useRef(null);
  const prevStatsStateRef = useRef({});
  const sendSignalingRef = useRef(null);

  // Synchronize remotePeerId in state and ref
  const updateRemotePeer = useCallback((id) => {
    remotePeerIdRef.current = id;
    setRemotePeerId(id);
  }, []);

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

  // Flush queued remote candidates once remoteDescription is set
  const drainPendingRemoteCandidates = useCallback(async (pc) => {
    if (pc && pendingRemoteCandidatesRef.current.length > 0) {
      logDiag(`Flushing ${pendingRemoteCandidatesRef.current.length} queued remote ICE candidates...`, 'INFO');
      while (pendingRemoteCandidatesRef.current.length > 0) {
        const candidate = pendingRemoteCandidatesRef.current.shift();
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          // Ignore duplicate / stale candidates
        }
      }
    }
  }, [logDiag]);

  // Flush queued local candidates once remote peer target is known
  const drainPendingLocalCandidates = useCallback((targetPeer) => {
    const target = targetPeer || remotePeerIdRef.current;
    if (target && pendingLocalCandidatesRef.current.length > 0) {
      logDiag(`Flushing ${pendingLocalCandidatesRef.current.length} queued local ICE candidates to ${target}...`, 'INFO');
      while (pendingLocalCandidatesRef.current.length > 0) {
        const candidate = pendingLocalCandidatesRef.current.shift();
        if (sendSignalingRef.current) {
          sendSignalingRef.current({
            type: 'ice-candidate',
            target,
            candidate: candidate.toJSON ? candidate.toJSON() : candidate
          });
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
      if (event.candidate) {
        const target = remotePeerIdRef.current;
        if (target && sendSignalingRef.current) {
          sendSignalingRef.current({
            type: 'ice-candidate',
            target,
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate
          });
        } else {
          pendingLocalCandidatesRef.current.push(event.candidate);
        }
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
  }, [logDiag, onRemoteStreamReceived, setupDataChannel, startTelemetry, stopTelemetry]);

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

    pendingRemoteCandidatesRef.current = [];
    pendingLocalCandidatesRef.current = [];
    setRemoteStream(null);
    setWebrtcState('idle');
    setIceState('new');
    addChatMessage('SYSTEM', 'Uplink terminated.', true);
  }, [addChatMessage, logDiag, stopTelemetry]);

  // Create and send SDP Offer
  const sendOffer = useCallback(async (targetPeer) => {
    const target = targetPeer || remotePeerIdRef.current;
    if (!target) {
      logDiag('Offer deferred: waiting for remote peer to enter Node...', 'INFO');
      return;
    }

    const pc = ensurePeerConnection();
    try {
      logDiag(`Formulating SDP Offer for peer ${target}...`, 'SIGNAL');

      if (!dataChannelRef.current || dataChannelRef.current.readyState === 'closed') {
        const dc = pc.createDataChannel('synapse-terminal', { ordered: true });
        setupDataChannel(dc);
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      if (sendSignalingRef.current) {
        sendSignalingRef.current({
          type: 'offer',
          target,
          sdp: pc.localDescription
        });
      }
      drainPendingLocalCandidates(target);
    } catch (err) {
      logDiag(`SDP Offer creation failed: ${err.message}`, 'ERROR');
    }
  }, [drainPendingLocalCandidates, ensurePeerConnection, logDiag, setupDataChannel]);

  // Handle incoming signaling messages
  const handleSignalingMessage = useCallback(async (msg) => {
    switch (msg.type) {
      case 'room-joined': {
        logDiag(`Uplink established in Node [${msg.roomId}]. Peers: ${msg.peers.length}${msg.isProtected ? ' [PROTEGIDO]' : ''}`, 'SUCCESS');
        if (msg.peers.length > 0) {
          const hostPeer = msg.peers[0];
          updateRemotePeer(hostPeer);
          logDiag(`Target peer identified: ${hostPeer}. Awaiting WebRTC offer...`, 'INFO');
          // Prepare PeerConnection ready to receive incoming offer
          ensurePeerConnection();
          drainPendingLocalCandidates(hostPeer);
        }
        break;
      }
      case 'auth-required':
      case 'auth-error': {
        logDiag(`[SEGURANÇA] ${msg.message || 'Autenticação necessária para este nó.'}`, 'WARN');
        addChatMessage('SYSTEM', `ACESSO RESTRITO: ${msg.message || 'Esta sala requer senha de acesso.'}`, true);
        if (onAuthRequiredRef.current) {
          onAuthRequiredRef.current(msg.message || 'Senha necessária');
        }
        break;
      }
      case 'peer-joined': {
        const newPeerId = msg.peerId;
        logDiag(`Remote peer entered Node: ${newPeerId}. Initiating WebRTC uplink...`, 'INFO');
        updateRemotePeer(newPeerId);
        addChatMessage('SYSTEM', `Peer ${newPeerId} established uplink.`, true);

        drainPendingLocalCandidates(newPeerId);

        // Host / Existing occupant sends the offer to the newly arrived peer
        await sendOffer(newPeerId);
        break;
      }
      case 'offer': {
        if (!msg.from || !msg.sdp || typeof msg.sdp.sdp !== 'string' || !['offer', 'answer'].includes(msg.sdp.type)) {
          logDiag('Rejected malformed SDP Offer payload.', 'WARN');
          return;
        }
        updateRemotePeer(msg.from);
        const pc = ensurePeerConnection();
        try {
          // Polite peer rollback if an offer collision occurs
          if (pc.signalingState === 'have-local-offer') {
            await pc.setLocalDescription({ type: 'rollback' });
          }

          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          await drainPendingRemoteCandidates(pc);

          logDiag(`SDP Offer ingested from ${msg.from}. Creating Answer...`, 'SIGNAL');
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          if (sendSignalingRef.current) {
            sendSignalingRef.current({
              type: 'answer',
              target: msg.from,
              sdp: pc.localDescription
            });
          }
          drainPendingLocalCandidates(msg.from);
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
        if (msg.from) {
          updateRemotePeer(msg.from);
        }
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          await drainPendingRemoteCandidates(pcRef.current);
          drainPendingLocalCandidates(msg.from || remotePeerIdRef.current);
          logDiag('Remote SDP Answer synced.', 'SUCCESS');
        } catch (err) {
          logDiag(`SDP Answer handling failed: ${err.message}`, 'ERROR');
        }
        break;
      }
      case 'ice-candidate': {
        if (msg.candidate && (typeof msg.candidate.candidate === 'string' || msg.candidate.candidate === '')) {
          const candidate = new RTCIceCandidate(msg.candidate);
          if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
            try {
              await pcRef.current.addIceCandidate(candidate);
            } catch {
              // Ignore duplicate candidate
            }
          } else {
            pendingRemoteCandidatesRef.current.push(candidate);
          }
        }
        break;
      }
      case 'peer-disconnected': {
        logDiag(`Peer ${msg.peerId} disconnected.`, 'WARN');
        addChatMessage('SYSTEM', `Peer ${msg.peerId} severed link.`, true);
        if (remotePeerIdRef.current === msg.peerId) {
          remotePeerIdRef.current = null;
        }
        setRemotePeerId((current) => (current === msg.peerId ? null : current));
        setRemoteStream(null);
        stopTelemetry();
        break;
      }
      default:
        break;
    }
  }, [addChatMessage, drainPendingLocalCandidates, drainPendingRemoteCandidates, ensurePeerConnection, logDiag, sendOffer, stopTelemetry, updateRemotePeer]);

  // Dedicated WebSocket Transport Hook
  const {
    connectionState: signalingState,
    send: sendSignaling,
    connect: reconnectSignaling,
    disconnect: disconnectSignaling
  } = useSignaling({
    signalingUrl,
    roomId,
    operatorId,
    passwordHash,
    onMessage: useCallback((msg) => {
      handleSignalingMessage(msg);
    }, [handleSignalingMessage]),
    onLog: logDiag
  });

  sendSignalingRef.current = sendSignaling;

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
    const pc = ensurePeerConnection();
    const existingSenders = pc.getSenders();
    stream.getTracks().forEach((track) => {
      const alreadyAdded = existingSenders.some((s) => s.track && s.track.id === track.id);
      if (!alreadyAdded) {
        pc.addTrack(track, stream);
      }
    });
    logDiag('Local media tracks attached to RTCPeerConnection.', 'SUCCESS');
  }, [ensurePeerConnection, logDiag]);

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
  const connectionState = (signalingState === 'connected' && webrtcState === 'connected')
    ? 'connected'
    : (signalingState === 'connecting' || signalingState === 'reconnecting')
    ? 'connecting'
    : 'standby';

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
    reconnectSignaling,
    clearLogs,
    logDiag
  };
}
export default useWebRTC;
