import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, ScreenShare, Power } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

export function QuantumDock({
  isScreenSharing,
  isMicMuted,
  isDeafened,
  activeQuality,
  onToggleScreenShare,
  onToggleMic,
  onToggleDeafen,
  onChangeQuality,
  onTerminate
}) {
  const { t } = useI18n();

  return (
    <div className="relative z-30 p-3 flex justify-center pointer-events-none">
      <div
        role="toolbar"
        aria-label="Controles de transmissão e áudio"
        className="quantum-dock rounded-2xl px-4 py-2.5 flex items-center gap-2.5 sm:gap-3 pointer-events-auto shadow-quantum"
      >
        {/* Hidden Live Region for Screen Readers */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {isScreenSharing ? 'Transmissão de tela ativa' : 'Transmissão de tela pausada ou inativa'}.
          {isMicMuted ? ' Microfone mudo.' : ' Microfone ligado.'}
          {isDeafened ? ' Áudio ensurdecido.' : ' Áudio ativo.'}
        </div>

        {/* Mic Toggle Button */}
        <button
          onClick={onToggleMic}
          aria-label={!isMicMuted ? t('dock.micAriaMute') : t('dock.micAriaUnmute')}
          aria-pressed={!isMicMuted}
          className={`group flex items-center gap-1.5 px-3 py-2 rounded-xl border font-mono text-xs transition-all duration-150 ease-out-quick active:scale-[0.97] select-none ${
            !isMicMuted
              ? 'bg-cyan-950/40 border-cyber-cyan/60 text-cyber-cyan-bright shadow-glow-cyan-sm hover:shadow-glow-cyan hover:border-cyber-cyan'
              : 'bg-cyber-card/90 border-cyber-amber/40 text-cyber-amber hover:bg-cyber-card-hover hover:border-cyber-amber/70 hover:shadow-glow-amber'
          }`}
          title={!isMicMuted ? t('dock.micAriaMute') : t('dock.micAriaUnmute')}
        >
          {!isMicMuted ? (
            <Mic className="w-4 h-4 transition-transform duration-150 group-hover:scale-110" aria-hidden="true" />
          ) : (
            <MicOff className="w-4 h-4 transition-transform duration-150 group-hover:scale-110" aria-hidden="true" />
          )}
          <span className="font-bold text-[11px] tracking-wider">
            {!isMicMuted ? t('dock.micLive') : t('dock.micMuted')}
          </span>
        </button>

        {/* Deafen Audio Toggle */}
        <button
          onClick={onToggleDeafen}
          aria-label={isDeafened ? t('dock.audioAriaUndeafen') : t('dock.audioAriaDeafen')}
          aria-pressed={isDeafened}
          className={`group flex items-center gap-1.5 px-3 py-2 rounded-xl border font-mono text-xs transition-all duration-150 ease-out-quick active:scale-[0.97] select-none ${
            isDeafened
              ? 'bg-red-950/40 border-cyber-red/60 text-cyber-red shadow-glow-red hover:shadow-glow-red hover:border-cyber-red'
              : 'bg-cyber-card/90 border-cyber-border text-slate-300 hover:text-cyber-cyan hover:border-cyber-cyan/50 hover:bg-cyber-card-hover hover:shadow-glow-cyan-sm'
          }`}
          title={isDeafened ? t('dock.audioAriaUndeafen') : t('dock.audioAriaDeafen')}
        >
          {isDeafened ? (
            <VolumeX className="w-4 h-4 transition-transform duration-150 group-hover:scale-110" aria-hidden="true" />
          ) : (
            <Volume2 className="w-4 h-4 transition-transform duration-150 group-hover:scale-110" aria-hidden="true" />
          )}
          <span className="font-bold text-[11px] tracking-wider">
            {isDeafened ? t('dock.deafened') : t('dock.audioOn')}
          </span>
        </button>

        {/* Separator */}
        <div className="h-6 w-[1px] bg-cyber-border mx-0.5" role="separator" aria-orientation="vertical" />

        {/* Start / Stop Screen Share Button (INITIALIZE SYNAPSE LINK) */}
        <button
          onClick={onToggleScreenShare}
          aria-label={isScreenSharing ? t('dock.stopLink') : t('dock.initLink')}
          aria-pressed={isScreenSharing}
          className={`group flex items-center gap-2 px-5 py-2.5 rounded-xl font-headline font-bold text-xs uppercase tracking-wider transition-all duration-150 ease-out-quick active:scale-[0.97] select-none ${
            isScreenSharing
              ? 'bg-cyber-red hover:bg-cyber-red-bright text-white shadow-glow-red hover:shadow-[0_0_28px_rgba(239,68,68,0.6)]'
              : 'bg-cyber-cyan hover:bg-cyber-cyan-bright text-cyber-black shadow-glow-cyan-lg hover:shadow-[0_0_36px_rgba(6,182,212,0.7)]'
          }`}
        >
          <ScreenShare className="w-4 h-4 transition-transform duration-150 group-hover:scale-110 group-active:scale-95" aria-hidden="true" />
          <span>{isScreenSharing ? t('dock.stopLink') : t('dock.initLink')}</span>
        </button>

        {/* Preset Quality Switcher */}
        <div className="relative">
          <label htmlFor="quality-preset-select" className="sr-only">
            Qualidade da transmissão de vídeo
          </label>
          <select
            id="quality-preset-select"
            value={activeQuality}
            onChange={(e) => onChangeQuality(e.target.value)}
            aria-label="Preset de qualidade e taxa de bits"
            className="bg-cyber-card/95 border border-cyber-cyan/30 text-cyber-cyan text-[11px] font-mono rounded-xl px-2.5 py-2 outline-none cursor-pointer hover:border-cyber-cyan hover:shadow-glow-cyan-sm transition-all duration-150 ease-out-quick focus:border-cyber-cyan focus:shadow-glow-cyan-sm"
          >
            <option value="1080p60">{t('dock.preset1080p')}</option>
            <option value="720p30">{t('dock.preset720p')}</option>
            <option value="source">{t('dock.presetSource')}</option>
          </select>
        </div>

        {/* Separator */}
        <div className="h-6 w-[1px] bg-cyber-border mx-0.5" role="separator" aria-orientation="vertical" />

        {/* Terminate Link Button */}
        <button
          onClick={onTerminate}
          aria-label={t('dock.terminate')}
          className="group flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/30 border border-cyber-red/40 text-cyber-red hover:bg-cyber-red/20 hover:text-white hover:border-cyber-red hover:shadow-glow-red transition-all duration-150 ease-out-quick active:scale-[0.97] select-none"
          title={t('dock.terminate')}
        >
          <Power className="w-4 h-4 transition-transform duration-150 group-hover:scale-110" aria-hidden="true" />
          <span className="font-bold text-[11px] tracking-wider">{t('dock.terminate')}</span>
        </button>
      </div>
    </div>
  );
}
