import React, { useState } from 'react';
import { X, Network, Server, Hash, ShieldCheck, Check } from 'lucide-react';

export function ModalSettings({
  isOpen,
  onClose,
  signalingUrl,
  roomId,
  operatorId,
  onSave
}) {
  const [formSignalingUrl, setFormSignalingUrl] = useState(signalingUrl);
  const [formRoomId, setFormRoomId] = useState(roomId);
  const [formOperatorId, setFormOperatorId] = useState(operatorId);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    const cleanRoom = formRoomId.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 32);
    const cleanOperator = formOperatorId.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 32);
    const cleanUrl = formSignalingUrl.trim();

    onSave({
      signalingUrl: cleanUrl,
      roomId: cleanRoom || roomId,
      operatorId: cleanOperator || operatorId
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cyber-void/80 backdrop-blur-sm p-4 transition-opacity duration-200">
      <div className="w-full max-w-md bg-cyber-dark border border-cyber-cyan/40 rounded-2xl shadow-glow-cyan-lg overflow-hidden font-mono text-xs animate-modal-enter">
        {/* Header */}
        <div className="p-4 border-b border-cyber-border bg-cyber-card flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-cyber-cyan" />
            <span className="font-headline font-bold text-sm uppercase text-slate-100 tracking-wide">
              SYNAPSE CORE CONFIGURATION
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-cyber-card-hover active:scale-[0.95] transition-transform transition-colors duration-150 ease-out-quick"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Signaling Server URL */}
          <div>
            <label className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1.5 uppercase tracking-wider text-[11px]">
              <Server className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>SIGNALING UPLINK (WEBSOCKET URL)</span>
            </label>
            <input
              type="text"
              value={formSignalingUrl}
              onChange={(e) => setFormSignalingUrl(e.target.value)}
              placeholder="ws://localhost:3000 or wss://your-worker.workers.dev"
              className="w-full bg-cyber-black border border-cyber-border focus:border-cyber-cyan rounded-lg px-3 py-2 text-cyber-cyan-bright outline-none transition-colors duration-150 ease-out-quick"
              required
            />
            <p className="text-[10px] text-slate-500 mt-1">
              For Cloudflare Pages, connect to your WebSocket signaling server or local instance.
            </p>
          </div>

          {/* Node / Room ID */}
          <div>
            <label className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1.5 uppercase tracking-wider text-[11px]">
              <Hash className="w-3.5 h-3.5 text-cyber-purple-light" />
              <span>NETWORK NODE // ROOM ID</span>
            </label>
            <input
              type="text"
              value={formRoomId}
              onChange={(e) => setFormRoomId(e.target.value)}
              placeholder="NODE_ALPHA"
              className="w-full bg-cyber-black border border-cyber-border focus:border-cyber-purple rounded-lg px-3 py-2 text-cyber-purple-light uppercase outline-none transition-colors duration-150 ease-out-quick"
              required
            />
          </div>

          {/* Operator Callsign */}
          <div>
            <label className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1.5 uppercase tracking-wider text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-cyber-green" />
              <span>OPERATOR CALLSIGN</span>
            </label>
            <input
              type="text"
              value={formOperatorId}
              onChange={(e) => setFormOperatorId(e.target.value)}
              placeholder="OPR_VALKYRIE"
              className="w-full bg-cyber-black border border-cyber-border focus:border-cyber-green rounded-lg px-3 py-2 text-cyber-green uppercase outline-none transition-colors duration-150 ease-out-quick"
              required
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-cyber-card hover:bg-cyber-card-hover border border-cyber-border active:scale-[0.97] text-slate-300 transition-transform transition-colors duration-150 ease-out-quick"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyber-cyan hover:bg-cyber-cyan-bright text-cyber-black font-bold tracking-wider uppercase transition-transform transition-colors duration-150 ease-out-quick shadow-glow-cyan active:scale-[0.97]"
            >
              <Check className="w-4 h-4" />
              <span>SAVE & RECONNECT</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
