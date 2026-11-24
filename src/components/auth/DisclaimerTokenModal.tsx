import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  Sparkles,
  User,
  UserCog,
} from 'lucide-react';
import { type AuthUser, setAuthSession } from '../../lib/authSession';

interface DisclaimerTokenModalProps {
  isOpen: boolean;
  onSuccess: (sessionToken: string, user: AuthUser) => void;
}

export const DisclaimerTokenModal: React.FC<DisclaimerTokenModalProps> = ({
  isOpen,
  onSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checkingMode, setCheckingMode] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setCheckingMode(true);
    setPassword('');
    setConfirmPassword('');
    setErrorMsg(null);

    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const unclaimed = data?.configured === false || data?.mode === 'unclaimed';
        setNeedsSetup(unclaimed);
        if (unclaimed) {
          setUsername((prev) => prev || 'admin');
        }
      })
      .catch(() => {
        if (!active) return;
        setNeedsSetup(false);
      })
      .finally(() => {
        if (active) setCheckingMode(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername) {
      setErrorMsg('Informe o nome de usuário.');
      return;
    }

    if (needsSetup) {
      if (!/^[a-z0-9._-]{3,32}$/.test(cleanUsername)) {
        setErrorMsg(
          'Usuário deve ter de 3 a 32 caracteres (letras, números, ponto, hífen ou underline — sem e-mail).'
        );
        return;
      }
      if (password.length < 6) {
        setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('A confirmação da senha não confere.');
        return;
      }
    } else if (!password) {
      setErrorMsg('Informe sua senha.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const endpoint = needsSetup ? '/api/auth/setup' : '/api/auth/login';
      const payload = needsSetup
        ? {
            username: cleanUsername,
            displayName: displayName.trim() || undefined,
            password,
          }
        : {
            username: cleanUsername,
            password,
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success && data.sessionToken && data.user) {
        setAuthSession(data.sessionToken, data.user);
        setPassword('');
        setConfirmPassword('');
        onSuccess(data.sessionToken, data.user);
      } else if (data.needsSetup) {
        setNeedsSetup(true);
        setUsername((prev) => prev || 'admin');
        setErrorMsg(null);
      } else {
        setErrorMsg(data.message || 'Usuário ou senha incorretos.');
      }
    } catch {
      setErrorMsg('Falha ao comunicar com o servidor local. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none animate-in fade-in duration-300">
      <div className="absolute w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute w-80 h-80 rounded-full bg-purple-500/10 blur-[120px] pointer-events-none translate-x-20 translate-y-20" />

      <div className="relative w-full max-w-md rounded-2xl bg-[#090812] border border-cyan-500/30 p-6 sm:p-7 shadow-[0_0_50px_rgba(0,0,0,0.9),0_0_25px_rgba(34,211,238,0.2)] flex flex-col gap-5">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="p-3.5 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.35)]">
            {needsSetup ? (
              <UserCog className="w-8 h-8 text-emerald-300" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-cyan-300" />
            )}
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold tracking-wider uppercase mb-2">
              {needsSetup ? 'Primeiro Acesso • Criar Admin' : 'Acesso Restrito • Login Simples'}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
              RollDeck — Forja de Mundos
            </h2>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 text-center">
          {needsSetup ? (
            <>
              <p className="text-sm font-semibold text-slate-100 leading-relaxed">
                Crie a conta inicial de <span className="text-amber-300">Administrador</span>. Sem e-mail — apenas usuário e senha local.
              </p>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Depois você poderá cadastrar Mestres, Jogadores e Observadores no painel de Usuários.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-100 leading-relaxed">
                Entre com o usuário e senha fornecidos pelo administrador da mesa.
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Login simples sem e-mail • Controle local por nível de permissão.
              </p>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Username */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Usuário</span>
              <span className="text-[10px] text-slate-500 font-mono">Sem e-mail</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder={needsSetup ? 'admin' : 'ex: admin, mestre, jogador1'}
                autoComplete="username"
                disabled={loading || checkingMode}
                autoFocus
                className="w-full bg-black/70 border border-white/20 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 font-mono focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
              />
            </div>
          </div>

          {/* Display Name (only on initial admin setup) */}
          {needsSetup && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Nome de Exibição</span>
                <span className="text-[10px] text-slate-500">Opcional</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ex: Mestre Principal"
                maxLength={60}
                disabled={loading || checkingMode}
                className="w-full bg-black/70 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
              />
            </div>
          )}

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Senha</span>
              {needsSetup && (
                <span className="text-[10px] text-slate-500 font-mono">Mínimo 6 caracteres</span>
              )}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder={needsSetup ? 'Crie uma senha segura...' : 'Digite sua senha...'}
                autoComplete={needsSetup ? 'new-password' : 'current-password'}
                disabled={loading || checkingMode}
                className="w-full bg-black/70 border border-white/20 rounded-xl pl-10 pr-11 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 font-mono focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition cursor-pointer"
                title={showPassword ? 'Ocultar senha' : 'Revelar senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password on first-run setup */}
          {needsSetup && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-300">Confirmar Senha</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Repita a senha escolhida..."
                autoComplete="new-password"
                disabled={loading || checkingMode}
                className="w-full bg-black/70 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 font-mono focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
              />
            </div>
          )}

          {errorMsg && (
            <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-500/30 rounded-lg p-2.5 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || checkingMode}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-sm tracking-wide shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
          >
            {loading || checkingMode ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>{needsSetup ? 'Criar Administrador e Entrar' : 'Entrar'}</span>
                <Sparkles className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-[11px] text-slate-500 font-mono">
          100% Local &bull; Controle por Administrador &bull; Sem E-mail
        </div>
      </div>
    </div>
  );
};
