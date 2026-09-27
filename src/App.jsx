import React, { useState, useEffect, useCallback } from 'react';
import { useMediaStream } from './hooks/useMediaStream';
import { useWebRTC } from './hooks/useWebRTC';
import { Header } from './components/Header';
import { StageViewer } from './components/StageViewer';
import { QuantumDock } from './components/QuantumDock';
import { TerminalChat } from './components/TerminalChat';
import { ModalSettings } from './components/ModalSettings';

function getInitialRoom() {
  const params = new URLSearchParams(window.location.search);
  const r = params.get('room');
  return r ? r.toUpperCase().trim() : 'NODE_ALPHA';
}

function getInitialSignalingUrl() {
  const saved = localStorage.getItem('synapse_signaling_url');
  if (saved) return saved;

  const isHttps = window.location.protocol === 'https:';
  const port = window.location.port === '5173' ? '3000' : window.location.port;
  const host = window.location.hostname || 'localhost';
  return `${isHttps ? 'wss:' : 'ws:'}//${host}:${port || (isHttps ? '443' : '3000')}`;
}

function getInitialOperator() {
  const saved = localStorage.getItem('synapse_operator_id');
  if (saved) return saved;
  const generated = 'OPR_' + Math.random().toString(36).substring(2, 6).toUpperCase();
  localStorage.setItem('synapse_operator_id', generated);
  return generated;
}

export function App() {
  const [roomId, setRoomId] = useState(getInitialRoom);
  const [signalingUrl, setSignalingUrl] = useState(getInitialSignalingUrl);
  const [operatorId, setOperatorId] = useState(getInitialOperator);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Update browser URL query param when room changes
  useEffect(() => {
    const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);
  }, [roomId]);

  // Media Stream Hook
  const {
    screenStream,
    micStream,
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
      // When screen sharing stops from OS browser prompt
    },
    onLog: (msg, level) => {
      logDiag(msg, level);
    }
  });

  // WebRTC Hook
  const {
    pcRef,
    connectionState,
    iceState,
    remoteStream,
    chatMessages,
    diagLogs,
    metrics,
    sendMessage,
    attachLocalStream,
    sendOffer,
    closeConnection,
    clearLogs,
    logDiag
  } = useWebRTC({
    signalingUrl,
    roomId,
    operatorId,
    isScreenSharing,
    activeQuality,
    onRemoteStreamReceived: () => {
      // Remote stream arrived
    }
  });

  // Start / Stop Screen Share action
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      // Remove video track senders from peer connection
      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        senders.forEach((s) => {
          if (s.track && s.track.kind === 'video') {
            pcRef.current.removeTrack(s);
          }
        });
      }
    } else {
      try {
        const stream = await startScreenShare();
        attachLocalStream(stream);
        await applySenderBitrate(pcRef.current, activeQuality);
        await sendOffer();
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

  // Settings Save
  const handleSaveSettings = ({ signalingUrl: newUrl, roomId: newRoom, operatorId: newOp }) => {
    setSignalingUrl(newUrl);
    setRoomId(newRoom);
    setOperatorId(newOp);
    localStorage.setItem('synapse_signaling_url', newUrl);
    localStorage.setItem('synapse_operator_id', newOp);
    handleTerminate();
  };

  return (
    <div className="bg-cyber-void text-slate-200 h-screen w-screen flex flex-col font-mono select-none overflow-hidden antialiased">
      {/* Top Header & Status Ticker */}
      <Header
        roomId={roomId}
        connectionState={connectionState}
        rttMs={metrics.rttMs}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 flex flex-col relative p-2.5 sm:p-3.5 min-w-0 bg-cyber-black">
          {/* Main Video Viewport & Telemetry HUD */}
          <StageViewer
            localStream={screenStream}
            remoteStream={remoteStream}
            isScreenSharing={isScreenSharing}
            metrics={metrics}
            isDeafened={isDeafened}
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

      {/* Settings Modal */}
      <ModalSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        signalingUrl={signalingUrl}
        roomId={roomId}
        operatorId={operatorId}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
export default App;
