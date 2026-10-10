import { useState } from 'react';
import { X, Network, Server, Hash, ShieldCheck, Check, Lock, Eye, EyeOff, Sparkles, Languages, Radio, Tv } from 'lucide-react';
import { generateSecurePin } from '../utils/security';
import { useI18n } from '../i18n/I18nContext';

export function ModalSettings({
  isOpen,
  onClose,
  signalingUrl,
  roomId,
  operatorId,
  roomPassword = '',
  iceServerUrl = '',
  iceServerUsername = '',
  iceServerCredential = '',
  autoPip = true,
  onSave
}) {
  const { t, language, setLanguage, supportedLanguages } = useI18n();
  const [formSignalingUrl, setFormSignalingUrl] = useState(signalingUrl);
  const [formRoomId, setFormRoomId] = useState(roomId);
  const [formOperatorId, setFormOperatorId] = useState(operatorId);
  const [formPassword, setFormPassword] = useState(roomPassword);
  const [showPassword, setShowPassword] = useState(false);

  // TURN Relay & Auto-PiP state
  const [formTurnUrl, setFormTurnUrl] = useState(iceServerUrl);
  const [formTurnUser, setFormTurnUser] = useState(iceServerUsername);
  const [formTurnCred, setFormTurnCred] = useState(iceServerCredential);
  const [formAutoPip, setFormAutoPip] = useState(autoPip);

  if (!isOpen) return null;

  const handleGeneratePin = () => {
    const pin = generateSecurePin(6);
    setFormPassword(pin);
    setShowPassword(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    const cleanRoom = formRoomId.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 32);
    const cleanOperator = formOperatorId.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 32);
    const cleanUrl = formSignalingUrl.trim();
    const cleanPassword = formPassword.trim();

    onSave({
      signalingUrl: cleanUrl,
      roomId: cleanRoom || roomId,
      operatorId: cleanOperator || operatorId,
      roomPassword: cleanPassword,
      iceServerUrl: formTurnUrl.trim(),
      iceServerUsername: formTurnUser.trim(),
      iceServerCredential: formTurnCred.trim(),
      autoPip: formAutoPip
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cyber-void/80 backdrop-blur-sm p-4 transition-opacity duration-200">
      <div className="w-full max-w-md max-h-[90vh] bg-cyber-dark border border-cyber-cyan/40 rounded-2xl shadow-glow-cyan-lg overflow-y-auto font-mono text-xs animate-modal-enter">
        {/* Header */}
        <div className="sticky top-0 z-10 p-4 border-b border-cyber-border bg-cyber-card flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-cyber-cyan" />
            <span className="font-headline font-bold text-sm uppercase text-slate-100 tracking-wide">
              {t('settings.title')}
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
          {/* Language Selection */}
          <div>
            <label className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1.5 uppercase tracking-wider text-[11px]">
              <Languages className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>{t('settings.languageLabel')}</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {supportedLanguages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  className={`py-2 px-2.5 rounded-lg border text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all ${
                    language === lang.code
                      ? 'bg-cyber-cyan/20 border-cyber-cyan text-cyber-cyan-bright shadow-glow-cyan-sm'
                      : 'bg-cyber-black border-cyber-border text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Signaling Server URL */}
          <div>
            <label className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1.5 uppercase tracking-wider text-[11px]">
              <Server className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>{t('settings.signalingLabel')}</span>
            </label>
            <input
              type="text"
              value={formSignalingUrl}
              onChange={(e) => setFormSignalingUrl(e.target.value)}
              placeholder="ws://localhost:3000 ou wss://seu-servidor.com"
              className="w-full bg-cyber-black border border-cyber-border focus:border-cyber-cyan rounded-lg px-3 py-2 text-cyber-cyan-bright outline-none transition-colors duration-150 ease-out-quick"
              required
            />
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">PRESETS:</span>
              <button
                type="button"
                onClick={() => setFormSignalingUrl('ws://localhost:3000')}
                className="text-[10px] px-2 py-0.5 rounded bg-cyber-card hover:bg-cyber-cyan/20 border border-cyber-border hover:border-cyber-cyan/40 text-cyber-cyan transition-colors"
              >
                {t('settings.presetLocalhost')}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
              {t('settings.signalingDesc')}
            </p>
          </div>

          {/* TURN Relay Server (NAT & Firewall Traversal) */}
          <div className="border border-cyber-border/70 rounded-xl p-3 bg-cyber-black/40 space-y-2.5">
            <label className="flex items-center gap-1.5 text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
              <Radio className="w-3.5 h-3.5 text-cyber-amber" />
              <span>{t('settings.turnLabel')}</span>
            </label>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              {t('settings.turnDesc')}
            </p>
            <input
              type="text"
              value={formTurnUrl}
              onChange={(e) => setFormTurnUrl(e.target.value)}
              placeholder={t('settings.turnUrlPlaceholder')}
              className="w-full bg-cyber-black border border-cyber-border focus:border-cyber-amber rounded-lg px-3 py-1.5 text-cyber-amber font-mono text-[11px] outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={formTurnUser}
                onChange={(e) => setFormTurnUser(e.target.value)}
                placeholder={t('settings.turnUserPlaceholder')}
                className="w-full bg-cyber-black border border-cyber-border focus:border-cyber-amber rounded-lg px-3 py-1.5 text-slate-200 font-mono text-[11px] outline-none"
              />
              <input
                type="password"
                value={formTurnCred}
                onChange={(e) => setFormTurnCred(e.target.value)}
                placeholder={t('settings.turnCredPlaceholder')}
                className="w-full bg-cyber-black border border-cyber-border focus:border-cyber-amber rounded-lg px-3 py-1.5 text-slate-200 font-mono text-[11px] outline-none"
              />
            </div>
          </div>

          {/* Auto Picture-in-Picture Setting */}
          <div className="border border-cyber-border/70 rounded-xl p-3 bg-cyber-black/40 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <Tv className="w-4 h-4 text-cyber-cyan shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-200 font-semibold text-[11px] uppercase block">
                  {t('settings.autoPipLabel')}
                </span>
                <span className="text-slate-400 text-[10px] leading-tight block">
                  {t('settings.autoPipDesc')}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              id="auto-pip-checkbox"
              checked={formAutoPip}
              onChange={(e) => setFormAutoPip(e.target.checked)}
              className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
            />
          </div>

          {/* Node / Room ID */}
          <div>
            <label className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1.5 uppercase tracking-wider text-[11px]">
              <Hash className="w-3.5 h-3.5 text-cyber-purple-light" />
              <span>{t('settings.nodeLabel')}</span>
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

          {/* Room Password (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="flex items-center gap-1.5 text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                <Lock className="w-3.5 h-3.5 text-cyber-green" />
                <span>{t('settings.passwordLabel')}</span>
              </label>
              <button
                type="button"
                onClick={handleGeneratePin}
                className="text-[10px] text-cyber-cyan hover:underline flex items-center gap-1"
                title="Generate 6-digit random PIN"
              >
                <Sparkles className="w-3 h-3" />
                <span>{t('settings.generatePin')}</span>
              </button>
            </div>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder={t('settings.passwordPlaceholder')}
                className="w-full bg-cyber-black border border-cyber-border focus:border-cyber-green rounded-lg px-3 py-2 pr-10 text-cyber-green font-mono tracking-wider outline-none transition-colors duration-150 ease-out-quick"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 p-1 text-slate-400 hover:text-cyber-green transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {formPassword ? t('settings.passwordLockedDesc') : t('settings.passwordOpenDesc')}
            </p>
          </div>

          {/* Operator Callsign */}
          <div>
            <label className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1.5 uppercase tracking-wider text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-cyber-green" />
              <span>{t('settings.operatorLabel')}</span>
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
              {t('settings.cancelBtn')}
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyber-cyan hover:bg-cyber-cyan-bright text-cyber-black font-bold tracking-wider uppercase transition-transform transition-colors duration-150 ease-out-quick shadow-glow-cyan active:scale-[0.97]"
            >
              <Check className="w-4 h-4" />
              <span>{t('settings.saveBtn')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
export default ModalSettings;
