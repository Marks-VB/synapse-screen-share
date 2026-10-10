import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';

const BOOT_LOGS = [
  'INITIALIZING SYNAPSE KERNEL v1.1.0...',
  'CALIBRATING HARDWARE ACCELERATED WEBRTC (1080P @ 60 FPS)...',
  'ARMING DTLS-SRTP 256-BIT P2P ENCRYPTION PIPELINE...',
  'INITIALIZING QUANTUM DOCK CONTROLS & TERMINAL...',
  'SYSTEM READY // CYBERNETIC MESH ONLINE'
];

export function LoadingScreen({ onFinish }) {
  const [logIndex, setLogIndex] = useState(0);
  const [progress, setProgress] = useState(15);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const logInterval = setInterval(() => {
      setLogIndex((prev) => {
        if (prev < BOOT_LOGS.length - 1) return prev + 1;
        return prev;
      });
    }, 180);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.floor(Math.random() * 20) + 10;
      });
    }, 120);

    const finishTimeout = setTimeout(() => {
      setIsFading(true);
      const exitTimeout = setTimeout(() => {
        if (onFinish) onFinish();
      }, 350);
      return () => clearTimeout(exitTimeout);
    }, 1000);

    return () => {
      clearInterval(logInterval);
      clearInterval(progressInterval);
      clearTimeout(finishTimeout);
    };
  }, [onFinish]);

  return (
    <div
      role="status"
      aria-label="Carregando Synapse Core"
      className={`fixed inset-0 z-50 bg-cyber-void flex flex-col items-center justify-center font-mono select-none transition-opacity duration-300 ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background CRT scanlines effect */}
      <div className="crt-scanlines pointer-events-none" />

      {/* Central Tactical Core Emblem */}
      <div className="relative mb-8 flex items-center justify-center">
        {/* Glowing pulse rings */}
        <div className="absolute w-32 h-32 rounded-full border border-cyber-cyan/20 animate-ping opacity-30" />
        <div className="absolute w-24 h-24 rounded-full border border-cyber-cyan/40 shadow-glow-cyan" />
        
        {/* Core Icon Box */}
        <div className="w-16 h-16 rounded-2xl bg-cyber-card border-2 border-cyber-cyan flex items-center justify-center shadow-glow-cyan-lg relative z-10">
          <Zap className="w-8 h-8 text-cyber-cyan animate-pulse fill-cyber-cyan/20" />
        </div>
      </div>

      {/* Brand & Subtitle */}
      <div className="text-center mb-6 space-y-1">
        <h1 className="font-headline font-bold text-2xl tracking-[0.25em] text-slate-100 flex items-center justify-center gap-2">
          <span>SYNAPSE</span>
          <span className="text-cyber-cyan text-sm font-mono px-2 py-0.5 rounded bg-cyan-950/60 border border-cyber-cyan/40">
            CORE
          </span>
        </h1>
        <p className="text-[10px] tracking-[0.3em] text-slate-400 uppercase">
          ULTRA-LOW LATENCY WEBRTC SCREEN SHARE // 60 FPS
        </p>
      </div>

      {/* Terminal Boot Sequence Log */}
      <div className="w-80 sm:w-96 bg-cyber-black/90 border border-cyber-border rounded-xl p-3.5 mb-6 shadow-inner font-mono text-[11px] space-y-1.5">
        <div className="flex items-center justify-between text-[9px] text-slate-500 uppercase pb-1 border-b border-cyber-border/40">
          <span>BOOT_DIAGNOSTICS</span>
          <span className="text-cyber-cyan">{Math.min(progress, 100)}%</span>
        </div>
        <div className="h-10 flex flex-col justify-center">
          <div className="text-cyber-cyan-bright truncate flex items-center">
            <span className="text-cyber-green mr-1.5 font-bold">&gt;</span>
            <span>{BOOT_LOGS[logIndex]}</span>
            <span className="cursor-blink text-cyber-cyan font-bold ml-0.5">_</span>
          </div>
        </div>
      </div>

      {/* Loading Progress Bar */}
      <div className="w-80 sm:w-96 h-1.5 bg-cyber-card rounded-full overflow-hidden border border-cyber-border relative">
        <div
          className="h-full bg-gradient-to-r from-cyber-cyan via-cyber-cyan-bright to-cyber-green transition-all duration-150 ease-out shadow-glow-cyan-sm"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {/* Security Stamp */}
      <div className="mt-8 text-[9px] text-slate-600 tracking-[0.25em] uppercase flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" />
        <span>SECURE P2P ENCRYPTION ARMED</span>
      </div>
    </div>
  );
}
