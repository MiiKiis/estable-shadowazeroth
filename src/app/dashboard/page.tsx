'use client';
// Precio para desbloquear cambio libre de avatar
const AVATAR_UNLOCK_VP = 30;
const AVATAR_UNLOCK_DP = 1;
const GM_AVATARS = [
  '3Adams.gif',
  'enoyls.gif',
  'mumper.gif',
  'nyeriah.gif',
  'shivan.gif',
  'ulvareth.gif',
  'zarhym.gif'
];

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { User, Shield, Sword, Sparkles, LogOut, Swords, Skull, CreditCard, X, Check, ChevronLeft, ChevronRight, BookOpen, ChevronDown, History, KeyRound } from 'lucide-react';

const raceMap: Record<number, string> = {
  1: 'Humano', 2: 'Orco', 3: 'Enano', 4: 'Elfo de la Noche', 5: 'No-Muerto',
  6: 'Tauren', 7: 'Gnomo', 8: 'Trol', 10: 'Elfo de Sangre', 11: 'Draenei'
};

const classMap: Record<number, string> = {
  1: 'Guerrero', 2: 'Paladín', 3: 'Cazador', 4: 'Pícaro', 5: 'Sacerdote',
  6: 'Caballero de la Muerte', 7: 'Chamán', 8: 'Mago', 9: 'Brujo', 11: 'Druida'
};

const classColorMap: Record<number, string> = {
  1: 'text-[#C79C6E]', 2: 'text-[#F58CBA]', 3: 'text-[#ABD473]', 4: 'text-[#FFF569]',
  5: 'text-[#FFFFFF]', 6: 'text-[#C41F3B]', 7: 'text-[#0070DE]', 8: 'text-[#69CCF0]',
  9: 'text-[#9482C9]', 11: 'text-[#FF7D0A]'
};

const classIconMap: Record<number, string> = {
  1: '/clases/warrior.png',
  2: '/clases/paladin.png',
  3: '/clases/hunter.png',
  4: '/clases/rogue.png',
  5: '/clases/priest.png',
  6: '/clases/deathknight.png',
  7: '/clases/shaman.png',
  8: '/clases/mage.png',
  9: '/clases/warlock.png',
  11: '/clases/druid.png'
};

type DashboardUser = {
  id: number;
  username: string;
};

type DashboardCharacter = {
  guid: number;
  name: string;
  class: number;
  level: number;
  race: number;
  money: number;
  online: number;
};

type PurchaseHistoryRow = {
  id: number;
  item_id: number;
  item_name: string;
  currency: 'vp' | 'dp';
  price: number;
  character_name: string;
  is_gift: number;
  created_at: string;
};

// Precio para desbloquear cambio libre de avatar

// Lista de avatares exclusivos para rango 3 (GM)
// ...existing code...

export default function Dashboard() {
    // Handler for avatar unlock button
    const handleUnlockAvatar = (currency: 'vp' | 'dp') => {
      handleUnlockConfirm(currency);
    };
  const [unlockCurrency, setUnlockCurrency] = useState<'vp' | 'dp' | null>(null);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);

  // Handler to trigger unlock confirmation modal
  const handleUnlockConfirm = (currency: 'vp' | 'dp') => {
    setUnlockCurrency(currency);
    setShowUnlockConfirm(true);
  };
      const [avatarUnlocked, setAvatarUnlocked] = useState(false);
    const [globalError, setGlobalError] = useState<string | null>(null);
  const router = useRouter();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [characters, setCharacters] = useState<DashboardCharacter[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarOptions, setAvatarOptions] = useState<string[]>([]);
  const [avatarEditableAlways, setAvatarEditableAlways] = useState(false);
  const [avatarChangeCostDp, setAvatarChangeCostDp] = useState(1);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarSelection, setAvatarSelection] = useState<string | null>(null);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [avatarModalError, setAvatarModalError] = useState('');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [avatarPage, setAvatarPage] = useState(1);
  const [accountRole, setAccountRole] = useState<'ADALID' | 'GM'>('ADALID');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryRow[]>([]);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityPin, setSecurityPin] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [pointsData, setPointsData] = useState<{ vp: number; dp: number; gmlevel?: number } | null>(null);

  const getClassIconSrc = (classId: number) => classIconMap[classId] || '/clases/warrior.png';

  useEffect(() => {
            // Detectar si el usuario ya hizo el primer cambio gratis
            if (avatarEditableAlways && !avatarUnlocked) {
              setAvatarUnlocked(true);
            }
        // Captura errores globales del cliente
        const handleGlobalError = (event: ErrorEvent) => {
          setGlobalError('Ocurrió un error inesperado en la aplicación. Por favor recarga la página o revisa la consola.');
        };
        window.addEventListener('error', handleGlobalError);
        return () => {
          window.removeEventListener('error', handleGlobalError);
        };
    if (!isAvatarModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAvatarModal();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isAvatarModalOpen]);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      router.push('/');
      return;
    }

    const userData = JSON.parse(storedUser) as DashboardUser;
    setUser(userData);

    const fetchDashboardData = async () => {
      try {
        const [charactersRes, avatarRes, pointsRes] = await Promise.all([
          fetch(`/api/characters?accountId=${userData.id}`),
          fetch(`/api/avatar?accountId=${userData.id}`),
          fetch(`/api/account/points?accountId=${userData.id}`),
        ]);

        const charactersData = await charactersRes.json();
        const avatarData = await avatarRes.json();
        const pointsJson = await pointsRes.json();
        setCharacters(charactersData);
        setAvatar(avatarData.avatar || null);
        setAvatarOptions(Array.isArray(avatarData.options) ? avatarData.options : []);
        setAvatarEditableAlways(!!avatarData.editableAlways);
        setAvatarChangeCostDp(Number(avatarData.changeCostDp || 1));
        setPointsData(pointsJson);

        if (charactersData.characters) {
          setCharacters(charactersData.characters);
        }

        setAvatarOptions(avatarData.avatars || []);
        setAvatar(avatarData.selectedAvatar || null);
        setAvatarSelection(avatarData.selectedAvatar || null);
        setAvatarEditableAlways(!!avatarData.editableAlways);
        setAvatarChangeCostDp(Number(avatarData.changeCostDp || 1));

        const gmlevel = Number(pointsJson?.gmlevel || 0);
        setAccountRole(gmlevel > 0 ? 'GM' : 'ADALID');
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  const openAvatarModal = () => {
    setAvatarSelection(avatar);
    setShowApplyConfirm(false);
    setAvatarModalError('');
    const selectedIndex = avatar ? avatarOptions.findIndex((file) => file === avatar) : -1;
    const pageSize = 12;
    const initialPage = selectedIndex >= 0 ? Math.floor(selectedIndex / pageSize) + 1 : 1;
    setAvatarPage(initialPage);
    setIsAvatarModalOpen(true);
  };

  const closeAvatarModal = () => {
    setIsAvatarModalOpen(false);
    setShowApplyConfirm(false);
    setAvatarModalError('');
  };

  const canEditAvatar = true;

  const openHistoryModal = async () => {
    if (!user) return;

    setAccountMenuOpen(false);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryError('');

    try {
      const response = await fetch(`/api/account/purchases?accountId=${user.id}&limit=80`, { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo cargar el historial de compras');
      }

      setPurchaseHistory(Array.isArray(data.purchases) ? data.purchases : []);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al cargar historial';
      setHistoryError(message);
      setPurchaseHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openPasswordModal = () => {
    setAccountMenuOpen(false);
    setPasswordError('');
    setPasswordSuccess('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSecurityPin('');
    setIsPasswordModalOpen(true);
  };

  const submitPasswordChange = async () => {
    if (!user || passwordSaving) return;

    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword || !securityPin) {
      setPasswordError('Completa todos los campos.');
      return;
    }

    if (!/^\d{4}$/.test(securityPin.trim())) {
      setPasswordError('Debes ingresar tu PIN de 4 digitos.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('La confirmacion no coincide con la nueva contraseña.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setPasswordSaving(true);

    try {
      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: user.id,
          currentPassword,
          newPassword,
          pin: securityPin,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo cambiar la contraseña');
      }

      setPasswordSuccess('Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSecurityPin('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al cambiar contraseña';
      setPasswordError(message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const formatPurchaseDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('es-ES', { hour12: false });
  };
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(avatarOptions.length / pageSize));
  const pageStart = (avatarPage - 1) * pageSize;
  const visibleAvatars = avatarOptions.slice(pageStart, pageStart + pageSize);
  const midpoint = Math.ceil(visibleAvatars.length / 2);
  const leftColumnAvatars = visibleAvatars.slice(0, midpoint);
  const rightColumnAvatars = visibleAvatars.slice(midpoint);

  const saveAvatarSelection = async () => {
        // Si es el primer cambio, no requiere pago
        if (!avatarUnlocked) {
          setAvatarUnlocked(true);
          // ...existing code...
          return;
        }
    if (!user || !avatarSelection || savingAvatar || !canEditAvatar) {
      return;
    }

    setSavingAvatar(true);
    setAvatarModalError('');

    try {
      const response = await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: user.id, avatar: avatarSelection }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar el avatar');
      }

      setAvatar(data.selectedAvatar || avatarSelection);
      setAvatarEditableAlways(!!data.editableAlways);
      setAvatarChangeCostDp(Number(data.changeCostDp || 1));
      closeAvatarModal();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al guardar avatar';
      setAvatarModalError(message);
    } finally {
      setSavingAvatar(false);
    }
  };

  if (!user || loading) {
        if (globalError) {
          return (
            <div className="min-h-screen flex items-center justify-center bg-black text-red-400 text-xl font-bold">
              {globalError}
            </div>
          );
        }
    return (
      <div 
        className="min-h-screen flex items-center justify-center relative overflow-x-hidden"
        style={{
          backgroundImage: "url('/fono.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 w-16 h-16 border-4 border-purple-900 border-t-purple-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen text-gray-100 py-28 sm:py-32 px-4 sm:px-6 font-sans relative overflow-x-hidden"
      style={{
        backgroundImage: "url('/fono.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-black/60" />
      <div className="pointer-events-none absolute -z-10 top-16 left-1/2 -translate-x-1/2 h-72 w-[90vw] rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -z-10 bottom-0 right-8 h-72 w-72 rounded-full bg-purple-700/20 blur-3xl" />
      <div className="pointer-events-none absolute top-0 left-0 w-full h-[1px] bg-purple-900/30" />

      <div className="w-full max-w-[1800px] mx-auto space-y-12 z-10 relative">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-purple-900/30 pb-10">
          <div>
            <span className="text-[10px] font-black text-purple-600 uppercase tracking-[0.5em] mb-3 block">Fortaleza de Shadow Azeroth</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black italic tracking-tighter text-white uppercase drop-shadow-[0_2px_14px_rgba(0,0,0,0.75)]">
              Panel del <span className="text-purple-600 underline decoration-purple-900/50 underline-offset-8">administracion</span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-4 mb-2">
            <Link
              href="/donate"
              className="inline-flex h-12 items-center gap-2 px-6 bg-gradient-to-r from-[#0f0b08] to-[#1a1109] border border-[#d4af37]/55 text-[#f3dc90] hover:text-white hover:border-[#d4af37] text-xs font-black uppercase tracking-[0.2em] transition-all rounded-2xl shadow-[0_0_18px_rgba(212,175,55,0.22)] hover:shadow-[0_0_30px_rgba(212,175,55,0.45)]"
            >
              <CreditCard className="w-4 h-4" />
              DONACIONES
            </Link>
            <button 
              type="button"
              onClick={handleLogout}
              className="inline-flex h-12 items-center gap-2 px-6 bg-gradient-to-r from-[#1a0909] to-[#2a0d0f] border border-[#8b2e35]/70 text-[#f2c4c8] hover:text-white hover:border-[#b33a44] text-xs font-black uppercase tracking-[0.2em] transition-all rounded-2xl shadow-[0_0_18px_rgba(139,46,53,0.28)] hover:shadow-[0_0_30px_rgba(179,58,68,0.5)]"
            >
              <LogOut className="w-4 h-4" />
              CERRAR SESION
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6 xl:gap-8 items-start">
          {/* User Info Card */}
          <div className="w-full bg-black/55 border border-purple-900/30 p-8 rounded-3xl shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-800 transition-all group-hover:w-2" />
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-[100px] h-[100px] bg-purple-950/20 border border-purple-900/40 rounded-full flex items-center justify-center overflow-hidden">
                  {avatar ? (
                    <Image
                      src={`/avatares/${avatar}`}
                      alt={`Avatar de ${user.username}`}
                      width={100}
                      height={100}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="text-purple-500 w-7 h-7" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter truncate">{user.username}</h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">ID:#{user.id} - {accountRole}</p>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={openAvatarModal}
                  className="block w-full h-12 px-4 bg-purple-700/15 border border-purple-700/35 text-purple-200 hover:text-white hover:bg-purple-700/35 transition-all text-[11px] font-black uppercase tracking-[0.2em] text-center rounded-2xl"
                >
                  {avatar ? 'Cambiar avatar' : 'Elegir avatar'}
                </button>

                <p className="text-[9px] uppercase tracking-[0.18em] text-gray-500 font-bold">
                  {avatarEditableAlways ? 'Cuenta especial: cambio libre de avatar' : `Cambiar avatar cuesta ${avatarChangeCostDp} credito`}
                </p>

                {/* El primer cambio es gratis, después muestra opciones en el modal */}
              </div>
              
              <div className="space-y-4 pt-4 border-t border-purple-900/10">
                 <div className="flex justify-between items-center text-[11px] uppercase tracking-widest">
                   <span className="text-gray-500 font-bold underline decoration-purple-900/20">Personajes</span>
                   <span className="text-white font-black italic">{characters.length} / 10</span>
                 </div>
                 <div className="h-[2px] w-full bg-purple-950/30 overflow-hidden">
                    <div className="h-full bg-purple-600" style={{ width: `${(characters.length / 10) * 100}%` }} />
                 </div>
              </div>
            </div>
          </div>

          {/* Character List Column */}
          <div className="w-full space-y-4 transition-all duration-300">
            <div className="mb-6 flex items-center gap-6">
              <h3 className="text-[10px] font-black text-purple-800 uppercase tracking-[0.4em] flex items-center gap-3">
                <Swords className="w-4 h-4" /> RECUENTO DE BATALLA
              </h3>
              <Link
                href="/armory"
                className="group/armory relative inline-flex items-center text-[10px] font-black text-purple-800 uppercase tracking-[0.35em] hover:text-purple-300 transition-all duration-300"
              >
                <span className="absolute -inset-x-2 -inset-y-1 rounded-md bg-purple-500/0 group-hover/armory:bg-purple-500/10 group-hover/armory:shadow-[0_0_18px_rgba(168,85,247,0.3)] transition-all duration-300" />
                <span className="relative">ARMERIA</span>
                <span className="pointer-events-none absolute -bottom-1 left-0 h-[1px] w-0 bg-gradient-to-r from-cyan-300/80 to-purple-400/80 group-hover/armory:w-full transition-all duration-300" />
              </Link>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 text-[10px] font-black text-purple-800 uppercase tracking-[0.3em] hover:text-purple-300 transition-colors"
                >
                  CUENTA
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {accountMenuOpen && (
                  <div className="absolute top-7 left-0 z-40 w-56 rounded-lg border border-purple-700/50 bg-[#0c0a14]/95 backdrop-blur-md shadow-[0_14px_35px_rgba(0,0,0,0.55)] overflow-hidden">
                    <button
                      type="button"
                      onClick={openHistoryModal}
                      className="w-full px-3 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-200 hover:text-white hover:bg-purple-800/25 transition-colors flex items-center gap-2"
                    >
                      <History className="w-4 h-4 text-cyan-300" />
                      Historial de compras
                    </button>
                    <button
                      type="button"
                      onClick={openPasswordModal}
                      className="w-full px-3 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-200 hover:text-white hover:bg-purple-800/25 transition-colors flex items-center gap-2 border-t border-purple-900/40"
                    >
                      <KeyRound className="w-4 h-4 text-cyan-300" />
                      Cambiar contraseña
                    </button>
                  </div>
                )}
              </div>
            </div>

            {characters.length === 0 ? (
              <div className="bg-[#0f0a0a] border border-purple-900/10 p-16 text-center rounded-sm">
                <Skull className="w-12 h-12 text-purple-900 mx-auto mb-4 opacity-30" />
                <p className="text-gray-600 font-bold uppercase tracking-widest text-xs mb-6">No tienes guerreros registrados.</p>
                <Link href="/" className="px-8 py-3 bg-purple-700/10 border border-purple-900/30 text-purple-500 text-[10px] font-black hover:bg-purple-700 hover:text-white transition-all rounded-sm uppercase tracking-[0.2em]">
                  FORJAR LEYENDA
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 xl:gap-5">
                {characters.map((char) => (
                  <article
                    key={char.guid}
                    className="group flex items-center gap-6 p-6 bg-[#0a0707] border border-purple-900/10 hover:border-purple-600/35 hover:bg-[#0f0a0a] transition-all rounded-sm relative overflow-hidden text-left w-full"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-900/5 -rotate-12 translate-x-12 translate-y-12 blur-2xl pointer-events-none" />

                    <div className="relative w-20 h-20 bg-black border border-purple-900/30 group-hover:border-purple-600 flex items-center justify-center transition-colors overflow-hidden">
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-purple-900/20 to-transparent opacity-50" />
                      <Image
                        src={getClassIconSrc(char.class)}
                        alt={`Icono de clase de ${classMap[char.class] || 'personaje'}`}
                        width={68}
                        height={68}
                        className="h-[68px] w-[68px] object-contain scale-[1.18]"
                      />
                      <span
                        className={`absolute top-1 left-1 h-2.5 w-2.5 rounded-full ${char.online ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.75)]' : 'bg-gray-600'}`}
                        aria-hidden="true"
                      />
                      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-purple-600 text-[8px] font-black text-white italic tracking-tighter shadow-lg">
                        LVL {char.level}
                      </div>
                    </div>

                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-xl font-black italic text-white leading-none tracking-tight truncate">{char.name}</h4>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-[8px] font-black p-1 uppercase tracking-widest border ${char.online ? 'border-green-600 text-green-500 bg-green-500/5' : 'border-gray-800 text-gray-600'}`}>
                            {char.online ? 'ONLINE' : 'RESTING'}
                          </span>
                          <span className="text-[10px] font-bold text-yellow-500 flex items-center gap-1">
                            {Math.floor((char.money || 0) / 10000)} <span className="text-[8px] text-yellow-600">G</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                        <span className="text-[10px] font-black uppercase text-gray-500 flex items-center gap-1.5 tracking-widest">
                          <Sparkles className="w-3 h-3 text-red-900" /> {raceMap[char.race] || 'Raza desconocida'}
                        </span>
                        <span className={`text-[10px] font-black uppercase flex items-center gap-1.5 tracking-widest ${classColorMap[char.class] || 'text-white'}`}>
                          <Sword className="w-3 h-3 opacity-50" /> {classMap[char.class] || 'Clase desconocida'}
                        </span>
                      </div>
                      <p className="text-[9px] uppercase tracking-widest text-purple-500/70 pt-2 font-black">Personaje de tu cuenta</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={closeAvatarModal} />

          <div className="relative w-full max-w-3xl rounded-3xl border border-white/20 bg-[#101826]/95 shadow-2xl backdrop-blur-xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 bg-black/20">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">Seleccionar avatar</h3>
                <p className="text-xs text-slate-300">Página {avatarPage} de {totalPages}</p>
              </div>
              <button
                type="button"
                onClick={closeAvatarModal}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
                aria-label="Cerrar selector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 sm:px-6 pt-4 overflow-y-auto max-h-[calc(90vh-170px)]">
              {!canEditAvatar && (
                <div className="mb-3 rounded-xl border border-amber-200/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  Tu avatar ya está bloqueado para esta cuenta.
                </div>
              )}
              {avatarModalError && (
                <div className="mb-3 rounded-xl border border-rose-200/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  {avatarModalError}
                </div>
              )}

              {showApplyConfirm && avatarSelection && (
                <div className="mb-4 rounded-xl border border-cyan-200/25 bg-cyan-500/10 px-4 py-3 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sm text-cyan-100 font-semibold">
                    <Check className="w-5 h-5" />
                    <span>¿Quieres aplicar este avatar?</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowApplyConfirm(false)}
                      className="h-10 min-w-[90px] px-4 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/15 text-sm font-semibold"
                    >
                      No
                    </button>
                    {/* Si es el primer cambio, solo muestra aplicar */}
                    {!avatarUnlocked ? (
                      <button
                        type="button"
                        onClick={saveAvatarSelection}
                        disabled={savingAvatar || !canEditAvatar}
                        className="h-10 min-w-[140px] px-4 rounded-xl border border-cyan-200/40 bg-cyan-400/20 text-cyan-100 hover:bg-cyan-400/30 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {savingAvatar ? 'Guardando...' : 'Sí, aplicar (gratis)'}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-700 text-white font-bold shadow-md hover:bg-cyan-500 transition-all"
                          onClick={() => handleUnlockAvatar('vp')}
                          disabled={!pointsData || pointsData.vp < AVATAR_UNLOCK_VP || savingAvatar}
                        >
                          Usar 30 VP (tiempo de juego)
                        </button>
                        <button
                          type="button"
                          className="px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-400 to-purple-700 text-black font-bold shadow-md hover:bg-yellow-500 transition-all"
                          onClick={() => handleUnlockAvatar('dp')}
                          disabled={!pointsData || pointsData.dp < AVATAR_UNLOCK_DP || savingAvatar}
                        >
                          Usar 1 DP (Miikii Coins)
                        </button>
                      </>
                    )}
                                  <div className="mb-4 rounded-xl border border-amber-200/25 bg-amber-500/10 px-4 py-3 flex flex-col gap-3">
                                    <div className="flex items-center gap-2 text-sm text-amber-100 font-semibold">
                                      <Check className="w-5 h-5" />
                                      <span>
                                        ¿Seguro que quieres desbloquear el cambio libre de avatar usando {unlockCurrency === 'vp' ? '30 VP (tiempo de juego)' : '1 DP (Miikii Coins)'}?
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setShowUnlockConfirm(false)}
                                        className="h-10 min-w-[90px] px-4 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/15 text-sm font-semibold"
                                      >
                                        No
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          setShowUnlockConfirm(false);
                                          if (!user || !unlockCurrency || savingAvatar) return;
                                          setSavingAvatar(true);
                                          try {
                                            const response = await fetch(`/api/account/unlock-avatar`, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ accountId: user.id, currency: unlockCurrency }),
                                            });
                                            const data = await response.json();
                                            if (!response.ok) {
                                              setAvatarModalError(data.error || 'Error al desbloquear avatar');
                                              return;
                                            }
                                            setAvatarUnlocked(true);
                                            // Actualiza el saldo inmediatamente
                                            setPointsData((prev) => prev ? { ...prev, [unlockCurrency]: prev[unlockCurrency] - (unlockCurrency === 'dp' ? AVATAR_UNLOCK_DP : AVATAR_UNLOCK_VP) } : prev);
                                          } catch (error) {
                                            setAvatarModalError('Error al desbloquear avatar');
                                          } finally {
                                            setSavingAvatar(false);
                                          }
                                        }}
                                        disabled={savingAvatar || !pointsData || pointsData[unlockCurrency || 'dp'] < (unlockCurrency === 'dp' ? AVATAR_UNLOCK_DP : AVATAR_UNLOCK_VP)}
                                        className="h-10 min-w-[140px] px-4 rounded-xl border border-amber-200/40 bg-amber-400/20 text-amber-100 hover:bg-amber-400/30 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                                      >
                                        Sí, desbloquear
                                      </button>
                                    </div>
                                  </div>
                  </div>
                  {avatarUnlocked && (
                    <p className="text-xs text-gray-400 mt-2">Elige la moneda que prefieres gastar. VP se gana por tiempo de juego, DP se obtiene por donaciones.</p>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-white/15 bg-black/30 p-3 sm:p-4 mb-4 overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-3">
                    {leftColumnAvatars.filter(avatarFile => !GM_AVATARS.includes(avatarFile) || accountRole === 'GM').map((avatarFile) => {
                      const isSelected = avatarSelection === avatarFile;
                      const isDisabled = savingAvatar;

                      return (
                        <button
                          key={avatarFile}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            setAvatarSelection(avatarFile);
                            setShowApplyConfirm(true);
                          }}
                          className={`w-full rounded-xl border px-3 py-2.5 bg-white/[0.03] transition-all flex items-center gap-3 ${isSelected ? 'border-cyan-300 border-2 shadow-[0_0_20px_rgba(56,189,248,0.7)] ring-2 ring-cyan-300/60' : 'border-white/15 hover:border-cyan-200/60'} ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className="h-14 w-14 overflow-hidden rounded-full border border-white/20 bg-black shrink-0">
                            <img src={`/avatares/${avatarFile}`} alt={avatarFile} className="h-full w-full object-cover" />
                          </div>
                          <span className="text-xs text-slate-200 truncate">{avatarFile}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-3">
                    {rightColumnAvatars.filter(avatarFile => !GM_AVATARS.includes(avatarFile) || accountRole === 'GM').map((avatarFile) => {
                      const isSelected = avatarSelection === avatarFile;
                      const isDisabled = savingAvatar;

                      return (
                        <button
                          key={avatarFile}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            setAvatarSelection(avatarFile);
                            setShowApplyConfirm(true);
                          }}
                          className={`w-full rounded-xl border px-3 py-2.5 bg-white/[0.03] transition-all flex items-center gap-3 ${isSelected ? 'border-cyan-300 border-2 shadow-[0_0_20px_rgba(56,189,248,0.7)] ring-2 ring-cyan-300/60' : 'border-white/15 hover:border-cyan-200/60'} ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className="h-14 w-14 overflow-hidden rounded-full border border-white/20 bg-black shrink-0">
                            <img src={`/avatares/${avatarFile}`} alt={avatarFile} className="h-full w-full object-cover" />
                          </div>
                          <span className="text-xs text-slate-200 truncate">{avatarFile}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-white/10 bg-black/25">
              <button
                type="button"
                onClick={() => {
                  setAvatarPage((prev) => Math.max(1, prev - 1));
                  setShowApplyConfirm(false);
                }}
                disabled={avatarPage === 1}
                className="inline-flex items-center gap-2 min-w-[120px] justify-center h-10 px-4 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/15 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
                Anterior
              </button>
              <div className="inline-flex items-center gap-2 text-sm text-slate-300 font-semibold">
                <BookOpen className="w-5 h-5 text-cyan-300" />
                <span>{avatarPage}/{totalPages}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAvatarPage((prev) => Math.min(totalPages, prev + 1));
                  setShowApplyConfirm(false);
                }}
                disabled={avatarPage === totalPages}
                className="inline-flex items-center gap-2 min-w-[120px] justify-center h-10 px-4 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/15 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[91] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsHistoryModalOpen(false)} />
          <div className="relative w-full max-w-4xl rounded-3xl border border-white/20 bg-[#101826]/95 shadow-2xl backdrop-blur-xl max-h-[88vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/20">
              <div>
                <h3 className="text-lg font-extrabold text-white">Historial de compras</h3>
                <p className="text-xs text-slate-300">Últimas compras de tu cuenta</p>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(88vh-78px)]">
              {historyLoading && (
                <div className="py-16 text-center text-sm text-slate-300">Cargando historial...</div>
              )}

              {!historyLoading && historyError && (
                <div className="rounded-xl border border-rose-200/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {historyError}
                </div>
              )}

              {!historyLoading && !historyError && purchaseHistory.length === 0 && (
                <div className="py-16 text-center text-sm text-slate-300">Aún no tienes compras registradas.</div>
              )}

              {!historyLoading && !historyError && purchaseHistory.length > 0 && (
                <div className="rounded-2xl border border-white/15 overflow-hidden">
                  <div className="grid grid-cols-[90px_1fr_120px_140px] bg-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-300 font-black px-4 py-3">
                    <span>Item</span>
                    <span>Nombre</span>
                    <span className="text-right">Costo</span>
                    <span className="text-right">Fecha</span>
                  </div>
                  <div>
                    {purchaseHistory.map((purchase) => (
                      <a 
                        key={purchase.id}
                        href={purchase.item_id ? `https://www.wowhead.com/wotlk/item=${purchase.item_id}` : '#'}
                        data-wowhead={purchase.item_id ? `item=${purchase.item_id}&domain=wotlk` : ''}
                        target="_blank"
                        rel="noopener"
                        className="grid grid-cols-[90px_1fr_120px_140px] items-center px-4 py-3 border-t border-white/10 text-sm text-slate-200 hover:bg-white/5 transition-colors group"
                      >
                        <span className="text-xs font-black text-cyan-300">#{purchase.item_id}</span>
                        <div className="min-w-0">
                          <p className="font-semibold truncate group-hover:text-cyan-300 transition-colors">{purchase.item_name || 'Item sin nombre'}</p>
                          <p className="text-[11px] text-slate-400">{purchase.character_name || 'Sin personaje'}{purchase.is_gift ? ' • Regalo' : ''}</p>
                        </div>
                        <span className="text-right font-bold text-amber-300">{purchase.price} {purchase.currency.toUpperCase()}</span>
                        <span className="text-right text-xs text-slate-400">{formatPurchaseDate(purchase.created_at)}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[91] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsPasswordModalOpen(false)} />
          <div className="relative w-full max-w-xl rounded-3xl border border-white/20 bg-[#101826]/95 shadow-2xl backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/20">
              <div>
                <h3 className="text-lg font-extrabold text-white">Cambiar contraseña</h3>
                <p className="text-xs text-slate-300">Actualiza la contraseña de tu cuenta</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {passwordError && (
                <div className="rounded-xl border border-rose-200/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="rounded-xl border border-emerald-200/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  {passwordSuccess}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">Contraseña actual</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="w-full h-11 rounded-xl border border-white/15 bg-black/35 px-3 text-sm text-white outline-none focus:border-cyan-300/60"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">Nueva contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full h-11 rounded-xl border border-white/15 bg-black/35 px-3 text-sm text-white outline-none focus:border-cyan-300/60"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">Confirmar nueva contraseña</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full h-11 rounded-xl border border-white/15 bg-black/35 px-3 text-sm text-white outline-none focus:border-cyan-300/60"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">PIN de seguridad (4 digitos)</label>
                <input
                  type="password"
                  value={securityPin}
                  onChange={(event) => setSecurityPin(event.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  className="w-full h-11 rounded-xl border border-white/15 bg-black/35 px-3 text-sm text-white outline-none focus:border-cyan-300/60"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="h-10 px-4 rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/15 text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={submitPasswordChange}
                  disabled={passwordSaving}
                  className="h-10 px-4 rounded-xl border border-cyan-200/40 bg-cyan-400/20 text-cyan-100 hover:bg-cyan-400/30 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {passwordSaving ? 'Guardando...' : 'Guardar contraseña'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-24 border-t border-red-900/10 py-12">
        <div className="max-w-6xl mx-auto flex flex-col items-center gap-4 text-center">
           <div className="text-red-900/20 font-black italic text-4xl">SHADOW AZEROTH CITADEL</div>
           <p className="text-[8px] text-gray-700 font-bold uppercase tracking-[0.8em]">LOK&apos;TAR OGAR - VICTORY OR DEATH</p>
        </div>
      </footer>

    </div>
  );
}
