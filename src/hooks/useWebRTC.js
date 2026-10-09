import { useState, useRef, useEffect, useCallback } from 'react';
import { useSignaling } from './useSignaling';
import { parseWebRTCStats } from '../utils/statsParser';

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' }
];

export function resolveIceServers(customConfig) {
  if (Array.isArray(customConfig) && customConfig.length > 0) {
    return customConfig;
  }
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ICE_SERVERS) {
      const parsed = JSON.parse(import.meta.env.VITE_ICE_SERVERS);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return DEFAULT_ICE_SERVERS;
}

/**
 * Custom hook dedicated strictly to WebRTC PeerConnection, SDP handshake, ICE candidates,
 * DataChannel and media track transceivers with full PERFECT NEGOTIATION and ICE restart.
 */
export function useWebRTC({
  signalingUrl,
  roomId,
  operatorId,
  passwordHash,
  isScreenSharing: _isScreenSharing,
  activeQuality: _activeQuality,
  iceServers,
  onRemoteStreamReceived,
  onAuthRequired,
  onQualityChangeRequested
}) {
  const onAuthRequiredRef = useRef(onAuthRequired);
  onAuthRequiredRef.current = onAuthRequired;

  const onQualityChangeRequestedRef = useRef(onQualityChangeRequested);
  onQualityChangeRequestedRef.current = onQualityChangeRequested;

  const [webrtcState, setWebrtcState] = useState('idle');
  const [iceState, setIceState] = useState('new');
  const [remoteStream, setRemoteStream] = useState(null);
  const [remotePeerId, setRemotePeerId] = useState(null);
  const [roomPeers, setRoomPeers] = useState([]);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'init-sys',
      sender: 'SYSTEM',
      text: 'Synapse DataChannel initialized. Secure peer messaging ready.',
      timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      isSystem: true,
      status: 'sent'
    }
  ]);
  const [diagLogs, setDiagLogs] = useState([
    {
      id: 'init-diag',
      timestamp: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      level: 'SYS_INIT',
      msg: 'Synapse WebRTC media core initialized with Perfect Negotiation.'
    }
  ]);
  const [metrics, setMetrics] = useState({
    resolution: '0x0',
    fps: 0,
    bitrateMbps: '0.00',
    rttMs: null,
    packetLossPct: 0
  });

  // Persistent WebRTC state and Perfect Negotiation references
  const pcRef = useRef(null);
  const dataChannelRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remotePeerIdRef = useRef(null);
  const pendingRemoteCandidatesRef = useRef([]);
  const pendingLocalCandidatesRef = useRef([]);
  const statsIntervalRef = useRef(null);
  const prevStatsStateRef = useRef({});
  const sendSignalingRef = useRef(null);

  // Perfect Negotiation flags
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const isSettingRemoteAnswerPendingRef = useRef(false);
  const iceDisconnectedTimeoutRef = useRef(null);

  const updateRemotePeer = useCallback((id) => {
    remotePeerIdRef.current = id;
    setRemotePeerId(id);
  }, []);

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

  const addChatMessage = useCallback((sender, text, isSystem = false, status = 'sent') => {
    const timeStr = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setChatMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        sender,
        text,
        timestamp: timeStr,
        isSystem,
        status
      }
    ]);
  }, []);

  // Telemetry HUD Polling with instant cleanup
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

  const startTelemetry = useCallback((pc) => {
    stopTelemetry();
    statsIntervalRef.current = setInterval(async () => {
      if (!pc || pc.signalingState === 'closed') {
        stopTelemetry();
        return;
      }
      try {
        const stats = await pc.getStats();
        const { metrics: newMetrics, nextState } = parseWebRTCStats(stats, prevStatsStateRef.current);
        prevStatsStateRef.current = nextState;
        setMetrics(newMetrics);
      } catch {
        // Peer connection closed or stats error
      }
    }, 1000);
  }, [stopTelemetry]);

  // Flush queued remote ICE candidates once remoteDescription is ingested
  const drainPendingRemoteCandidates = useCallback(async (pc) => {
    if (pc && pendingRemoteCandidatesRef.current.length > 0) {
      logDiag(`Flushing ${pendingRemoteCandidatesRef.current.length} queued remote ICE candidates...`, 'INFO');
      while (pendingRemoteCandidatesRef.current.length > 0) {
        const candidate = pendingRemoteCandidatesRef.current.shift();
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // Ignore duplicate / stale candidates
        }
      }
    }
  }, [logDiag]);

  // Flush queued local ICE candidates once target peer is resolved
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

  // DataChannel initialization
  const setupDataChannel = useCallback((channel) => {
    dataChannelRef.current = channel;
    channel.onopen = () => {
      logDiag('RTCDataChannel is OPEN. Terminal link online.', 'SUCCESS');
      addChatMessage('SYSTEM', 'DataChannel established. Direct P2P link active.', true, 'sent');
    };
    channel.onclose = () => {
      logDiag('RTCDataChannel closed.', 'WARN');
    };
    channel.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload && payload.type === 'control') {
          if (payload.action === 'request-keyframe') {
            logDiag('Received keyframe refresh request from viewer.', 'INFO');
            if (pcRef.current) {
              const videoSender = pcRef.current.getSenders().find((s) => s.track && s.track.kind === 'video');
              if (videoSender && typeof videoSender.generateKeyFrame === 'function') {
                videoSender.generateKeyFrame();
              }
            }
          } else if (payload.action === 'set-quality' && payload.quality) {
            logDiag(`Viewer requested quality preset change: ${payload.quality}`, 'INFO');
            if (onQualityChangeRequestedRef.current) {
              onQualityChangeRequestedRef.current(payload.quality);
            }
          }
          return;
        }

        if (payload && typeof payload.text === 'string') {
          const sender = typeof payload.sender === 'string' ? payload.sender.slice(0, 32) : 'REMOTE';
          const text = payload.text.slice(0, 1000);
          addChatMessage(sender, text, false, 'received');
        }
      } catch {
        if (typeof e.data === 'string') {
          addChatMessage('REMOTE', e.data.slice(0, 1000), false, 'received');
        }
      }
    };
  }, [addChatMessage, logDiag]);

  // ICE Restart trigger
  const restartIceConnection = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || pc.signalingState === 'closed') return;
    const target = remotePeerIdRef.current;
    if (!target) return;

    logDiag('Initiating ICE restart on link failure...', 'WARN');
    try {
      if (typeof pc.restartIce === 'function') {
        pc.restartIce();
      }
      makingOfferRef.current = true;
      const offer = await pc.createOffer({ iceRestart: true });
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
      logDiag(`ICE restart error: ${err.message}`, 'ERROR');
    } finally {
      makingOfferRef.current = false;
    }
  }, [drainPendingLocalCandidates, logDiag]);

  // Initialize or return PeerConnection with full Perfect Negotiation event bindings
  const ensurePeerConnection = useCallback(() => {
    if (pcRef.current && pcRef.current.signalingState !== 'closed') {
      return pcRef.current;
    }

    const resolvedIce = resolveIceServers(iceServers);
    logDiag(`Initializing RTCPeerConnection with ${resolvedIce.length} ICE server configurations...`, 'INFO');

    const pc = new RTCPeerConnection({
      iceServers: resolvedIce
    });

    // 1. Negotiation Needed (Perfect Negotiation Initiator)
    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current = true;
        logDiag('onnegotiationneeded: generating local offer...', 'SIGNAL');

        if (!dataChannelRef.current || dataChannelRef.current.readyState === 'closed') {
          const dc = pc.createDataChannel('synapse-terminal', { ordered: true });
          setupDataChannel(dc);
        }

        await pc.setLocalDescription();
        const target = remotePeerIdRef.current;
        if (target && sendSignalingRef.current) {
          sendSignalingRef.current({
            type: 'offer',
            target,
            sdp: pc.localDescription
          });
        }
        drainPendingLocalCandidates(target);
      } catch (err) {
        logDiag(`Negotiation needed error: ${err.message}`, 'ERROR');
      } finally {
        makingOfferRef.current = false;
      }
    };

    // 2. ICE Candidates Dispatch
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

    // 3. ICE Connection State Changes & Auto Restart
    pc.oniceconnectionstatechange = () => {
      setIceState(pc.iceConnectionState);
      logDiag(`ICE State -> ${pc.iceConnectionState}`, 'INFO');

      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        if (iceDisconnectedTimeoutRef.current) {
          clearTimeout(iceDisconnectedTimeoutRef.current);
          iceDisconnectedTimeoutRef.current = null;
        }
        startTelemetry(pc);
      } else if (pc.iceConnectionState === 'failed') {
        stopTelemetry();
        restartIceConnection();
      } else if (pc.iceConnectionState === 'disconnected') {
        stopTelemetry();
        if (iceDisconnectedTimeoutRef.current) clearTimeout(iceDisconnectedTimeoutRef.current);
        iceDisconnectedTimeoutRef.current = setTimeout(() => {
          if (pcRef.current && pcRef.current.iceConnectionState === 'disconnected') {
            logDiag('Prolonged disconnected state detected (3.5s). Triggering ICE restart...', 'WARN');
            restartIceConnection();
          }
        }, 3500);
      }
    };

    // 4. Connection State
    pc.onconnectionstatechange = () => {
      setWebrtcState(pc.connectionState);
      logDiag(`Connection State -> ${pc.connectionState}`, 'INFO');
      if (pc.connectionState === 'failed') {
        restartIceConnection();
      }
    };

    // 5. Incoming Remote Tracks
    pc.ontrack = (event) => {
      logDiag(`Remote media track arrived: ${event.track.kind}`, 'SUCCESS');
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        setRemoteStream(event.streams[0]);
        if (onRemoteStreamReceived) {
          onRemoteStreamReceived(event.streams[0]);
        }
      }

      event.track.onended = () => {
        logDiag(`Remote track ${event.track.kind} ended.`, 'INFO');
        if (event.track.kind === 'video') {
          setRemoteStream(null);
          remoteStreamRef.current = null;
        }
      };

      event.track.onmute = () => {
        logDiag(`Remote track ${event.track.kind} muted.`, 'INFO');
      };

      event.track.onunmute = () => {
        logDiag(`Remote track ${event.track.kind} unmuted.`, 'INFO');
      };
    };

    // 6. Incoming DataChannel
    pc.ondatachannel = (event) => {
      logDiag(`Remote DataChannel arrived: ${event.channel.label}`, 'INFO');
      setupDataChannel(event.channel);
    };

    pcRef.current = pc;
    return pc;
  }, [
    iceServers,
    logDiag,
    drainPendingLocalCandidates,
    onRemoteStreamReceived,
    restartIceConnection,
    setupDataChannel,
    startTelemetry,
    stopTelemetry
  ]);

  // Cleanly close WebRTC connection
  const closeConnection = useCallback(() => {
    logDiag('Severing WebRTC link and transceivers...', 'WARN');
    stopTelemetry();

    if (iceDisconnectedTimeoutRef.current) {
      clearTimeout(iceDisconnectedTimeoutRef.current);
      iceDisconnectedTimeoutRef.current = null;
    }

    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.close();
      } catch {
        // Safe ignore
      }
      dataChannelRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => {
        try {
          if (sender.track) sender.track.stop();
        } catch {
          // Safe ignore
        }
      });
      try {
        pcRef.current.close();
      } catch {
        // Safe ignore
      }
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
    addChatMessage('SYSTEM', 'Uplink terminated.', true, 'sent');
  }, [addChatMessage, logDiag, stopTelemetry]);

  // Gracefully remove video tracks without killing the entire peer connection
  const removeLocalVideoTracks = useCallback(() => {
    const pc = pcRef.current;
    if (!pc || pc.signalingState === 'closed') return;

    const senders = pc.getSenders();
    let removed = 0;
    senders.forEach((sender) => {
      if (sender.track && sender.track.kind === 'video') {
        try {
          sender.track.stop();
          pc.removeTrack(sender);
          removed++;
        } catch {
          // Safe ignore
        }
      }
    });

    if (removed > 0) {
      logDiag(`Removed ${removed} local video track senders. renegotiating...`, 'INFO');
    }
  }, [logDiag]);

  // Manual SDP Offer dispatch
  const sendOffer = useCallback(async (targetPeer, options = {}) => {
    const target = targetPeer || remotePeerIdRef.current;
    if (!target) {
      logDiag('Offer deferred: waiting for peer ID...', 'INFO');
      return;
    }

    const pc = ensurePeerConnection();
    try {
      makingOfferRef.current = true;
      logDiag(`Formulating SDP Offer for peer ${target}...`, 'SIGNAL');

      if (!dataChannelRef.current || dataChannelRef.current.readyState === 'closed') {
        const dc = pc.createDataChannel('synapse-terminal', { ordered: true });
        setupDataChannel(dc);
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: !!options.iceRestart
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
      logDiag(`SDP Offer failed: ${err.message}`, 'ERROR');
    } finally {
      makingOfferRef.current = false;
    }
  }, [drainPendingLocalCandidates, ensurePeerConnection, logDiag, setupDataChannel]);

  // Handle incoming signaling messages with Perfect Negotiation glare resolution
  const handleSignalingMessage = useCallback(async (msg) => {
    switch (msg.type) {
      case 'room-joined': {
        logDiag(`Node [${msg.roomId}] connected. Peers: ${msg.peers.length}${msg.isProtected ? ' [PROTEGIDO]' : ''}`, 'SUCCESS');
        setRoomPeers(msg.peers || []);
        if (msg.peers.length > 0) {
          const hostPeer = msg.peers[0];
          updateRemotePeer(hostPeer);
          ensurePeerConnection();
          drainPendingLocalCandidates(hostPeer);
        }
        break;
      }

      case 'auth-required':
      case 'auth-error': {
        logDiag(`[SECURITY] ${msg.message || 'Authentication required for this room.'}`, 'WARN');
        addChatMessage('SYSTEM', `RESTRICTED: ${msg.message || 'Room password required.'}`, true, 'sent');
        if (onAuthRequiredRef.current) {
          onAuthRequiredRef.current(msg.message || 'Senha necessária');
        }
        break;
      }

      case 'peer-joined': {
        const newPeerId = msg.peerId;
        logDiag(`Remote peer arrived: ${newPeerId}.`, 'INFO');
        setRoomPeers((prev) => [...new Set([...prev, newPeerId])]);
        updateRemotePeer(newPeerId);
        addChatMessage('SYSTEM', `Peer ${newPeerId} established uplink.`, true, 'sent');

        drainPendingLocalCandidates(newPeerId);
        ensurePeerConnection();
        break;
      }

      case 'offer': {
        if (!msg.from || !msg.sdp || typeof msg.sdp.sdp !== 'string' || !['offer', 'answer'].includes(msg.sdp.type)) {
          logDiag('Rejected malformed SDP Offer.', 'WARN');
          return;
        }

        updateRemotePeer(msg.from);
        const pc = ensurePeerConnection();

        // Perfect Negotiation: deterministic polite / impolite assignment
        const isOffer = msg.sdp.type === 'offer';
        const isPolite = operatorId.localeCompare(msg.from) < 0;
        const offerCollision = isOffer && (makingOfferRef.current || pc.signalingState !== 'stable');

        ignoreOfferRef.current = !isPolite && offerCollision;
        if (ignoreOfferRef.current) {
          logDiag(`Offer collision detected: impolite peer ignoring offer from ${msg.from}.`, 'WARN');
          return;
        }

        try {
          if (offerCollision && isPolite) {
            logDiag('Offer collision detected: polite peer rolling back local offer.', 'SIGNAL');
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
          logDiag('Rejected malformed SDP Answer.', 'WARN');
          return;
        }
        if (msg.from) {
          updateRemotePeer(msg.from);
        }
        try {
          isSettingRemoteAnswerPendingRef.current = true;
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          isSettingRemoteAnswerPendingRef.current = false;
          await drainPendingRemoteCandidates(pcRef.current);
          drainPendingLocalCandidates(msg.from || remotePeerIdRef.current);
          logDiag('Remote SDP Answer synced.', 'SUCCESS');
        } catch (err) {
          isSettingRemoteAnswerPendingRef.current = false;
          logDiag(`SDP Answer handling failed: ${err.message}`, 'ERROR');
        }
        break;
      }

      case 'ice-candidate': {
        if (msg.candidate && (typeof msg.candidate.candidate === 'string' || msg.candidate.candidate === '')) {
          try {
            const candidate = new RTCIceCandidate(msg.candidate);
            if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
              await pcRef.current.addIceCandidate(candidate);
            } else {
              pendingRemoteCandidatesRef.current.push(candidate);
            }
          } catch (err) {
            if (!ignoreOfferRef.current) {
              logDiag(`ICE Candidate error: ${err.message}`, 'WARN');
            }
          }
        }
        break;
      }

      case 'peer-disconnected': {
        logDiag(`Peer ${msg.peerId} severed link.`, 'WARN');
        addChatMessage('SYSTEM', `Peer ${msg.peerId} severed link.`, true, 'sent');
        setRoomPeers((prev) => prev.filter((p) => p !== msg.peerId));
        if (remotePeerIdRef.current === msg.peerId) {
          remotePeerIdRef.current = null;
          setRemotePeerId(null);
          setRemoteStream(null);
          stopTelemetry();
        }
        break;
      }

      default:
        break;
    }
  }, [
    addChatMessage,
    drainPendingLocalCandidates,
    drainPendingRemoteCandidates,
    ensurePeerConnection,
    logDiag,
    operatorId,
    stopTelemetry,
    updateRemotePeer
  ]);

  // Signaling WebSocket hook
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

  // Send message over DataChannel with delivery status tracking
  const sendMessage = useCallback((text) => {
    if (!text || typeof text !== 'string' || !text.trim()) return;
    const clampedText = text.trim().slice(0, 1000);
    const payload = {
      sender: operatorId,
      text: clampedText,
      timestamp: Date.now()
    };

    const isChannelOpen = dataChannelRef.current && dataChannelRef.current.readyState === 'open';
    if (isChannelOpen) {
      try {
        dataChannelRef.current.send(JSON.stringify(payload));
      } catch {
        // Failed send
      }
    } else {
      logDiag('DataChannel link offline; message flagged as undelivered.', 'WARN');
    }

    addChatMessage(operatorId, clampedText, false, isChannelOpen ? 'sent' : 'undelivered');
  }, [addChatMessage, logDiag, operatorId]);

  // Viewer requests keyframe via DataChannel
  const requestKeyframe = useCallback(() => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify({ type: 'control', action: 'request-keyframe' }));
      logDiag('Requested keyframe refresh from host.', 'INFO');
    }
  }, [logDiag]);

  // Viewer requests quality preset via DataChannel
  const requestViewerQuality = useCallback((qualityPreset) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify({ type: 'control', action: 'set-quality', quality: qualityPreset }));
      logDiag(`Requested stream quality preset: ${qualityPreset}`, 'INFO');
    }
  }, [logDiag]);

  // Attach local media stream tracks
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

  useEffect(() => {
    return () => {
      closeConnection();
    };
  }, [closeConnection]);

  const connectionState =
    signalingState === 'connected' && webrtcState === 'connected'
      ? 'connected'
      : signalingState === 'connecting' || signalingState === 'reconnecting'
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
    roomPeers,
    chatMessages,
    diagLogs,
    metrics,
    sendMessage,
    requestKeyframe,
    requestViewerQuality,
    attachLocalStream,
    removeLocalVideoTracks,
    sendOffer,
    restartIceConnection,
    closeConnection,
    disconnectSignaling,
    reconnectSignaling,
    clearLogs,
    logDiag
  };
}
export default useWebRTC;
