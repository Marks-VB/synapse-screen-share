import { useState, useEffect, useRef, useMemo } from 'react';
import { useMediaStream } from './hooks/useMediaStream';
import { useWebRTC } from './hooks/useWebRTC';
import { Header } from './components/Header';
import { StageViewer } from './components/StageViewer';
import { QuantumDock } from './components/QuantumDock';
import { TerminalChat } from './components/TerminalChat';
import { ModalSettings } from './components/ModalSettings';
import { PasswordPromptModal } from './components/PasswordPromptModal';
import { Footer } from './components/Footer';
import { WelcomeModal } from './components/WelcomeModal';
import { LoadingScreen } from './components/LoadingScreen';
import {
  sanitizeIdentifier,
  generateSecureId,
  generateSecureRoomId,
  hashPassword,
  isValidSignalingUrl
} from './utils/security';

function getInitialRoom() {
  const params = new URLSearchParams(window.location.search);
  const r = params.get('room');
  if (r) {
    return sanitizeIdentifier(r, '');
  }
  return generateSecureRoomId('SYN');
}

function getInitialPassword() {
  if (window.location.hash) {
    const hash = window.location.hash.slice(1);
    const hashParams = new URLSearchParams(hash);
    const key = hashParams.get('key') || hashParams.get('pwd');
    if (key) return key;
  }
  const params = new URLSearchParams(window.location.search);
  return params.get('key') || params.get('pwd') || '';
}

function getInitialSignalingUrl() {
  const saved = localStorage.getItem('synapse_signaling_url');
  if (saved && isValidSignalingUrl(saved)) return saved;

  const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SIGNALING_URL;
  if (envUrl && isValidSignalingUrl(envUrl)) return envUrl.trim();

  const isHttps = window.location.protocol === 'https:';
  const port = window.location.port === '5173' ? '3000' : window.location.port;
  const host = window.location.hostname || 'localhost';
  return `${isHttps ? 'wss:' : 'ws:'}//${host}:${port || (isHttps ? '443' : '3000')}`;
}

function getInitialOperator() {
  const saved = localStorage.getItem('synapse_operator_id');
  if (saved) {
    const sanitized = sanitizeIdentifier(saved, '');
    if (sanitized) return sanitized;
  }
  const generated = generateSecureId('OPR');
  localStorage.setItem('synapse_operator_id', generated);
  return generated;
}

export function App() {
  const [roomId, setRoomId] = useState(getInitialRoom);
  const [roomPassword, setRoomPassword] = useState(getInitialPassword);
  const [passwordHash, setPasswordHash] = useState('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordModalMode, setPasswordModalMode] = useState('configure');
  const [passwordError, setPasswordError] = useState('');

  const [signalingUrl, setSignalingUrl] = useState(getInitialSignalingUrl);
  const [operatorId, setOperatorId] = useState(getInitialOperator);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(() => {
    const hasRoomParam = new URLSearchParams(window.location.search).has('room');
    if (hasRoomParam) return false;
    return !localStorage.getItem('synapse_onboarded');
  });
  const [isBooting, setIsBooting] = useState(true);

  // TURN / ICE Relay configuration & Auto-PiP preferences
  const [iceServerUrl, setIceServerUrl] = useState(() => localStorage.getItem('synapse_ice_server_url') || '');
  const [iceServerUsername, setIceServerUsername] = useState(() => localStorage.getItem('synapse_ice_server_user') || '');
  const [iceServerCredential, setIceServerCredential] = useState(() => localStorage.getItem('synapse_ice_server_cred') || '');
  const [autoPip, setAutoPip] = useState(() => localStorage.getItem('synapse_auto_pip') !== 'false');

  const logDiagRef = useRef(null);

  // Build ICE servers list including custom TURN relay if provided
  const iceServers = useMemo(() => {
    let servers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ];

    try {
      if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ICE_SERVERS) {
        const parsed = JSON.parse(import.meta.env.VITE_ICE_SERVERS);
        if (Array.isArray(parsed) && parsed.length > 0) servers = parsed;
      }
    } catch {
      // fallback to default servers
    }

    if (iceServerUrl.trim()) {
      const turnConfig = { urls: iceServerUrl.trim() };
      if (iceServerUsername.trim()) turnConfig.username = iceServerUsername.trim();
      if (iceServerCredential.trim()) turnConfig.credential = iceServerCredential.trim();
      servers.unshift(turnConfig);
    }

    return servers;
  }, [iceServerUrl, iceServerUsername, iceServerCredential]);

  // Compute password hash for room authentication
  useEffect(() => {
    let isMounted = true;
    if (roomPassword) {
      hashPassword(roomPassword, roomId).then((h) => {
        if (isMounted) setPasswordHash(h);
      });
    } else {
      setPasswordHash('');
    }
    return () => {
      isMounted = false;
    };
  }, [roomPassword, roomId]);

  // Update browser URL query and hash params when room or password changes
  useEffect(() => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const hashPart = roomPassword ? `#key=${encodeURIComponent(roomPassword)}` : '';
    const newUrl = `${origin}${pathname}?room=${encodeURIComponent(roomId)}${hashPart}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);
  }, [roomId, roomPassword]);

  // Media Stream Hook
  const {
    screenStream,
    micStream: _micStream,
    isScreenSharing,
    isMicMuted,
    isDeafened,
    activeQuality,
    startScreenShare,
    stopScreenShare,
    toggleMicrophone,
    toggleDeafen,
    setQualityPreset,
    applySenderBitrate,
    stopAllMedia
  } = useMediaStream({
    onScreenEnded: () => {
      // Graceful track cleanup without killing the entire peer connection
      removeLocalVideoTracks();
    },
    onLog: (msg, level) => {
      if (logDiagRef.current) logDiagRef.current(msg, level);
    }
  });

  // WebRTC Hook with Perfect Negotiation and ICE Restart
  const {
    pcRef,
    connectionState,
    signalingState,
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
    sendOffer: _sendOffer,
    closeConnection,
    clearLogs,
    logDiag
  } = useWebRTC({
    signalingUrl,
    roomId,
    operatorId,
    passwordHash,
    isScreenSharing,
    activeQuality,
    iceServers,
    onRemoteStreamReceived: () => {
      // Remote stream arrived
    },
    onAuthRequired: (message) => {
      setPasswordError(message || 'Esta sala requer uma senha de acesso.');
      setPasswordModalMode('prompt');
      setIsPasswordModalOpen(true);
    },
    onQualityChangeRequested: (preset) => {
      setQualityPreset(preset, pcRef.current);
    }
  });

  logDiagRef.current = logDiag;

  // Start / Stop Screen Share action with clean sender removal
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      removeLocalVideoTracks();
    } else {
      try {
        const stream = await startScreenShare();
        attachLocalStream(stream);
        await applySenderBitrate(pcRef.current, activeQuality);
      } catch (err) {
        console.error('Screen share initialization error:', err);
      }
    }
  };

  // Mic Toggle Action
  const handleToggleMic = async () => {
    try {
      await toggleMicrophone(pcRef.current);
    } catch (err) {
      console.error('Microphone toggle error:', err);
    }
  };

  // Terminate Link Action
  const handleTerminate = () => {
    stopAllMedia();
    closeConnection();
  };

  // Room Change Action
  const handleChangeRoom = (newRoom) => {
    const cleanRoom = sanitizeIdentifier(newRoom, roomId);
    if (cleanRoom && cleanRoom !== roomId) {
      handleTerminate();
      setRoomId(cleanRoom);
    }
  };

  // Settings Save Handler
  const handleSaveSettings = ({
    signalingUrl: newUrl,
    roomId: newRoom,
    operatorId: newOp,
    roomPassword: newPwd,
    iceServerUrl: newTurnUrl,
    iceServerUsername: newTurnUser,
    iceServerCredential: newTurnCred,
    autoPip: newAutoPip
  }) => {
    const cleanUrl = isValidSignalingUrl(newUrl) ? newUrl.trim() : signalingUrl;
    const cleanRoom = sanitizeIdentifier(newRoom, roomId);
    const cleanOp = sanitizeIdentifier(newOp, operatorId);

    setSignalingUrl(cleanUrl);
    setRoomId(cleanRoom);
    setOperatorId(cleanOp);
    setRoomPassword(typeof newPwd === 'string' ? newPwd.trim() : roomPassword);

    setIceServerUrl(newTurnUrl || '');
    setIceServerUsername(newTurnUser || '');
    setIceServerCredential(newTurnCred || '');
    setAutoPip(!!newAutoPip);

    localStorage.setItem('synapse_signaling_url', cleanUrl);
    localStorage.setItem('synapse_operator_id', cleanOp);
    localStorage.setItem('synapse_ice_server_url', newTurnUrl || '');
    localStorage.setItem('synapse_ice_server_user', newTurnUser || '');
    localStorage.setItem('synapse_ice_server_cred', newTurnCred || '');
    localStorage.setItem('synapse_auto_pip', newAutoPip ? 'true' : 'false');

    handleTerminate();
  };

  // Password Prompt / Configure Submit
  const handlePasswordSubmit = (submittedPwd) => {
    setRoomPassword(submittedPwd);
    setPasswordError('');
    setIsPasswordModalOpen(false);
    handleTerminate();
  };

  return (
    <div className="bg-cyber-void text-slate-200 h-screen w-screen flex flex-col font-mono select-none overflow-hidden antialiased">
      {/* Top Header & Status Ticker */}
      <Header
        roomId={roomId}
        onChangeRoom={handleChangeRoom}
        roomPassword={roomPassword}
        onOpenPasswordModal={() => {
          setPasswordError('');
          setPasswordModalMode('configure');
          setIsPasswordModalOpen(true);
        }}
        connectionState={connectionState}
        rttMs={metrics.rttMs}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHelp={() => setIsWelcomeOpen(true)}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 flex flex-col relative p-2.5 sm:p-3.5 min-w-0 bg-cyber-black">
          {/* Main Video Viewport & Telemetry HUD */}
          <StageViewer
            roomId={roomId}
            roomPassword={roomPassword}
            localStream={screenStream}
            remoteStream={remoteStream}
            isScreenSharing={isScreenSharing}
            metrics={metrics}
            isDeafened={isDeafened}
            connectionState={connectionState}
            signalingState={signalingState}
            remotePeerId={remotePeerId}
            roomPeers={roomPeers}
            autoPip={autoPip}
            onRequestKeyframe={requestKeyframe}
            onRequestViewerQuality={requestViewerQuality}
            onToggleScreenShare={handleToggleScreenShare}
          />

          {/* Floating Quantum Dock Controls */}
          <QuantumDock
            isScreenSharing={isScreenSharing}
            isMicMuted={isMicMuted}
            isDeafened={isDeafened}
            activeQuality={activeQuality}
            onToggleScreenShare={handleToggleScreenShare}
            onToggleMic={handleToggleMic}
            onToggleDeafen={toggleDeafen}
            onChangeQuality={(q) => setQualityPreset(q, pcRef.current)}
            onTerminate={handleTerminate}
          />
        </main>

        {/* Collapsible Dual-Mode Terminal & Diagnostics Sidebar */}
        <TerminalChat
          isOpen={isSidebarOpen}
          chatMessages={chatMessages}
          diagLogs={diagLogs}
          iceState={iceState}
          onSendMessage={sendMessage}
          onClearLogs={clearLogs}
          operatorId={operatorId}
        />
      </div>

      {/* Cyberpunk Status Footer */}
      <Footer />

      {/* Settings Modal */}
      <ModalSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        signalingUrl={signalingUrl}
        roomId={roomId}
        operatorId={operatorId}
        roomPassword={roomPassword}
        iceServerUrl={iceServerUrl}
        iceServerUsername={iceServerUsername}
        iceServerCredential={iceServerCredential}
        autoPip={autoPip}
        onSave={handleSaveSettings}
      />

      {/* Password Prompt & Configuration Modal */}
      <PasswordPromptModal
        isOpen={isPasswordModalOpen}
        mode={passwordModalMode}
        currentPassword={roomPassword}
        roomId={roomId}
        errorMessage={passwordError}
        onClose={() => setIsPasswordModalOpen(false)}
        onSubmit={handlePasswordSubmit}
      />

      {/* Welcome & Localhost Onboarding Modal */}
      <WelcomeModal
        isOpen={isWelcomeOpen}
        onClose={() => setIsWelcomeOpen(false)}
        currentOperator={operatorId}
        currentRoom={roomId}
        onSaveProfile={({ operatorId: newOp, roomId: newRoom }) => {
          setOperatorId(newOp);
          setRoomId(newRoom);
          localStorage.setItem('synapse_operator_id', newOp);
        }}
      />

      {/* Cyberpunk Boot Loading Screen */}
      {isBooting && <LoadingScreen onFinish={() => setIsBooting(false)} />}
    </div>
  );
}
export default App;
