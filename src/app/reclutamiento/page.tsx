'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Send, CheckCircle2, AlertTriangle, PackageOpen } from 'lucide-react';

type LocalUser = {
  id: number;
  username: string;
};

type RecruitInviteRow = {
  id: number;
  recruiter_account_id: number;
  recruiter_username: string;
  friend_name: string;
  friend_email: string;
  status: 'invited' | 'registered' | 'rewarded';
  recruited_account_id: number | null;
  recruited_username: string | null;
  starter_bags_claimed: number;
  recruit_reward_given: number;
  recruited_max_level?: number;
  level80_claimable?: boolean;
  accepted_at: string | null;
  created_at: string;
};

type RecruitStatusResponse = {
  recruiterInvites: RecruitInviteRow[];
  recruitedEntry: RecruitInviteRow | null;
};

type CharacterOption = {
  guid: number;
  name: string;
  level: number;
  online: number;
};

export default function ReclutamientoPage() {
  const router = useRouter();
  const [user, setUser] = useState<LocalUser | null>(null);
  const [activeTab, setActiveTab] = useState<'invite' | 'friends' | 'help'>('invite');

  const [friendName, setFriendName] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusData, setStatusData] = useState<RecruitStatusResponse>({ recruiterInvites: [], recruitedEntry: null });
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [selectedStarterGuid, setSelectedStarterGuid] = useState<number>(0);

  const [claimingStarter, setClaimingStarter] = useState(false);
  const [claimingRewardId, setClaimingRewardId] = useState<number | null>(null);
  const [resendingInviteId, setResendingInviteId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadStatus = async (accountId: number) => {
    setLoadingStatus(true);
    setError('');
    try {
      const response = await fetch(`/api/recruit/status?accountId=${accountId}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'No se pudo cargar el estado de reclutamiento.');

      setStatusData({
        recruiterInvites: Array.isArray(data?.recruiterInvites) ? data.recruiterInvites : [],
        recruitedEntry: data?.recruitedEntry || null,
      });
    } catch (err: any) {
      setStatusData({ recruiterInvites: [], recruitedEntry: null });
      setError(String(err?.message || 'Error desconocido'));
    } finally {
      setLoadingStatus(false);
    }
  };

  const loadCharacters = async (accountId: number) => {
    try {
      const response = await fetch(`/api/characters?accountId=${accountId}`, { cache: 'no-store' });
      const data = await response.json();
      const rows = Array.isArray(data?.characters) ? data.characters : [];
      const normalized: CharacterOption[] = rows
        .map((row: any) => ({
          guid: Number(row?.guid || 0),
          name: String(row?.name || ''),
          level: Number(row?.level || 0),
          online: Number(row?.online || 0),
        }))
        .filter((row: CharacterOption) => row.guid > 0 && !!row.name);

      setCharacters(normalized);
      setSelectedStarterGuid((prev) => {
        if (prev > 0 && normalized.some((char) => char.guid === prev)) return prev;
        return normalized[0]?.guid || 0;
      });
    } catch {
      setCharacters([]);
      setSelectedStarterGuid(0);
    }
  };

  useEffect(() => {
    const rawUser = localStorage.getItem('user');
    if (!rawUser) {
      router.push('/');
      return;
    }

    try {
      const parsed = JSON.parse(rawUser) as LocalUser;
      if (!Number.isInteger(Number(parsed?.id)) || Number(parsed.id) <= 0) {
        router.push('/');
        return;
      }
      setUser(parsed);
      const accountId = Number(parsed.id);
      loadStatus(accountId);
      loadCharacters(accountId);
    } catch {
      router.push('/');
    }
  }, [router]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSendingInvite(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/recruit/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recruiterAccountId: user.id,
          friendName: friendName.trim(),
          friendEmail: friendEmail.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'No se pudo enviar la invitacion.');

      const referralId = Number(data?.referralId || 0);
      const emailDeliveryId = String(data?.emailDeliveryId || '').trim();
      const successMessageBase = String(data?.message || 'Invitacion enviada con exito.').trim();
      const successParts = [successMessageBase];

      if (referralId > 0) {
        successParts.push(`ID de reclutamiento: ${referralId}`);
      }
      if (emailDeliveryId) {
        successParts.push(`ID de correo: ${emailDeliveryId}`);
      }

      setMessage(successParts.join(' | '));
      setFriendName('');
      setFriendEmail('');
      await loadStatus(user.id);
      setActiveTab('friends');
    } catch (err: any) {
      setError(String(err?.message || 'Error desconocido'));
    } finally {
      setSendingInvite(false);
    }
  };

  const handleClaimStarter = async () => {
    if (!user) return;
    if (!Number.isInteger(selectedStarterGuid) || selectedStarterGuid <= 0) {
      setError('Debes seleccionar un personaje para recibir el kit inicial.');
      return;
    }

    setClaimingStarter(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/recruit/claim-starter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: user.id, targetCharacterGuid: selectedStarterGuid }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'No se pudo reclamar el kit inicial.');

      setMessage(data?.message || 'Kit inicial reclamado.');
      await loadStatus(user.id);
    } catch (err: any) {
      setError(String(err?.message || 'Error desconocido'));
    } finally {
      setClaimingStarter(false);
    }
  };

  const handleClaimLevel80 = async (referralId: number) => {
    if (!user) return;

    setClaimingRewardId(referralId);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/recruit/claim-level80', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: user.id, referralId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'No se pudo recuperar estelas.');

      setMessage(data?.message || 'Estelas recuperadas correctamente.');
      await loadStatus(user.id);
    } catch (err: any) {
      setError(String(err?.message || 'Error desconocido'));
    } finally {
      setClaimingRewardId(null);
    }
  };

  const handleResendInvite = async (referralId: number) => {
    if (!user) return;

    setResendingInviteId(referralId);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/recruit/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: user.id, referralId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'No se pudo reenviar la invitacion.');

      const resultReferralId = Number(data?.referralId || 0);
      const emailDeliveryId = String(data?.emailDeliveryId || '').trim();
      const successMessageBase = String(data?.message || 'Invitacion reenviada con exito.').trim();
      const successParts = [successMessageBase];

      if (resultReferralId > 0) {
        successParts.push(`ID de reclutamiento: ${resultReferralId}`);
      }
      if (emailDeliveryId) {
        successParts.push(`ID de correo: ${emailDeliveryId}`);
      }

      setMessage(successParts.join(' | '));
      await loadStatus(user.id);
    } catch (err: any) {
      setError(String(err?.message || 'Error desconocido'));
    } finally {
      setResendingInviteId(null);
    }
  };

  const recruitStats = useMemo(() => {
    const invites = statusData.recruiterInvites || [];
    const total = invites.length;
    const registered = invites.filter((row) => row.status === 'registered' || row.status === 'rewarded').length;
    const rewarded = invites.filter((row) => row.status === 'rewarded').length;
    return { total, registered, rewarded };
  }, [statusData.recruiterInvites]);

  const recruiterRewardRows = useMemo(() => {
    return (statusData.recruiterInvites || []).filter((row) => row.status !== 'invited');
  }, [statusData.recruiterInvites]);

  return (
    <main
      className="min-h-screen pt-28 pb-16 text-white"
      style={{
        backgroundImage: "url('/fono.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="rounded-3xl border border-cyan-500/25 bg-[#08141d]/85 p-6 sm:p-8 shadow-[0_20px_70px_rgba(8,20,29,0.5)] backdrop-blur-md">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">Recluta un Amigo</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-300">
            Estado de Reclutaciones
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-200 leading-relaxed">
            Invita amigos por correo con enlace especial de registro. Al llegar el reclutado a nivel 80: +2 Estelas para quien recluta y +3 para el reclutado.
          </p>

          <div className="mt-6 rounded-xl overflow-hidden border border-cyan-300/20 bg-gradient-to-r from-[#2a3444] via-[#374151] to-[#2a3444] shadow-[0_10px_28px_rgba(2,8,20,0.35)]">
            <div className="grid grid-cols-1 sm:grid-cols-3">
              <button type="button" onClick={() => setActiveTab('invite')} className={`px-4 py-3 text-center justify-center text-sm font-black uppercase tracking-wide border-b sm:border-b-0 sm:border-r border-cyan-200/15 transition-all ${activeTab === 'invite' ? 'bg-cyan-500/20 text-cyan-100 shadow-[inset_0_-2px_0_rgba(103,232,249,.65)]' : 'bg-black/10 text-slate-100 hover:bg-cyan-500/10 hover:text-cyan-50'}`}>
                Enviar invitaciones
              </button>
              <button type="button" onClick={() => setActiveTab('friends')} className={`px-4 py-3 text-center justify-center text-sm font-black uppercase tracking-wide border-b sm:border-b-0 sm:border-r border-cyan-200/15 transition-all ${activeTab === 'friends' ? 'bg-cyan-500/20 text-cyan-100 shadow-[inset_0_-2px_0_rgba(103,232,249,.65)]' : 'bg-black/10 text-slate-100 hover:bg-cyan-500/10 hover:text-cyan-50'}`}>
                Tus amigos y recompensas
              </button>
              <button type="button" onClick={() => setActiveTab('help')} className={`px-4 py-3 text-center justify-center text-sm font-black uppercase tracking-wide transition-all ${activeTab === 'help' ? 'bg-cyan-500/20 text-cyan-100 shadow-[inset_0_-2px_0_rgba(103,232,249,.65)]' : 'bg-black/10 text-slate-100 hover:bg-cyan-500/10 hover:text-cyan-50'}`}>
                ¿Como funciona?
              </button>
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> {message}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {error}
            </div>
          )}

          {activeTab === 'invite' && (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <form onSubmit={handleSendInvite} className="lg:col-span-2 rounded-2xl border border-cyan-500/25 bg-black/30 p-5 space-y-4">
                <div>
                  <label className="text-[11px] uppercase tracking-widest font-black text-cyan-300">Nombre del amigo</label>
                  <input value={friendName} onChange={(e) => setFriendName(e.target.value)} placeholder="Ej: Thrall" className="mt-1 w-full bg-black/50 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400/60" required />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-widest font-black text-cyan-300">Correo del amigo</label>
                  <input value={friendEmail} onChange={(e) => setFriendEmail(e.target.value)} placeholder="correo@ejemplo.com" type="email" className="mt-1 w-full bg-black/50 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400/60" required />
                </div>
                <button type="submit" disabled={sendingInvite || !user} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 px-5 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50 min-w-[205px]">
                  <Send className="h-4 w-4" /> {sendingInvite ? 'Enviando...' : 'Enviar invitacion'}
                </button>
              </form>

              <div className="rounded-2xl border border-white/15 bg-black/30 p-5 space-y-3">
                <p className="text-[11px] uppercase tracking-widest text-gray-300 font-black">Resumen</p>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-gray-300 uppercase tracking-wide">Invitaciones</p><p className="text-xl font-black text-white">{recruitStats.total}</p></div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-gray-300 uppercase tracking-wide">Registrados</p><p className="text-xl font-black text-cyan-300">{recruitStats.registered}</p></div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-xs text-gray-300 uppercase tracking-wide">Con recompensa 80</p><p className="text-xl font-black text-emerald-300">{recruitStats.rewarded}</p></div>
              </div>
            </div>
          )}

          {activeTab === 'friends' && (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/15 bg-black/30 overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1.2fr_1fr_1fr] gap-2 px-4 py-3 bg-white/5 text-[11px] font-black uppercase tracking-widest text-gray-300">
                  <p>Amigo</p><p>Correo</p><p>Estado</p><p>Recompensas</p>
                </div>

                {loadingStatus ? (
                  <div className="px-4 py-5 text-sm text-gray-300">Cargando...</div>
                ) : statusData.recruiterInvites.length === 0 ? (
                  <div className="px-4 py-5 text-sm text-gray-300">No has enviado invitaciones aun.</div>
                ) : (
                  statusData.recruiterInvites.map((row) => (
                    <div key={row.id} className="grid grid-cols-1 sm:grid-cols-[1.2fr_1.2fr_1fr_1fr] gap-2 px-4 py-3 border-t border-white/10 text-sm">
                      <p className="text-white font-semibold truncate">{row.friend_name}</p>
                      <p className="text-gray-300 truncate">{row.friend_email}</p>
                      <p className={`font-black uppercase text-xs ${row.status === 'rewarded' ? 'text-emerald-300' : row.status === 'registered' ? 'text-cyan-300' : 'text-amber-300'}`}>{row.status}</p>
                      <div className="flex flex-col items-start gap-2">
                        <p className="text-gray-200 text-xs">
                          {row.status === 'rewarded'
                            ? '+2 Estelas otorgadas'
                            : row.status === 'registered'
                              ? `Nivel reclutado: ${Number(row.recruited_max_level || 0)} / 80`
                              : 'Esperando registro'}
                        </p>
                        {row.status === 'invited' && (
                          <button
                            type="button"
                            onClick={() => handleResendInvite(Number(row.id))}
                            disabled={resendingInviteId === Number(row.id)}
                            className={`inline-flex h-8 items-center justify-center gap-2 rounded-lg px-3 text-[10px] font-black uppercase tracking-wider border ${
                              resendingInviteId === Number(row.id)
                                ? 'border-gray-600/40 bg-gray-800/30 text-gray-400 cursor-not-allowed'
                                : 'border-cyan-300/45 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/30'
                            }`}
                          >
                            <Send className="h-3.5 w-3.5" />
                            {resendingInviteId === Number(row.id) ? 'Reenviando...' : 'Reenviar correo'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {recruiterRewardRows.length > 0 && (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-200">Recompensa del reclutador</p>
                  <p className="mt-1 text-sm text-emerald-100">Aqui puedes recoger tus estelas por cada amigo reclutado cuando llegue a nivel 80.</p>

                  <div className="mt-4 space-y-3">
                    {recruiterRewardRows.map((row) => {
                      const claimed = Number(row.recruit_reward_given || 0) === 1;
                      const loading = claimingRewardId === Number(row.id);
                      const claimable = !!row.level80_claimable;

                      return (
                        <div key={`recruiter-reward-${row.id}`} className="rounded-xl border border-white/15 bg-black/25 p-3">
                          <p className="text-sm font-bold text-white">{row.friend_name}</p>
                          <p className="text-xs text-gray-300 mt-1">{claimed ? 'Recompensa ya reclamada.' : `Progreso del reclutado: ${Number(row.recruited_max_level || 0)}/80`}</p>

                          {!claimed && (
                            <button
                              type="button"
                              onClick={() => handleClaimLevel80(Number(row.id))}
                              disabled={loading || !claimable}
                              className={`mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-[10px] font-black uppercase tracking-wider border ${
                                loading
                                  ? 'border-gray-600/40 bg-gray-800/30 text-gray-400 cursor-not-allowed'
                                  : claimable
                                    ? 'border-emerald-300/45 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/35'
                                    : 'border-gray-600/40 bg-gray-800/30 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              {loading
                                ? 'Recogiendo...'
                                : claimable
                                  ? `Recoger tu recompensa por reclutar a ${row.friend_name}`
                                  : `Aun no disponible (${Number(row.recruited_max_level || 0)}/80)`}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!!statusData.recruitedEntry && (
                <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-5">
                  <p className="text-xs font-black uppercase tracking-widest text-cyan-200">Tu cuenta fue reclutada</p>
                  <p className="mt-1 text-sm text-cyan-100">Puedes reclamar aqui tus 4 bolsas de bienvenida, 300g y tus estelas al llegar a nivel 80.</p>

                  <div className="mt-4 max-w-md">
                    <label className="text-[11px] uppercase tracking-widest font-black text-cyan-200">Personaje para kit inicial</label>
                    <select
                      value={selectedStarterGuid || ''}
                      onChange={(e) => setSelectedStarterGuid(Number(e.target.value || 0))}
                      disabled={claimingStarter || Number(statusData.recruitedEntry.starter_bags_claimed || 0) === 1 || characters.length === 0}
                      className="mt-1 w-full bg-black/50 border border-white/15 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-300/60 disabled:opacity-60"
                    >
                      {characters.length === 0 && <option value="">No hay personajes disponibles</option>}
                      {characters.map((char) => (
                        <option key={char.guid} value={char.guid}>
                          {char.name} - Nivel {char.level}{char.online === 1 ? ' (Online)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row sm:items-stretch gap-3">
                    <button
                      type="button"
                      onClick={handleClaimStarter}
                      disabled={claimingStarter || Number(statusData.recruitedEntry.starter_bags_claimed || 0) === 1 || selectedStarterGuid <= 0}
                      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-xs font-black uppercase tracking-widest border flex-1 sm:flex-none sm:min-w-[260px] ${claimingStarter || Number(statusData.recruitedEntry.starter_bags_claimed || 0) === 1 || selectedStarterGuid <= 0 ? 'border-gray-600/40 bg-gray-800/30 text-gray-400 cursor-not-allowed' : 'border-cyan-300/45 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white'}`}
                    >
                      <PackageOpen className="h-4 w-4" />
                      {Number(statusData.recruitedEntry.starter_bags_claimed || 0) === 1 ? 'Kit inicial ya reclamado' : claimingStarter ? 'Reclamando...' : 'Reclamar 4 bolsas + 300g'}
                    </button>

                    {Number(statusData.recruitedEntry.recruit_reward_given || 0) === 0 && (
                      <button
                        type="button"
                        onClick={() => handleClaimLevel80(Number(statusData.recruitedEntry?.id || 0))}
                        disabled={claimingRewardId === Number(statusData.recruitedEntry?.id || 0) || !statusData.recruitedEntry.level80_claimable}
                        className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-xs font-black uppercase tracking-widest border flex-1 sm:flex-none sm:min-w-[260px] ${
                          claimingRewardId === Number(statusData.recruitedEntry?.id || 0)
                            ? 'border-gray-600/40 bg-gray-800/30 text-gray-400 cursor-not-allowed'
                            : statusData.recruitedEntry.level80_claimable
                              ? 'border-emerald-300/45 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/35'
                              : 'border-gray-600/40 bg-gray-800/30 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {claimingRewardId === Number(statusData.recruitedEntry?.id || 0)
                          ? 'Recuperando...'
                          : statusData.recruitedEntry.level80_claimable
                            ? 'Reclamar recompensa nivel 80'
                            : `Aun no disponible (${Number(statusData.recruitedEntry.recruited_max_level || 0)}/80)`}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'help' && (
            <div className="mt-6 rounded-2xl border border-white/15 bg-black/30 p-5 space-y-3 text-sm text-gray-200 leading-relaxed">
              <p className="font-black uppercase tracking-widest text-cyan-200 text-xs">Reglas del sistema</p>
              <p>1. Invitas a tu amigo con nombre + correo desde esta pagina.</p>
              <p>2. Tu amigo crea su cuenta usando el enlace especial recibido por email.</p>
              <p>3. Por ser reclutado, puede reclamar 4 bolsas de bienvenida en la pestaña de recompensas.</p>
              <p>4. El reclutado tambien recibe 300g en ese mismo reclamo inicial y puede elegir el personaje destino.</p>
              <p>5. Cuando el reclutado llegue por primera vez a nivel 80, el reclutador podra usar el boton Recoger tu recompensa por reclutar a [nombre].</p>
              <p>6. Al reclamar, el reclutador recibe 2 Estelas y el reclutado 3 Estelas.</p>
              <p>7. La recompensa de nivel 80 se otorga una sola vez por reclutado.</p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/dashboard" className="inline-flex items-center justify-center rounded-xl border border-slate-300/25 bg-slate-500/20 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-100 hover:bg-slate-500/30 min-w-[190px]">Volver al Dashboard</Link>
            <Link href="/migraciones" className="inline-flex items-center justify-center rounded-xl border border-amber-300/35 bg-amber-500/15 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-amber-100 hover:bg-amber-500/25 min-w-[190px]">Ir a Migraciones</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
