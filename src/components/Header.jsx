import React, { useState, useEffect } from 'react';
import { Zap, Link2, Check, Settings, PanelRightClose, PanelRightOpen, Dices, ArrowRight, HelpCircle } from 'lucide-react';

const RANDOM_NAMES = [
  'CYBER_NODE', 'VALKYRIE_99', 'MATRIX_P2P', 'GHOST_LINK',
  'NEO_TOKYO', 'SHADOW_RUN', 'SYNAPSE_42', 'DEEP_GRID',
  'NETRUNNER', 'ZERO_COOL', 'QUANTUM_RAY', 'CHROME_LINK'
];

export function Header({
  roomId,
  onChangeRoom,
  connectionState,
  rttMs,
  onOpenSettings,
  onOpenHelp,
  isSidebarOpen,
  onToggleSidebar
}) {
  const [copied, setCopied] = useState(false);
  const [inputRoom, setInputRoom] = useState(roomId);

  useEffect(() => {
    setInputRoom(roomId);
  }, [roomId]);

  const handleCopyLink = () => {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
    const randomPrefix = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    let suffix = '00';
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const array = new Uint8Array(2);
      window.crypto.getRandomValues(array);
      suffix = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    } else {
      suffix = Math.floor(10 + Math.random() * 90).toString();
    }
    const newRoom = `${randomPrefix}_${suffix}`;
    setInputRoom(newRoom);
    onChangeRoom(newRoom);
  };

  const isConnected = connectionState === 'connected';
  const isReconnecting = connectionState === 'reconnecting' || connectionState === 'connecting';

  let statusLabel = 'STANDBY';
  let statusColor = 'text-cyber-amber';
  let dotColor = 'bg-cyber-amber shadow-glow-amber';

  if (isConnected) {
    statusLabel = 'LINK_ACTIVE';
    statusColor = 'text-cyber-green';
    dotColor = 'bg-cyber-green animate-glow-pulse-green';
  } else if (isReconnecting) {
    statusLabel = 'CONNECTING...';
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
              V1.1.0 P2P
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
            [ENC: <span className="text-cyber-purple-light font-bold">AES-GCM-256</span>]
          </span>
        </div>
      </div>

      {/* Action Controls & Room Switcher */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Interactive Room Selector Form */}
        <form onSubmit={handleApplyRoom} className="flex items-center bg-cyber-card border border-cyber-border focus-within:border-cyber-cyan/60 rounded px-2 py-1 text-xs transition-colors">
          <span className="text-slate-400 mr-1.5 uppercase text-[10px] tracking-wider font-semibold">
            NODE:
          </span>
          <input
            type="text"
            value={inputRoom}
            onChange={(e) => setInputRoom(e.target.value.toUpperCase())}
            placeholder="NOME_DA_SALA"
            className="bg-transparent text-cyber-cyan font-bold font-mono text-xs uppercase tracking-wider outline-none w-24 sm:w-28 placeholder:text-slate-600"
            title="Digite o nome da sala e pressione Enter ou clique na seta"
          />
          {inputRoom !== roomId && (
            <button
              type="submit"
              className="p-1 rounded bg-cyber-cyan/20 hover:bg-cyber-cyan/30 text-cyber-cyan transition-colors ml-1"
              title="Entrar nesta sala"
            >
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={handleRandomRoom}
            className="p-1 rounded text-slate-400 hover:text-cyber-cyan hover:bg-slate-800 transition-colors ml-1"
            title="Gerar nome de sala aleatório"
          >
            <Dices className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Copy Shareable Link */}
        <button
          onClick={handleCopyLink}
          aria-label={copied ? 'Link de compartilhamento copiado' : 'Copiar link de compartilhamento da sala'}
          className="flex items-center gap-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 active:scale-[0.97] border border-cyber-cyan/40 text-cyber-cyan-bright px-2.5 sm:px-3 py-1.5 rounded text-xs transition-transform transition-colors duration-150 ease-out-quick shadow-glow-cyan-sm"
          title="Copiar link direto para esta sala"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-cyber-green" aria-hidden="true" />
              <span className="font-semibold uppercase tracking-wider text-[11px] text-cyber-green hidden sm:inline">
                LINK COPIADO!
              </span>
            </>
          ) : (
            <>
              <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-semibold uppercase tracking-wider text-[11px] hidden sm:inline">
                COMPARTILHAR LINK
              </span>
            </>
          )}
        </button>

        {/* Help & Privacy Modal Button */}
        <button
          onClick={onOpenHelp}
          aria-label="Abrir guia de introdução, protocolo e privacidade"
          className="p-1.5 rounded bg-cyber-card hover:bg-cyber-card-hover active:scale-[0.96] border border-cyber-border text-slate-300 hover:text-cyber-cyan hover:border-cyber-cyan/40 transition-transform transition-colors duration-150 ease-out-quick"
          title="Guia do Operador & Privacidade (Cookies/Local)"
        >
          <HelpCircle className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          aria-label="Abrir configurações de nó e rede"
          className="p-1.5 rounded bg-cyber-card hover:bg-cyber-card-hover active:scale-[0.96] border border-cyber-border text-slate-300 hover:text-cyber-cyan hover:border-cyber-cyan/40 transition-transform transition-colors duration-150 ease-out-quick"
          title="Configurações (Servidor, Sala, Usuário)"
        >
          <Settings className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Toggle Sidebar */}
        <button
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? 'Fechar barra lateral de mensagens e diagnóstico' : 'Abrir barra lateral de mensagens e diagnóstico'}
          aria-expanded={isSidebarOpen}
          className="p-1.5 rounded bg-cyber-card hover:bg-cyber-card-hover active:scale-[0.96] border border-cyber-border text-slate-300 hover:text-cyber-cyan hover:border-cyber-cyan/40 transition-transform transition-colors duration-150 ease-out-quick"
          title={isSidebarOpen ? 'Fechar Sidebar' : 'Abrir Sidebar'}
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
