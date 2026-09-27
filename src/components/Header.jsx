import React, { useState } from 'react';
import { Zap, Link2, Check, Settings, PanelRightClose, PanelRightOpen } from 'lucide-react';

export function Header({
  roomId,
  connectionState,
  rttMs,
  onOpenSettings,
  isSidebarOpen,
  onToggleSidebar
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isConnected = connectionState === 'connected';

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
              V1.0.4 CLOUDFLARE
            </span>
          </div>
        </div>

        {/* Ticker / Telemetry Bar */}
        <div className="hidden md:flex items-center text-xs text-slate-400 font-mono pl-4 border-l border-cyber-border">
          <span className="text-slate-600 mr-2">────</span>
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full transition-all duration-300 ease-out-quick ${
                isConnected
                  ? 'bg-cyber-green animate-glow-pulse-green'
                  : 'bg-cyber-amber shadow-glow-amber'
              }`}
            />
            <span className={`font-bold tracking-wider transition-colors duration-200 ${isConnected ? 'text-cyber-green' : 'text-cyber-amber'}`}>
              {isConnected ? 'LINK_ACTIVE' : 'STANDBY'}
            </span>
          </span>
          <span className="text-slate-600 mx-2">────</span>
          <span className="text-slate-400 font-mono">
            [NET: <span className="text-cyber-cyan font-bold">{rttMs !== null ? `${rttMs}ms` : '--'}</span>]
          </span>
          <span className="text-slate-600 mx-2">────</span>
          <span className="text-slate-400 font-mono">
            [ENC: <span className="text-cyber-purple-light font-bold">AES-GCM-256</span>]
          </span>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2.5">
        {/* Node Badge */}
        <div className="flex items-center bg-cyber-card border border-cyber-border rounded px-2.5 py-1 text-xs">
          <span className="text-slate-400 mr-1.5 uppercase text-[10px] tracking-wider">NODE:</span>
          <span className="text-cyber-cyan font-bold font-mono text-xs uppercase tracking-wider">
            {roomId}
          </span>
        </div>

        {/* Copy Shareable Link */}
        <button
          onClick={handleCopyLink}
          aria-label={copied ? 'Link de compartilhamento copiado para a área de transferência' : 'Copiar link de compartilhamento da sala'}
          className="flex items-center gap-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 active:scale-[0.97] border border-cyber-cyan/40 text-cyber-cyan-bright px-3 py-1.5 rounded text-xs transition-transform transition-colors duration-150 ease-out-quick shadow-glow-cyan-sm"
          title="Copy Synapse Share Link"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-cyber-green" aria-hidden="true" />
              <span className="font-semibold uppercase tracking-wider text-[11px] text-cyber-green">
                LINK COPIED!
              </span>
            </>
          ) : (
            <>
              <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-semibold uppercase tracking-wider text-[11px]">
                COPY SYNAPSE LINK
              </span>
            </>
          )}
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          aria-label="Abrir configurações de nó e rede"
          className="p-1.5 rounded bg-cyber-card hover:bg-cyber-card-hover active:scale-[0.96] border border-cyber-border text-slate-300 hover:text-cyber-cyan hover:border-cyber-cyan/40 transition-transform transition-colors duration-150 ease-out-quick"
          title="Network & Node Configuration"
        >
          <Settings className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Toggle Sidebar */}
        <button
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? 'Fechar barra lateral de mensagens e diagnóstico' : 'Abrir barra lateral de mensagens e diagnóstico'}
          aria-expanded={isSidebarOpen}
          className="p-1.5 rounded bg-cyber-card hover:bg-cyber-card-hover active:scale-[0.96] border border-cyber-border text-slate-300 hover:text-cyber-cyan hover:border-cyber-cyan/40 transition-transform transition-colors duration-150 ease-out-quick"
          title={isSidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}
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
