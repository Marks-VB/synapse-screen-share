import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2 } from 'lucide-react';

export function TerminalChat({
  isOpen,
  chatMessages,
  diagLogs,
  iceState,
  onSendMessage,
  onClearLogs,
  operatorId
}) {
  const [activeTab, setActiveTab] = useState('terminal');
  const [inputText, setInputText] = useState('');

  const chatEndRef = useRef(null);
  const diagEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    diagEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [diagLogs]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  if (!isOpen) return null;

  return (
    <aside className="w-80 bg-cyber-dark/95 border-l border-cyber-border flex flex-col shrink-0 relative z-30 backdrop-blur-md">
      {/* Panel Header & Tab Switcher */}
      <div className="p-2 border-b border-cyber-border bg-cyber-card/60 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors duration-150 ease-out-quick active:scale-[0.96] ${
              activeTab === 'terminal'
                ? 'bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/40 shadow-glow-cyan-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-cyber-card/80 border border-transparent'
            }`}
          >
            TERMINAL
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors duration-150 ease-out-quick active:scale-[0.96] ${
              activeTab === 'diagnostics'
                ? 'bg-cyber-purple/20 text-cyber-purple-light border border-cyber-purple/40 shadow-glow-purple'
                : 'text-slate-400 hover:text-slate-200 hover:bg-cyber-card/80 border border-transparent'
            }`}
          >
            DIAGNOSTICS
          </button>
        </div>
        <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
          P2P // DATA
        </span>
      </div>

      {/* TAB 1: TERMINAL CHAT */}
      {activeTab === 'terminal' && (
        <div className="flex-1 flex flex-col overflow-hidden" role="tabpanel" aria-label="Terminal de mensagens">
          <div
            className="flex-1 overflow-y-auto p-3 space-y-2 text-xs font-mono"
            aria-live="polite"
            aria-relevant="additions"
          >
            {chatMessages.map((msg) => (
              <div key={msg.id} className="leading-relaxed break-words">
                {msg.isSystem ? (
                  <>
                    <span className="text-slate-400 text-[10px]">[{msg.timestamp}]</span>{' '}
                    <span className="text-cyber-cyan-bright font-bold">[SYS]:</span>{' '}
                    <span className="text-slate-300">{msg.text}</span>
                  </>
                ) : (
                  <>
                    <span className="text-slate-400 text-[10px]">[{msg.timestamp}]</span>{' '}
                    <span
                      className={`font-bold ${
                        msg.sender === operatorId ? 'text-cyber-green-bright' : 'text-cyber-purple-light'
                      }`}
                    >
                      [{msg.sender}]:
                    </span>{' '}
                    <span className="text-slate-100">{msg.text}</span>
                  </>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-2 border-t border-cyber-border bg-cyber-card/80">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <span className="text-cyber-cyan-bright font-bold text-xs" aria-hidden="true">&gt;</span>
              <label htmlFor="terminal-chat-input" className="sr-only">
                Mensagem do terminal
              </label>
              <input
                id="terminal-chat-input"
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Broadcast command or message..."
                aria-label="Broadcast command or message"
                className="flex-1 bg-transparent text-slate-100 text-xs font-mono outline-none placeholder:text-slate-500"
              />
              <button
                type="submit"
                aria-label="Enviar mensagem"
                className="p-1.5 rounded-lg bg-cyber-cyan/15 hover:bg-cyber-cyan/25 active:scale-[0.95] text-cyber-cyan-bright transition-transform transition-colors duration-150 ease-out-quick border border-cyber-cyan/30"
                title="Send Message"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: DIAGNOSTICS */}
      {activeTab === 'diagnostics' && (
        <div className="flex-1 flex flex-col overflow-hidden" role="tabpanel" aria-label="Diagnósticos de conexão">
          <div
            className="flex-1 overflow-y-auto p-3 space-y-1.5 text-[11px] font-mono text-slate-300 select-text"
            aria-live="polite"
            aria-relevant="additions"
          >
            {diagLogs.map((log) => {
              let color = 'text-slate-300';
              if (log.level === 'SUCCESS') color = 'text-cyber-green-bright font-semibold';
              if (log.level === 'ERROR') color = 'text-cyber-red-bright font-bold';
              if (log.level === 'WARN') color = 'text-cyber-amber-bright font-semibold';
              if (log.level === 'SIGNAL') color = 'text-cyber-purple-light font-semibold';
              if (log.level === 'SYS_INIT') color = 'text-cyber-cyan-bright font-semibold';

              return (
                <div key={log.id} className="break-all">
                  <span className="text-slate-400">[{log.timestamp}]</span>{' '}
                  <span className={color}>[{log.level}]</span> {log.msg}
                </div>
              );
            })}
            <div ref={diagEndRef} />
          </div>

          <div className="p-2 border-t border-cyber-border bg-cyber-card/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">
              ICE: <span className="text-cyber-cyan-bright font-mono font-bold">{iceState}</span>
            </span>
            <button
              onClick={onClearLogs}
              aria-label="Limpar logs de diagnóstico"
              className="flex items-center gap-1 text-slate-300 hover:text-white active:scale-[0.96] transition-transform transition-colors duration-150 ease-out-quick uppercase text-[10px]"
            >
              <Trash2 className="w-3 h-3" aria-hidden="true" />
              <span>CLEAR LOGS</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
