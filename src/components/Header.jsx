import React, { useState, useEffect, useRef } from 'react';
import { Zap, Link2, Check, Settings, PanelRightClose, PanelRightOpen, Dices, ArrowRight, HelpCircle, Lock, Unlock, KeyRound, Copy } from 'lucide-react';
import { generateSecureRoomId, copyToClipboard } from '../utils/security';
import { useI18n } from '../i18n/I18nContext';

export function Header({
  roomId,
  onChangeRoom,
  roomPassword = '',
  onOpenPasswordModal,
  connectionState,
  rttMs,
  onOpenSettings,
  onOpenHelp,
  isSidebarOpen,
  onToggleSidebar
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [copiedType, setCopiedType] = useState('');
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [inputRoom, setInputRoom] = useState(roomId);
  const shareMenuRef = useRef(null);

  useEffect(() => {
    setInputRoom(roomId);
  }, [roomId]);

  // Close share menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target)) {
        setShowShareMenu(false);
      }
    }
    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showShareMenu]);

  const handleCopyCleanLink = async () => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const url = `${origin}${pathname}?room=${encodeURIComponent(roomId)}`;
    const success = await copyToClipboard(url);
    if (success) {
      setCopied(true);
      setCopiedType('clean');
      setShowShareMenu(false);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyDirectKeyLink = async () => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const url = `${origin}${pathname}?room=${encodeURIComponent(roomId)}#key=${encodeURIComponent(roomPassword)}`;
    const success = await copyToClipboard(url);
    if (success) {
      setCopied(true);
      setCopiedType('direct');
      setShowShareMenu(false);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareClick = () => {
    if (roomPassword) {
      setShowShareMenu((prev) => !prev);
    } else {
      handleCopyCleanLink();
    }
  };

  const handleApplyRoom = (e) => {
    e?.preventDefault();
    const cleanRoom = inputRoom.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 32);
    if (cleanRoom && cleanRoom !== roomId) {
      setInputRoom(cleanRoom);
      onChangeRoom(cleanRoom);
    }
  };

  const handleRandomRoom = () => {
    const newRoom = generateSecureRoomId('SYN');
    setInputRoom(newRoom);
    onChangeRoom(newRoom);
  };

  const isConnected = connectionState === 'connected';
  const isReconnecting = connectionState === 'reconnecting' || connectionState === 'connecting';

  let statusLabel = t('header.statusStandby');
  let statusColor = 'text-cyber-amber';
  let dotColor = 'bg-cyber-amber shadow-glow-amber';

  if (isConnected) {
    statusLabel = t('header.statusActive');
    statusColor = 'text-cyber-green';
    dotColor = 'bg-cyber-green animate-glow-pulse-green';
  } else if (isReconnecting) {
    statusLabel = t('header.statusConnecting');
    statusColor = 'text-cyber-cyan';
    dotColor = 'bg-cyber-cyan animate-pulse';
  }

  return (
    <header className="h-14 bg-cyber-dark/95 border-b border-cyber-border px-4 flex items-center justify-between shrink-0 z-40 backdrop-blur-md">
      {/* Brand & System Status Ticker */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded border border-cyber-cyan/50 flex items-center justify-center bg-cyan-950/40 text-cyber-cyan font-bold shadow-glow-cyan-sm">
            <Zap className="w-4 h-4 fill-cyber-cyan text-cyber-cyan" />
          </div>
          <div className="flex flex-col">
            <span className="font-headline font-bold text-sm tracking-wider text-cyber-cyan-bright leading-none uppercase">
              SYNAPSE // PROTOCOL
            </span>
            <span className="text-[10px] text-slate-400 font-mono tracking-widest mt-0.5">
              {t('header.brandSub')}
            </span>
          </div>
        </div>

        {/* Ticker / Telemetry Bar */}
        <div className="hidden lg:flex items-center text-xs text-slate-400 font-mono pl-4 border-l border-cyber-border">
          <span className="text-slate-600 mr-2">────</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full transition-all duration-300 ease-out-quick ${dotColor}`} />
            <span className={`font-bold tracking-wider transition-colors duration-200 ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <span className="text-slate-600 mx-2">────</span>
          <span className="text-slate-400 font-mono">
            [NET: <span className="text-cyber-cyan font-bold">{rttMs !== null ? `${rttMs}ms` : '--'}</span>]
          </span>
          <span className="text-slate-600 mx-2">────</span>
          <span className="text-slate-400 font-mono">
            [ENC: <span className="text-cyber-purple-light font-bold">{t('header.encryption')}</span>]
          </span>
        </div>
      </div>

      {/* Action Controls & Room Switcher */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Interactive Room Selector Form */}
        <form onSubmit={handleApplyRoom} className="flex items-center bg-cyber-card border border-cyber-border focus-within:border-cyber-cyan/60 rounded px-2 py-1 text-xs transition-colors">
          <span className="text-slate-400 mr-1.5 uppercase text-[10px] tracking-wider font-semibold">
            {t('header.nodeLabel')}
          </span>
          <input
            type="text"
            value={inputRoom}
            onChange={(e) => setInputRoom(e.target.value.toUpperCase())}
            placeholder={t('header.roomPlaceholder')}
            className="bg-transparent text-cyber-cyan font-bold font-mono text-xs uppercase tracking-wider outline-none w-28 sm:w-32 placeholder:text-slate-600"
            title={t('header.enterRoom')}
          />
          {inputRoom !== roomId && (
            <button
              type="submit"
              className="p-1 rounded bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan transition-colors ml-0.5"
              title={t('header.enterRoom')}
            >
              <ArrowRight className="w-3 h-3" />
            </button>
          )}

          {/* Random Unique Room Button */}
          <button
            type="button"
            onClick={handleRandomRoom}
            className="p-1 rounded text-slate-400 hover:text-cyber-cyan hover:bg-slate-800 transition-colors ml-0.5"
            title={t('header.randomRoom')}
          >
            <Dices className="w-3.5 h-3.5" />
          </button>

          {/* Room Password Lock Button */}
          <button
            type="button"
            onClick={onOpenPasswordModal}
            className={`p-1 rounded transition-colors ml-0.5 ${
              roomPassword
                ? 'text-cyber-green bg-emerald-950/40 border border-cyber-green/40 hover:bg-emerald-900/60 shadow-glow-green-sm'
                : 'text-slate-400 hover:text-cyber-cyan hover:bg-slate-800'
            }`}
            title={roomPassword ? t('header.lockedRoom') : t('header.openRoom')}
          >
            {roomPassword ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Unlock className="w-3.5 h-3.5" />
            )}
          </button>
        </form>

        {/* Copy Shareable Link Dropdown / Button */}
        <div className="relative" ref={shareMenuRef}>
          <button
            onClick={handleShareClick}
            aria-label={copied ? t('header.linkCopied') : t('header.shareLink')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded text-xs transition-transform transition-colors duration-150 ease-out-quick shadow-glow-cyan-sm active:scale-[0.97] border ${
              roomPassword
                ? 'bg-emerald-950/30 border-cyber-green/40 text-cyber-green hover:bg-emerald-900/40'
                : 'bg-cyber-cyan/10 hover:bg-cyber-cyan/20 border-cyber-cyan/40 text-cyber-cyan-bright'
            }`}
            title={roomPassword ? t('header.protectedRoomTitle') : t('header.shareLink')}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-cyber-green" aria-hidden="true" />
                <span className="font-semibold uppercase tracking-wider text-[11px] text-cyber-green hidden sm:inline">
                  {copiedType === 'direct' ? t('header.directLinkCopied') : t('header.linkCopied')}
                </span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="font-semibold uppercase tracking-wider text-[11px] hidden sm:inline">
                  {t('header.shareLink')}
                </span>
                {roomPassword && <Lock className="w-3 h-3 ml-0.5 text-cyber-green" />}
              </>
            )}
          </button>

          {/* Password Sharing Popover Menu */}
          {showShareMenu && roomPassword && (
            <div className="absolute right-0 mt-2 w-64 bg-cyber-dark border border-cyber-green/40 rounded-xl shadow-glow-green-lg p-2.5 z-50 animate-modal-enter space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-cyber-border/60 pb-1.5 px-1">
                <span className="text-[10px] uppercase font-bold text-cyber-green flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>{t('header.protectedRoomTitle')}</span>
                </span>
                <span className="text-[10px] text-slate-400">{t('header.linkOptions')}</span>
              </div>

              <button
                type="button"
                onClick={handleCopyDirectKeyLink}
                className="w-full text-left p-2 rounded-lg bg-cyber-black hover:bg-emerald-950/40 border border-cyber-border hover:border-cyber-green/50 transition-colors flex items-start gap-2"
              >
                <KeyRound className="w-4 h-4 text-cyber-green shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] font-bold text-slate-100">{t('header.directLinkTitle')}</div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    {t('header.directLinkDesc')}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleCopyCleanLink}
                className="w-full text-left p-2 rounded-lg bg-cyber-black hover:bg-slate-800 border border-cyber-border hover:border-slate-500 transition-colors flex items-start gap-2"
              >
                <Lock className="w-4 h-4 text-cyber-cyan shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] font-bold text-slate-100">{t('header.cleanLinkTitle')}</div>
                  <div className="text-[10px] text-slate-400 leading-tight">
                    {t('header.cleanLinkDesc')}
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Help & Privacy Modal Button */}
        <button
          onClick={onOpenHelp}
          aria-label={t('header.helpTooltip')}
          className="p-1.5 rounded bg-cyber-card hover:bg-cyber-card-hover active:scale-[0.96] border border-cyber-border text-slate-300 hover:text-cyber-cyan hover:border-cyber-cyan/40 transition-transform transition-colors duration-150 ease-out-quick"
          title={t('header.helpTooltip')}
        >
          <HelpCircle className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          aria-label={t('header.settingsTooltip')}
          className="p-1.5 rounded bg-cyber-card hover:bg-cyber-card-hover active:scale-[0.96] border border-cyber-border text-slate-300 hover:text-cyber-cyan hover:border-cyber-cyan/40 transition-transform transition-colors duration-150 ease-out-quick"
          title={t('header.settingsTooltip')}
        >
          <Settings className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Toggle Sidebar */}
        <button
          onClick={onToggleSidebar}
          aria-label={t('header.terminalTooltip')}
          aria-expanded={isSidebarOpen}
          className="p-1.5 rounded bg-cyber-card hover:bg-cyber-card-hover active:scale-[0.96] border border-cyber-border text-slate-300 hover:text-cyber-cyan hover:border-cyber-cyan/40 transition-transform transition-colors duration-150 ease-out-quick"
          title={t('header.terminalTooltip')}
        >
          {isSidebarOpen ? (
            <PanelRightClose className="w-4 h-4" aria-hidden="true" />
          ) : (
            <PanelRightOpen className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  );
}
