import React, { useRef, useState, useEffect } from 'react';
import { ScreenShare, Maximize, PictureInPicture, SlidersHorizontal, Activity, Link2, Check } from 'lucide-react';
import { copyToClipboard } from '../utils/security';
import { useI18n } from '../i18n/I18nContext';

export function StageViewer({
  roomId,
  roomPassword = '',
  localStream,
  remoteStream,
  isScreenSharing,
  metrics,
  isDeafened,
  connectionState,
  signalingState,
  remotePeerId,
  onToggleScreenShare
}) {
  const { t } = useI18n();
  const [copiedCenter, setCopiedCenter] = useState(false);
  const [showScanlines, setShowScanlines] = useState(false);
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

  const handleCopyFromCenter = async () => {
    if (!roomId) return;
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const hashPart = roomPassword ? `#key=${encodeURIComponent(roomPassword)}` : '';
    const url = `${origin}${pathname}?room=${encodeURIComponent(roomId)}${hashPart}`;
    const success = await copyToClipboard(url);
    if (success) {
      setCopiedCenter(true);
      setTimeout(() => setCopiedCenter(false), 2000);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full rounded-2xl bg-cyber-card border border-cyber-border overflow-hidden flex flex-col justify-between shadow-2xl group"
    >
      {/* 4 L-Shaped Neon Cyan HUD Brackets (Only visible when idle) */}
      {!activeStream && (
        <>
          <div className="hud-corner hud-corner-tl" />
          <div className="hud-corner hud-corner-tr" />
          <div className="hud-corner hud-corner-bl" />
          <div className="hud-corner hud-corner-br" />
        </>
      )}

      {/* Toggleable CRT Scanlines Overlay */}
      {showScanlines && (
        <div className="crt-scanlines opacity-40 transition-opacity duration-200 ease-out-quick pointer-events-none" />
      )}

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
                ? t('stage.receiving')
                : isTransmitting
                ? t('stage.transmitting')
                : t('stage.standby')}
            </span>
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-300">
            {t('stage.res')} <span className="text-cyber-cyan font-bold">{metrics.resolution}</span>
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-300">
            {t('stage.fps')} <span className="text-cyber-green font-bold">{metrics.fps}</span>
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-300">
            {t('stage.bitrate')}{' '}
            <span className="text-cyber-cyan-bright font-bold">
              {metrics.bitrateMbps} Mbps
            </span>
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-300">
            {t('stage.rtt')}{' '}
            <span className="text-cyber-purple-light font-bold">
              {metrics.rttMs !== null ? `${metrics.rttMs} ms` : '--'}
            </span>
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-300">
            {t('stage.loss')}{' '}
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
        <div className="flex items-center gap-1.5 pointer-events-auto" role="group" aria-label={t('stage.fullscreen')}>
          <button
            onClick={() => setShowScanlines((prev) => !prev)}
            aria-label={t('stage.scanlines')}
            aria-pressed={showScanlines}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono transition-transform transition-colors duration-150 ease-out-quick active:scale-[0.96] flex items-center gap-1.5 ${
              showScanlines
                ? 'bg-cyber-cyan/15 border-cyber-cyan/60 text-cyber-cyan-bright shadow-glow-cyan-sm'
                : 'bg-cyber-dark/80 border-cyber-border text-slate-300 hover:text-white hover:border-cyber-border-bright'
            }`}
            title={t('stage.scanlines')}
          >
            <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
            <span className="font-semibold uppercase tracking-wider">{t('stage.scanlines')}</span>
          </button>

          <button
            onClick={togglePiP}
            aria-label={t('stage.pip')}
            className="p-1.5 rounded-lg bg-cyber-dark/80 hover:bg-cyber-dark active:scale-[0.96] border border-cyber-border hover:border-cyber-cyan/50 text-slate-300 hover:text-cyber-cyan transition-transform transition-colors duration-150 ease-out-quick"
            title={t('stage.pip')}
          >
            <PictureInPicture className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            onClick={toggleFullscreen}
            aria-label={t('stage.fullscreen')}
            className="p-1.5 rounded-lg bg-cyber-dark/80 hover:bg-cyber-dark active:scale-[0.96] border border-cyber-border hover:border-cyber-cyan/50 text-slate-300 hover:text-cyber-cyan transition-transform transition-colors duration-150 ease-out-quick"
            title={t('stage.fullscreen')}
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

            {remotePeerId ? (
              <>
                <h2 className="text-base sm:text-lg font-headline font-bold uppercase tracking-wider text-cyber-cyan-bright">
                  {t('stage.peerConnectedTitle', { id: remotePeerId })}
                </h2>
                <p className="text-xs text-slate-300 max-w-sm mt-1.5 mb-4 leading-relaxed">
                  {t('stage.peerConnectedDesc')}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-cyber-green font-mono">
                  <span className="inline-block w-2 h-2 rounded-full bg-cyber-green animate-pulse shadow-glow-green" />
                  <span>{t('stage.peerConnectedBadge')}</span>
                </div>
              </>
            ) : signalingState === 'standby' ? (
              <>
                <h2 className="text-base sm:text-lg font-headline font-bold uppercase tracking-wider text-cyber-amber">
                  {t('stage.serverStandbyTitle')}
                </h2>
                <p className="text-xs text-slate-400 max-w-md mt-1.5 mb-4 leading-relaxed">
                  {t('stage.serverStandbyDesc')}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-cyber-amber font-mono">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyber-amber animate-pulse" />
                  <span>{t('stage.serverStandbyBadge')}</span>
                </div>
              </>
            ) : signalingState === 'connecting' || signalingState === 'reconnecting' ? (
              <>
                <h2 className="text-base sm:text-lg font-headline font-bold uppercase tracking-wider text-cyber-cyan">
                  {t('stage.connectingTitle')}
                </h2>
                <p className="text-xs text-slate-400 max-w-sm mt-1.5 mb-4 leading-relaxed">
                  {t('stage.connectingDesc')}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-cyber-cyan font-mono">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyber-cyan animate-pulse" />
                  <span>{t('stage.connectingBadge')}</span>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base sm:text-lg font-headline font-bold uppercase tracking-wider text-slate-100">
                  {t('stage.uplinkReadyTitle')}
                </h2>
                <p className="text-xs text-slate-400 max-w-sm mt-1.5 mb-4 leading-relaxed">
                  {t('stage.uplinkReadyDesc')}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mb-4">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" />
                  <span>{t('stage.uplinkReadyBadge')}</span>
                </div>

                {roomId && (
                  <button
                    type="button"
                    onClick={handleCopyFromCenter}
                    className="pointer-events-auto px-4 py-2 rounded-xl bg-cyber-card border border-cyber-cyan/50 hover:border-cyber-cyan text-cyber-cyan-bright font-mono text-xs font-bold transition-all duration-150 active:scale-95 flex items-center gap-2 shadow-glow-cyan-sm hover:shadow-glow-cyan"
                  >
                    {copiedCenter ? (
                      <>
                        <Check className="w-4 h-4 text-cyber-green" />
                        <span className="text-cyber-green uppercase tracking-wider">{t('stage.copiedSuccess')}</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4 text-cyber-cyan" />
                        <span className="uppercase tracking-wider">{t('stage.copyInviteBtn')}</span>
                      </>
                    )}
                  </button>
                )}
              </>
            )}
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
