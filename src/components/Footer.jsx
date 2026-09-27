import React from 'react';

export function Footer() {
  return (
    <footer className="h-6 sm:h-7 bg-cyber-dark/95 border-t border-cyber-border px-3 sm:px-4 flex items-center justify-between text-[9px] font-mono text-slate-500 uppercase tracking-widest shrink-0 select-none z-30 backdrop-blur-md">
      {/* System Status Ticker */}
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" aria-hidden="true"></span>
        <span className="hidden sm:inline text-slate-400">SYNAPSE MESH // P2P DTLS-SRTP CORE</span>
        <span className="sm:hidden text-slate-400">P2P MESH</span>
      </div>

      {/* Signature Animated Developer Credit */}
      <div className="flex items-center justify-center">
        <a
          href="https://marksvb.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 hover:text-cyber-cyan-bright transition-colors duration-150 inline-flex items-center tracking-[0.25em] group focus:outline-none focus:ring-1 focus:ring-cyber-cyan rounded px-1 active:scale-[0.98]"
          title="Visit marksvb.dev"
          aria-label="Built by marksvb.dev (opens external link)"
        >
          <span>{'{ > BUILD BY MARKSVB.DEV'}</span>
          <span className="cursor-blink text-cyber-cyan font-bold">_</span>
          <span>{' }'}</span>
        </a>
      </div>

      {/* Mode / Capability Tag */}
      <div className="text-slate-500 hidden sm:flex items-center gap-1.5">
        <span className="text-cyber-purple/80">STANDALONE PWA</span>
        <span>•</span>
        <span>60 FPS</span>
      </div>
    </footer>
  );
}
