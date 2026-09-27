import React, { useState } from 'react';
import { ShieldCheck, User, Cookie, Tv, Sparkles, ArrowRight, Check, X, Dices } from 'lucide-react';
import { generateSecureId, sanitizeIdentifier } from '../utils/security';

export function WelcomeModal({
  isOpen,
  onClose,
  currentOperator,
  currentRoom,
  onSaveProfile
}) {
  const [step, setStep] = useState(1);
  const [operatorName, setOperatorName] = useState(currentOperator || '');
  const [roomName, setRoomName] = useState(currentRoom || 'NODE_ALPHA');
  const [cookiesAcknowledged, setCookiesAcknowledged] = useState(true);

  if (!isOpen) return null;

  const handleRandomize = () => {
    setOperatorName(generateSecureId('OPR'));
  };

  const handleComplete = (e) => {
    e?.preventDefault();
    const cleanOp = sanitizeIdentifier(operatorName, currentOperator || 'OPR_TACTICAL');
    const cleanRoom = sanitizeIdentifier(roomName, currentRoom || 'NODE_ALPHA');

    localStorage.setItem('synapse_onboarded', 'true');
    localStorage.setItem('synapse_operator_id', cleanOp);
    localStorage.setItem('synapse_privacy_ack', 'true');

    onSaveProfile({ operatorId: cleanOp, roomId: cleanRoom });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-cyber-void/85 backdrop-blur-md p-4 transition-opacity duration-200"
    >
      <div className="w-full max-w-lg bg-cyber-dark border border-cyber-cyan/50 rounded-2xl shadow-glow-cyan-lg overflow-hidden font-mono text-xs animate-modal-enter flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-cyber-border bg-cyber-card flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyber-cyan" aria-hidden="true" />
            <span id="welcome-modal-title" className="font-headline font-bold text-sm uppercase text-slate-100 tracking-wider">
              SYNAPSE // PROTOCOLO DE BOAS-VINDAS
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar introdução"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-cyber-card-hover active:scale-[0.95] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Tabs */}
        <div className="flex border-b border-cyber-border bg-cyber-black text-[10px] uppercase font-bold tracking-wider">
          <button
            onClick={() => setStep(1)}
            className={`flex-1 py-2.5 px-3 text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
              step === 1
                ? 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3 h-3" />
            <span>1. Perfil Local</span>
          </button>
          <button
            onClick={() => setStep(2)}
            className={`flex-1 py-2.5 px-3 text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
              step === 2
                ? 'border-cyber-purple text-cyber-purple-light bg-cyber-purple/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cookie className="w-3 h-3" />
            <span>2. Privacidade & Cookies</span>
          </button>
          <button
            onClick={() => setStep(3)}
            className={`flex-1 py-2.5 px-3 text-center transition-colors border-b-2 flex items-center justify-center gap-1.5 ${
              step === 3
                ? 'border-cyber-green text-cyber-green bg-cyber-green/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv className="w-3 h-3" />
            <span>3. Como Operar</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* STEP 1: CADASTRO LOCALHOST */}
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-cyber-card/80 border border-cyber-cyan/30 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-cyber-cyan-bright font-bold text-xs uppercase">
                  <Sparkles className="w-3.5 h-3.5 text-cyber-cyan" />
                  <span>CADASTRO LOCAL PRIVADO (ZERO NUVEM)</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  O Synapse não requer conta de e-mail, senha ou cadastro em servidores centrais. Seus dados de identificação ficam guardados <strong>exclusivamente no seu próprio dispositivo (localStorage)</strong>.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    CODENAME DO OPERADOR
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={operatorName}
                      onChange={(e) => setOperatorName(e.target.value.toUpperCase())}
                      placeholder="EX: OPR_GHOST"
                      maxLength={32}
                      className="flex-1 bg-cyber-black border border-cyber-border focus:border-cyber-cyan rounded-lg px-3 py-2 text-cyber-cyan font-bold outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleRandomize}
                      className="px-3 py-2 bg-cyber-card border border-cyber-border hover:border-cyber-cyan text-slate-300 hover:text-cyber-cyan rounded-lg transition-colors flex items-center gap-1"
                      title="Gerar Codename Aleatório"
                    >
                      <Dices className="w-4 h-4" />
                      <span className="hidden sm:inline text-[10px]">SORTEAR</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    SALA / NÓ DE COMUNICAÇÃO INICIAL
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value.toUpperCase())}
                    placeholder="EX: NODE_ALPHA"
                    maxLength={32}
                    className="w-full bg-cyber-black border border-cyber-border focus:border-cyber-cyan rounded-lg px-3 py-2 text-cyber-cyan font-bold outline-none transition-colors"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Você pode alterar a sala a qualquer momento digitando no topo do HUD.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: POLÍTICA DE PRIVACIDADE & COOKIES */}
          {step === 2 && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="bg-cyber-card/70 border border-cyber-border rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-cyber-purple-light font-bold text-xs uppercase">
                  <Cookie className="w-3.5 h-3.5 text-cyber-purple" />
                  <span>POLÍTICA DE COOKIES & DADOS</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  <strong>Zero Rastreamento:</strong> Não utilizamos cookies de terceiros, pixels de anúncios ou ferramentas invasivas de telemetria.
                </p>
                <div className="border-t border-cyber-border/60 pt-2 text-[10px] text-slate-400 space-y-1">
                  <div className="flex items-start gap-1.5">
                    <span className="text-cyber-green font-bold">✔</span>
                    <span><strong>localStorage:</strong> Armazena apenas seu codename, sala ativa e preferências visuais.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-cyber-green font-bold">✔</span>
                    <span><strong>PWA Cache:</strong> Service Worker armazena em cache o App Shell para inicialização rápida.</span>
                  </div>
                </div>
              </div>

              <div className="bg-cyber-card/70 border border-cyber-cyan/30 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-cyber-cyan-bright font-bold text-xs uppercase">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyber-cyan" />
                  <span>TRANSMISSÃO 100% P2P CRIPTOGRAFADA</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Todo áudio e vídeo de tela é transmitido de forma <strong>direta de ponta a ponta (Peer-to-Peer)</strong> via DTLS/SRTP. Nenhum frame de imagem da sua tela é gravado, intermediado ou armazenado em servidores externos.
                </p>
              </div>

              <label className="flex items-center gap-2.5 p-2 bg-cyber-black rounded-lg border border-cyber-border cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cookiesAcknowledged}
                  onChange={(e) => setCookiesAcknowledged(e.target.checked)}
                  className="rounded border-cyber-border text-cyber-cyan focus:ring-0 w-3.5 h-3.5"
                />
                <span className="text-[11px] text-slate-300">
                  Estou ciente do uso de armazenamento local e da arquitetura P2P.
                </span>
              </label>
            </div>
          )}

          {/* STEP 3: GUIA RÁPIDO DE OPERAÇÃO */}
          {step === 3 && (
            <div className="space-y-3 animate-fadeIn">
              <div className="p-3 bg-cyber-black border border-cyber-cyan/40 rounded-xl space-y-2">
                <span className="text-cyber-cyan-bright font-bold text-xs uppercase block">
                  3 PASSOS PARA TRANSMITIR:
                </span>
                <ol className="space-y-2 text-[11px] text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded bg-cyber-cyan/20 text-cyber-cyan font-bold flex items-center justify-center shrink-0 text-[10px]">
                      1
                    </span>
                    <span><strong>Compartilhe o Link:</strong> Clique no botão superior <em>"COMPARTILHAR LINK"</em> e envie a URL para seu colega.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded bg-cyber-cyan/20 text-cyber-cyan font-bold flex items-center justify-center shrink-0 text-[10px]">
                      2
                    </span>
                    <span><strong>Inicie a Captura:</strong> Clique em <em>"TRANSMITIR"</em> no Quantum Dock inferior e escolha sua tela inteira ou janela.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded bg-cyber-cyan/20 text-cyber-cyan font-bold flex items-center justify-center shrink-0 text-[10px]">
                      3
                    </span>
                    <span><strong>Terminal Chat:</strong> Use a barra lateral direita para enviar mensagens de texto instantâneas com latência zero.</span>
                  </li>
                </ol>
              </div>

              <div className="p-2.5 bg-cyan-950/20 border border-cyber-cyan/30 rounded-lg text-[10px] text-slate-400">
                💡 <strong>Dica Pro:</strong> Você pode instalar o Synapse como aplicativo no seu computador ou celular clicando no ícone de instalação do navegador!
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-cyber-border bg-cyber-card flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="px-3 py-1.5 text-[11px] rounded bg-cyber-black border border-cyber-border text-slate-300 hover:text-slate-100 hover:border-slate-500 transition-colors"
            >
              VOLTAR
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="px-4 py-1.5 text-[11px] font-bold rounded bg-cyber-cyan hover:bg-cyber-cyan-bright text-slate-950 transition-all flex items-center gap-1.5 shadow-glow-cyan-sm"
            >
              <span>AVANÇAR</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={!cookiesAcknowledged}
              className={`px-5 py-2 text-[11px] font-bold rounded transition-all flex items-center gap-1.5 shadow-glow-cyan ${
                cookiesAcknowledged
                  ? 'bg-cyber-green hover:bg-emerald-400 text-slate-950 cursor-pointer active:scale-[0.98]'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>INICIALIZAR SYNAPSE CORE</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
