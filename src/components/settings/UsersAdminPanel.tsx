import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserMinus,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import {
  apiFetch,
  type ApiScope,
  type AuthUser,
  clearAuthSession,
  ROLE_META,
  setAuthSession,
  type UserRole,
  useAuthSession,
} from '../../lib/authSession';

const ALL_ROLES: UserRole[] = ['admin', 'gm', 'player', 'viewer'];

const SCOPE_LABELS: Record<ApiScope, string> = {
  read: 'Leitura',
  write: 'Escrita CRUD',
  roll: 'Rolar Dados',
  generate: 'Oráculo & Forja',
};

export const UsersAdminPanel: React.FC = () => {
  const { token, user: currentUser } = useAuthSession();
  const isAdmin = currentUser?.role === 'admin';

  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Change own password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newOwnPassword, setNewOwnPassword] = useState('');
  const [confirmOwnPassword, setConfirmOwnPassword] = useState('');
  const [changingOwnPwd, setChangingOwnPwd] = useState(false);

  // Admin create user form state
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>('player');
  const [creatingUser, setCreatingUser] = useState(false);

  // Per-row actions state
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [resetPwdUserId, setResetPwdUserId] = useState<string | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState('');
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);

  const notify = (type: 'ok' | 'err', text: string) => {
    setBanner({ type, text });
    window.setTimeout(() => {
      setBanner((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    try {
      const res = await apiFetch('/api/v1/users');
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setUsers(data.items);
      } else {
        notify('err', data.message || 'Não foi possível carregar os usuários.');
      }
    } catch {
      notify('err', 'Falha de comunicação com o servidor local.');
    } finally {
      setLoadingUsers(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newOwnPassword) {
      notify('err', 'Preencha a senha atual e a nova senha.');
      return;
    }
    if (newOwnPassword.length < 6) {
      notify('err', 'A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newOwnPassword !== confirmOwnPassword) {
      notify('err', 'A confirmação da nova senha não confere.');
      return;
    }

    setChangingOwnPwd(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword: newOwnPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify('err', data.message || 'Não foi possível alterar a senha.');
        return;
      }

      if (data.sessionToken && data.user) {
        setAuthSession(data.sessionToken, data.user);
      }
      setCurrentPassword('');
      setNewOwnPassword('');
      setConfirmOwnPassword('');
      setShowChangePassword(false);
      notify('ok', 'Sua senha foi atualizada e sessões anteriores foram encerradas.');
    } catch {
      notify('err', 'Erro ao comunicar com o servidor.');
    } finally {
      setChangingOwnPwd(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = newUsername.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(cleanUsername)) {
      notify('err', 'Usuário deve ter de 3 a 32 caracteres (letras, números, ponto, hífen ou underline).');
      return;
    }
    if (newPassword.length < 6) {
      notify('err', 'Defina uma senha inicial com pelo menos 6 caracteres.');
      return;
    }

    setCreatingUser(true);
    try {
      const res = await apiFetch('/api/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          username: cleanUsername,
          displayName: newDisplayName.trim() || undefined,
          password: newPassword,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify('err', data.message || 'Erro ao criar usuário.');
        return;
      }

      setNewUsername('');
      setNewDisplayName('');
      setNewPassword('');
      setNewRole('player');
      await loadUsers();
      notify('ok', `Usuário @${data.username} (${ROLE_META[data.role as UserRole].label}) criado!`);
    } catch {
      notify('err', 'Erro de rede ao criar usuário.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateUser = async (
    target: AuthUser,
    patch: { role?: UserRole; active?: boolean; password?: string; displayName?: string },
    successMsg: string
  ) => {
    setBusyUserId(target.id);
    try {
      const res = await apiFetch(`/api/v1/users/${encodeURIComponent(target.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        notify('err', data.message || 'Não foi possível atualizar o usuário.');
        return;
      }

      // If admin updated their own session-sensitive field, refresh in-memory token cleanly
      if (target.id === currentUser?.id) {
        const nextToken = data.sessionToken || token;
        const { sessionToken: _ignored, ...cleanUser } = data;
        setAuthSession(nextToken, cleanUser as AuthUser);
      }

      setResetPwdUserId(null);
      setResetPwdValue('');
      await loadUsers();
      notify('ok', successMsg);
    } catch {
      notify('err', 'Erro de rede ao atualizar usuário.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDeleteUser = async (target: AuthUser) => {
    setBusyUserId(target.id);
    try {
      const res = await apiFetch(`/api/v1/users/${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        notify('err', data.message || 'Não foi possível excluir o usuário.');
        return;
      }
      setConfirmDeleteUserId(null);
      await loadUsers();
      notify('ok', `Usuário @${target.username} removido.`);
    } catch {
      notify('err', 'Erro de rede ao excluir usuário.');
    } finally {
      setBusyUserId(null);
    }
  };

  if (!currentUser) return null;

  const currentRoleMeta = ROLE_META[currentUser.role];

  return (
    <div className="space-y-4">
      {banner && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
            banner.type === 'ok'
              ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40'
              : 'bg-rose-500/15 text-rose-200 border-rose-400/40'
          }`}
        >
          {banner.type === 'ok' ? (
            <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Minha Conta */}
      <div className="rounded-2xl glass-panel p-4 border border-white/10 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-200 font-black text-base shrink-0">
              {currentUser.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-black text-white truncate">{currentUser.displayName}</h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentRoleMeta.badgeClass}`}
                >
                  {currentRoleMeta.label}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">@{currentUser.username}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentUser.id !== 'env-admin' && (
              <button
                type="button"
                onClick={() => setShowChangePassword((v) => !v)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-cyan-300" />
                <span>Alterar Senha</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => clearAuthSession()}
              className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-xs font-bold text-rose-200 flex items-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-black/35 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span className="text-slate-300">{currentRoleMeta.description}</span>
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {currentUser.scopes.map((scope) => (
              <span
                key={scope}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-cyan-200"
              >
                {SCOPE_LABELS[scope]}
              </span>
            ))}
          </div>
        </div>

        {/* Change Own Password Form */}
        {showChangePassword && (
          <form
            onSubmit={handleChangeOwnPassword}
            className="p-3.5 rounded-xl bg-black/45 border border-cyan-500/30 space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-200">
              <Lock className="w-3.5 h-3.5" />
              <span>Trocar Minha Senha</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Senha atual"
                autoComplete="current-password"
                className="px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <input
                type="password"
                value={newOwnPassword}
                onChange={(e) => setNewOwnPassword(e.target.value)}
                placeholder="Nova senha (mín. 6)"
                autoComplete="new-password"
                className="px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <input
                type="password"
                value={confirmOwnPassword}
                onChange={(e) => setConfirmOwnPassword(e.target.value)}
                placeholder="Confirmar nova senha"
                autoComplete="new-password"
                className="px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowChangePassword(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={changingOwnPwd}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-400/50 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{changingOwnPwd ? 'Salvando...' : 'Salvar Nova Senha'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Role Legend */}
      <div className="rounded-2xl glass-panel p-4 border border-white/10 space-y-2.5">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs sm:text-sm font-bold text-white">Níveis de Permissão</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {ALL_ROLES.map((r) => {
            const meta = ROLE_META[r];
            return (
              <div key={r} className="p-2.5 rounded-xl bg-black/35 border border-white/10 space-y-1">
                <span
                  className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.badgeClass}`}
                >
                  {meta.label}
                </span>
                <p className="text-[11px] text-slate-400 leading-snug">{meta.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Admin-only User Management */}
      {!isAdmin ? (
        <div className="rounded-2xl glass-panel p-4 border border-white/10 text-xs text-slate-400 flex items-center gap-2.5">
          <UserCog className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            O cadastro, edição de níveis de permissão e bloqueio de contas são controlados exclusivamente pelo Administrador.
          </span>
        </div>
      ) : (
        <div className="rounded-2xl glass-panel p-4 border border-white/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  Gerenciamento de Usuários ({users.length})
                </h3>
                <p className="text-[11px] text-slate-400">
                  Cadastre contas locais sem e-mail, defina níveis de permissão, redefina senhas ou desative acessos.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadUsers}
              disabled={loadingUsers}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
          </div>

          {/* Create User Form */}
          <form
            onSubmit={handleCreateUser}
            className="p-3.5 rounded-xl bg-black/35 border border-white/10 space-y-3"
          >
            <div className="text-xs font-bold text-cyan-200 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Usuário (sem e-mail)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Usuário (ex: lucas, gm2)"
                maxLength={32}
                className="px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="Nome de exibição (opcional)"
                maxLength={60}
                className="px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Senha inicial (mín. 6)"
                  maxLength={128}
                  className="w-full px-3 py-2 pr-9 rounded-xl bg-black/60 border border-white/15 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  title={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="px-3 py-2 rounded-xl bg-black/75 border border-white/15 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r} className="bg-[#0d0b1a] text-white">
                    {ROLE_META[r].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">{ROLE_META[newRole].description}</span>
              <button
                type="submit"
                disabled={creatingUser}
                className="px-4 py-2 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-400/50 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{creatingUser ? 'Criando...' : 'Criar Usuário'}</span>
              </button>
            </div>
          </form>

          {/* Users List */}
          {users.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              Nenhum usuário cadastrado no banco local.
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => {
                const isSelf = u.id === currentUser.id;
                const isBusy = busyUserId === u.id;
                const roleMeta = ROLE_META[u.role];

                return (
                  <div
                    key={u.id}
                    className={`p-3 rounded-xl border space-y-2.5 transition ${
                      u.active
                        ? 'bg-black/40 border-white/10'
                        : 'bg-black/25 border-white/5 opacity-65'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">{u.displayName}</span>
                          <code className="text-[11px] px-1.5 py-0.5 rounded bg-white/5 text-cyan-300 font-mono">
                            @{u.username}
                          </code>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleMeta.badgeClass}`}
                          >
                            {roleMeta.shortLabel}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                              Você
                            </span>
                          )}
                          {!u.active && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/30">
                              Desativado
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 flex-wrap">
                          <span>
                            {u.lastLoginAt
                              ? `Último acesso: ${new Date(u.lastLoginAt).toLocaleString('pt-BR')}`
                              : 'Nunca acessou'}
                          </span>
                          <span>•</span>
                          <span>Permissões: {u.scopes.map((s) => SCOPE_LABELS[s]).join(', ')}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Role selector */}
                        <select
                          aria-label={`Nível de permissão de ${u.username}`}
                          value={u.role}
                          disabled={isBusy}
                          onChange={(e) => {
                            const nextRole = e.target.value as UserRole;
                            handleUpdateUser(
                              u,
                              { role: nextRole },
                              `Nível de @${u.username} alterado para ${ROLE_META[nextRole].label}.`
                            );
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-black/70 border border-white/15 text-xs text-slate-100 focus:outline-none focus:border-cyan-400 cursor-pointer disabled:opacity-50"
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r} className="bg-[#0d0b1a] text-white">
                              {ROLE_META[r].label}
                            </option>
                          ))}
                        </select>

                        {/* Reset password toggle */}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            if (resetPwdUserId === u.id) {
                              setResetPwdUserId(null);
                              setResetPwdValue('');
                            } else {
                              setResetPwdUserId(u.id);
                              setResetPwdValue('');
                              setConfirmDeleteUserId(null);
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-slate-200 flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                          title="Redefinir senha do usuário"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-cyan-300" />
                          <span>Senha</span>
                        </button>

                        {/* Active / Inactive toggle */}
                        <button
                          type="button"
                          disabled={isBusy || isSelf}
                          onClick={() =>
                            handleUpdateUser(
                              u,
                              { active: !u.active },
                              u.active
                                ? `Usuário @${u.username} desativado.`
                                : `Usuário @${u.username} reativado.`
                            )
                          }
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            u.active
                              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 border-amber-400/30'
                              : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border-emerald-400/30'
                          }`}
                          title={
                            isSelf
                              ? 'Você não pode desativar sua própria conta'
                              : u.active
                              ? 'Desativar acesso'
                              : 'Reativar acesso'
                          }
                        >
                          {u.active ? (
                            <>
                              <UserMinus className="w-3.5 h-3.5" />
                              <span>Desativar</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Ativar</span>
                            </>
                          )}
                        </button>

                        {/* Delete (two-step inline confirmation) */}
                        {!isSelf && (
                          confirmDeleteUserId === u.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleDeleteUser(u)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUserId(null)}
                                className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs cursor-pointer"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setConfirmDeleteUserId(u.id);
                                setResetPwdUserId(null);
                              }}
                              className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 border border-rose-500/30 transition cursor-pointer disabled:opacity-50"
                              title="Excluir usuário"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Inline Password Reset Box */}
                    {resetPwdUserId === u.id && (
                      <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="password"
                          value={resetPwdValue}
                          onChange={(e) => setResetPwdValue(e.target.value)}
                          placeholder={`Nova senha para @${u.username} (mín. 6 caracteres)...`}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-black/70 border border-cyan-500/40 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy || resetPwdValue.length < 6}
                            onClick={() =>
                              handleUpdateUser(
                                u,
                                { password: resetPwdValue },
                                `Senha de @${u.username} redefinida com sucesso.`
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-400/40 text-xs font-bold disabled:opacity-40 cursor-pointer"
                          >
                            Salvar Senha
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResetPwdUserId(null);
                              setResetPwdValue('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
