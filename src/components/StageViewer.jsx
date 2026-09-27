import React, { useRef, useState, useEffect } from 'react';
import { ScreenShare, Maximize, PictureInPicture, SlidersHorizontal, Activity } from 'lucide-react';

export function StageViewer({
  localStream,
  remoteStream,
  isScreenSharing,
  metrics,
  isDeafened
}) {
  const [showScanlines, setShowScanlines] = useState(true);
  const containerRef = useRef(null);
  const videoRef = useRef(null);

  // Active stream: remote takes precedence over local preview
  const activeStream = remoteStream || localStream;
  const isTransmitting = isScreenSharing && !remoteStream;
  const isReceiving = !!remoteStream;

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = activeStream || null;
      if (activeStream) {
        videoRef.current.play().catch(() => {
          // Handled via user interaction
        });
      }
    }
  }, [activeStream]);

  // Handle Picture-in-Picture
  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current && activeStream) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('PiP error:', e);
    }
  };

  // Handle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.warn('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full rounded-2xl bg-cyber-card border border-cyber-border overflow-hidden flex flex-col justify-between shadow-2xl group"
    >
      {/* 4 L-Shaped Neon Cyan HUD Brackets */}
      <div className="hud-corner hud-corner-tl" />
      <div className="hud-corner hud-corner-tr" />
      <div className="hud-corner hud-corner-bl" />
      <div className="hud-corner hud-corner-br" />

      {/* Toggleable CRT Scanlines Overlay */}
      <div
        className={`crt-scanlines transition-opacity duration-200 ease-out-quick ${
          showScanlines ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Top Telemetry HUD Overlay */}
      <div className="relative z-30 p-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none select-none">
        {/* Real-Time Metrics Pill */}
        <div className="px-3 py-1.5 rounded-xl bg-cyber-dark/85 border border-cyber-cyan/30 backdrop-blur-md shadow-glow-cyan-sm flex items-center gap-3 text-xs font-mono transition-colors duration-200">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                activeStream ? 'bg-cyber-cyan shadow-glow-cyan-sm animate-pulse' : 'bg-slate-600'
              }`}
            />
            <span className="text-cyber-cyan font-bold tracking-wider">
              {isReceiving
                ? 'RECEIVING STREAM'
                : isTransmitting
                ? 'TRANSMITTING LOCAL'
                : 'STANDBY'}
            </span>
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-300">
            RES: <span className="text-cyber-cyan font-bold">{metrics.resolution}</span>
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-300">
            FPS: <span className="text-cyber-green font-bold">{metrics.fps}</span>
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-300">
            BITRATE:{' '}
            <span className="text-cyber-cyan-bright font-bold">
              {metrics.bitrateMbps} Mbps
            </span>
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-300">
            RTT:{' '}
            <span className="text-cyber-purple-light font-bold">
              {metrics.rttMs !== null ? `${metrics.rttMs} ms` : '--'}
            </span>
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-300">
            LOSS:{' '}
            <span
              className={`font-bold transition-colors duration-150 ${
                metrics.packetLossPct > 2 ? 'text-cyber-amber shadow-glow-amber' : 'text-slate-300'
              }`}
            >
              {metrics.packetLossPct}%
            </span>
          </span>
        </div>

        {/* Viewport Action Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto" role="group" aria-label="Controles do visualizador de vídeo">
          <button
            onClick={() => setShowScanlines((prev) => !prev)}
            aria-label={showScanlines ? 'Desativar efeito visual de scanlines CRT' : 'Ativar efeito visual de scanlines CRT'}
            aria-pressed={showScanlines}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono transition-transform transition-colors duration-150 ease-out-quick active:scale-[0.96] flex items-center gap-1.5 ${
              showScanlines
                ? 'bg-cyber-cyan/15 border-cyber-cyan/60 text-cyber-cyan-bright shadow-glow-cyan-sm'
                : 'bg-cyber-dark/80 border-cyber-border text-slate-300 hover:text-white hover:border-cyber-border-bright'
            }`}
            title="Toggle Scanline Simulation"
          >
            <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
            <span className="font-semibold uppercase tracking-wider">SCANLINES</span>
          </button>

          <button
            onClick={togglePiP}
            aria-label="Alternar modo Picture-in-Picture (janela flutuante)"
            className="p-1.5 rounded-lg bg-cyber-dark/80 hover:bg-cyber-dark active:scale-[0.96] border border-cyber-border hover:border-cyber-cyan/50 text-slate-300 hover:text-cyber-cyan transition-transform transition-colors duration-150 ease-out-quick"
            title="Picture-in-Picture"
          >
            <PictureInPicture className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            onClick={toggleFullscreen}
            aria-label="Alternar tela cheia"
            className="p-1.5 rounded-lg bg-cyber-dark/80 hover:bg-cyber-dark active:scale-[0.96] border border-cyber-border hover:border-cyber-cyan/50 text-slate-300 hover:text-cyber-cyan transition-transform transition-colors duration-150 ease-out-quick"
            title="Fullscreen"
          >
            <Maximize className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main Video Stage / Idle Hologram */}
      <div className="relative z-10 flex-1 w-full h-full flex items-center justify-center overflow-hidden">
        {!activeStream ? (
          <div className="flex flex-col items-center justify-center p-6 text-center select-none animate-stream-arrival">
            {/* Spinning Holographic Reticle */}
            <div className="relative w-36 h-36 flex items-center justify-center mb-4">
              <div className="absolute inset-0 rounded-full border border-dashed border-cyber-cyan/40 animate-[spin_20s_linear_infinite]" />
              <div className="absolute inset-2 rounded-full border border-cyber-purple/30 animate-[spin_12s_linear_infinite_reverse]" />
              <div className="w-20 h-20 rounded-2xl bg-cyan-950/30 border border-cyber-cyan/50 flex items-center justify-center shadow-glow-cyan">
                <ScreenShare className="w-10 h-10 text-cyber-cyan" />
              </div>
            </div>

            <h2 className="text-base sm:text-lg font-headline font-bold uppercase tracking-wider text-slate-100">
              SYNAPSE UPLINK READY
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mt-1.5 mb-4 leading-relaxed">
              Click <span className="text-cyber-cyan-bright font-bold">INITIALIZE SYNAPSE LINK</span> below
              to transmit your screen at up to 1080p 60FPS with system audio.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" />
              <span>PEER_AWAITING_SIGNAL // WebRTC MESH READY</span>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isTransmitting || isDeafened}
            className="w-full h-full object-contain z-10 animate-stream-arrival"
          />
        )}
      </div>
    </div>
  );
}
