import { useState, useEffect, useRef } from 'react';
import { Lock, KeyRound, Eye, EyeOff, ShieldAlert, Check, X, Sparkles } from 'lucide-react';
import { generateSecurePin } from '../utils/security';
import { useI18n } from '../i18n/I18nContext';

export function PasswordPromptModal({
  isOpen,
  mode = 'prompt', // 'prompt' (guest entering password) | 'configure' (host setting/modifying password)
  currentPassword = '',
  roomId = '',
  errorMessage = '',
  onClose,
  onSubmit
}) {
  const { t } = useI18n();
  const [password, setPassword] = useState(currentPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setPassword(currentPassword);
    setLocalError(errorMessage);
  }, [currentPassword, errorMessage, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerateRandom = () => {
    const pin = generateSecurePin(6);
    setPassword(pin);
    setShowPassword(true);
    setLocalError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanPwd = password.trim();

    if (mode === 'prompt' && !cleanPwd) {
      setLocalError(t('auth.errorEmpty'));
      return;
    }

    setLocalError('');
    onSubmit(cleanPwd);
  };

  const handleRemovePassword = () => {
    setPassword('');
    onSubmit('');
  };

  const isPromptMode = mode === 'prompt';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwd-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-cyber-void/85 backdrop-blur-md p-4 transition-opacity duration-200"
    >
      <div className="w-full max-w-md bg-cyber-dark border border-cyber-cyan/50 rounded-2xl shadow-glow-cyan-lg overflow-hidden font-mono text-xs animate-modal-enter flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-cyber-border bg-cyber-card flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPromptMode ? (
              <ShieldAlert className="w-4 h-4 text-cyber-amber animate-pulse" />
            ) : password ? (
              <Lock className="w-4 h-4 text-cyber-green" />
            ) : (
              <KeyRound className="w-4 h-4 text-cyber-cyan" />
            )}
            <span id="pwd-modal-title" className="font-headline font-bold text-sm uppercase text-slate-100 tracking-wider">
              {isPromptMode
                ? t('auth.title')
                : t('settings.passwordLabel')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-cyber-card-hover active:scale-[0.95] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-cyber-black/70 border border-cyber-border rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                {t('settings.nodeLabel')}
              </span>
              <span className="text-cyber-cyan font-bold font-mono tracking-wider">
                {roomId || 'NODE'}
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {isPromptMode
                ? t('auth.description')
                : t('settings.passwordLockedDesc')}
            </p>
          </div>

          {/* Password Input Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="room-password-input" className="text-slate-300 font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-cyber-cyan" />
                <span>{t('auth.inputLabel')}</span>
              </label>
              {!isPromptMode && (
                <button
                  type="button"
                  onClick={handleGenerateRandom}
                  className="text-[10px] text-cyber-cyan hover:text-cyber-cyan-bright flex items-center gap-1 hover:underline transition-colors"
                  title={t('settings.generatePin')}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{t('settings.generatePin')}</span>
                </button>
              )}
            </div>

            <div className="relative flex items-center">
              <input
                ref={inputRef}
                id="room-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLocalError('');
                }}
                placeholder={isPromptMode ? t('auth.inputPlaceholder') : t('settings.passwordPlaceholder')}
                maxLength={64}
                autoComplete="off"
                className="w-full bg-cyber-black border border-cyber-border focus:border-cyber-cyan rounded-lg px-3 py-2.5 pr-10 text-cyber-cyan font-mono tracking-wider outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 p-1 text-slate-400 hover:text-cyber-cyan transition-colors"
                title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {(localError || errorMessage) && (
              <div className="mt-2 p-2 bg-red-950/60 border border-red-500/40 rounded-lg text-red-200 text-[11px] flex items-center gap-1.5 animate-fadeIn">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>{localError || errorMessage}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-cyber-border/60">
            {!isPromptMode && currentPassword ? (
              <button
                type="button"
                onClick={handleRemovePassword}
                className="px-3 py-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-[11px] font-bold uppercase transition-colors"
                title="Remover senha da sala e torná-la aberta"
              >
                REMOVER SENHA
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg bg-cyber-card hover:bg-cyber-card-hover border border-cyber-border text-slate-300 hover:text-white transition-colors text-[11px] font-semibold"
              >
                {t('auth.cancelBtn')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-cyber-cyan hover:bg-cyber-cyan-bright text-cyber-void font-bold uppercase tracking-wider text-[11px] shadow-glow-cyan-sm flex items-center gap-1.5 transition-all active:scale-[0.97]"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isPromptMode ? t('auth.submitBtn') : t('settings.saveBtn')}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
