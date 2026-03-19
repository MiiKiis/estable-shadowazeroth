'use client';

import { useEffect, useState } from 'react';
import QrBoliviaAdminForm from './QrBoliviaAdminForm';
import AdminNewsAddons from './AdminNewsAddons';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Trash2,
  PlusCircle,
  Package,
  Lock,
  Eye,
  EyeOff,
  Newspaper,
  Puzzle,
  QrCode,
  X,
  Coins,
} from 'lucide-react';
import DarDpAdminForm from './DarDpAdminForm';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ShopItem {
  id: number;
  name: string;
  item_id: number;
  price: number;
  currency: string;
  quality: string;
  category: string;
  tier: number;
  class_mask: number;
  image: string;
  soap_item_count: number;
}

interface NewItemForm {
  name: string;
  itemId: string;
  price: string;
  currency: string;
  category: string;
  quality: string;
  tier: string;
  classMask: string;
  image: string;
  soapCount: string;
  serviceType: string;
  serviceData: string;
  bundleItems: { id: string; count: string }[];
}

const EMPTY_ITEM: NewItemForm = {
  name: '',
  itemId: '',
  price: '',
  currency: 'vp',
  category: 'misc',
  quality: 'comun',
  tier: '0',
  classMask: '0',
  image: '',
  soapCount: '1',
  serviceType: 'none',
  serviceData: '',
  bundleItems: [{ id: '', count: '1' }],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getStoredUser(): { id?: number; username?: string } | null {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw) as { id?: number; username?: string };
  } catch {
    return null;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────
type AdminTab = 'shop' | 'news' | 'addons' | 'qr' | 'dar_dp';

export default function AdminShopPage() {
  const router = useRouter();

  // auth
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [storedUsername, setStoredUsername] = useState('');
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // shop
  const [isAllowed, setIsAllowed] = useState(false);
  const [accessChecking, setAccessChecking] = useState(false);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newItem, setNewItem] = useState<NewItemForm>(EMPTY_ITEM);

  // tabs
  const [activeTab, setActiveTab] = useState<AdminTab>('shop');

  // ── Fetch shop items ─────────────────────────────────────────────────────
  const fetchItems = async () => {
    const user = getStoredUser();
    if (!user?.id) { router.push('/'); return; }

    setFetchLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/shop?userId=${user.id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.status === 401 || res.status === 403) { router.push('/'); return; }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar la tienda');

      setItems(Array.isArray(data.items) ? data.items : []);
      setIsAllowed(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error cargando la tienda';
      setError(message);
    } finally {
      setFetchLoading(false);
      setAccessChecking(false);
    }
  };

  // ── Effect: check auth on mount ─────────────────────────────────────────
  useEffect(() => {
    setCheckingAuth(true);
    const user = getStoredUser();
    if (!user?.id) {
      setCheckingAuth(false);
      router.push('/');
      return;
    }
    setStoredUsername(user.username || '');
    setCheckingAuth(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Password submit ──────────────────────────────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = getStoredUser();
    if (!user?.username) { router.push('/'); return; }
    if (!passwordInput) { setPasswordError('Introduce tu contraseña.'); return; }

    setPasswordLoading(true);
    setPasswordError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, password: passwordInput }),
      });
      const data = await res.json();
      if (!res.ok) { setPasswordError(data.error || 'Contraseña incorrecta.'); return; }

      setPasswordVerified(true);
      setAccessChecking(true);
      setFetchLoading(true);
      await fetchItems();
    } catch {
      setPasswordError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── Add item ─────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = getStoredUser();
    if (!user?.id) { router.push('/'); return; }
    if (!newItem.name.trim() || !newItem.price) {
      setError('Rellena nombre y precio.');
      return;
    }

    const validItems = newItem.bundleItems.filter(b => b.id.trim() !== '');
    if (validItems.length === 0 && newItem.serviceType === 'none') {
       setError('Añade al menos un Item ID.');
       return;
    }

    setLoading(true);
    setError('');

    let finalServiceType = newItem.serviceType;
    let finalServiceData = newItem.serviceData;
    let finalItemId = 0;

    if (validItems.length > 1) {
       finalServiceType = 'bundle';
       finalServiceData = JSON.stringify(validItems.map(b => ({ id: Number(b.id), count: Number(b.count) })));
       // for bundles, item_id in db can be 0 (meaning complex item)
    } else if (validItems.length === 1) {
       finalItemId = Number(validItems[0].id);
       // we leave finalServiceType as what they picked (none, level_boost, etc.)
    } else {
       // length === 0, but maybe they picked a service without items like gold pack
       finalItemId = 0;
    }

    try {
      const res = await fetch('/api/admin/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: newItem.name.trim(),
          itemId: finalItemId,
          price: Number(newItem.price),
          currency: newItem.currency,
          category: newItem.category,
          quality: newItem.quality,
          tier: Number(newItem.tier),
          classMask: Number(newItem.classMask),
          image: newItem.image.trim() || 'inv_misc_questionmark',
          soapCount: Number(newItem.soapCount) || 1,
          serviceType: finalServiceType,
          serviceData: finalServiceData,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar item');

      setNewItem(EMPTY_ITEM);
      await fetchItems();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error de conexión al agregar item';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // ── Delete item ──────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    const user = getStoredUser();
    if (!user?.id) { router.push('/'); return; }

    const confirmed = window.confirm('¿Seguro que quieres retirar este item de Shadow Azeroth?');
    if (!confirmed) return;

    setError('');

    try {
      const res = await fetch(`/api/admin/shop?id=${id}&userId=${user.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar');

      await fetchItems();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error eliminando item';
      setError(message);
    }
  };

  // ── Render: loading auth ─────────────────────────────────────────────────
  if (checkingAuth) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="w-12 h-12 border-4 border-purple-900 border-t-purple-600 rounded-full animate-spin" />
      </main>
    );
  }

  // ── Render: access checking ──────────────────────────────────────────────
  if (accessChecking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#04040a]">
        <div className="w-14 h-14 rounded-full border-4 border-purple-900 border-t-cyan-300 animate-spin" />
      </main>
    );
  }

  // ── Render: password gate ────────────────────────────────────────────────
  if (!passwordVerified) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 15%, rgba(34,211,238,0.10), transparent 32%), radial-gradient(circle at 82% 8%, rgba(147,51,234,0.18), transparent 28%), linear-gradient(180deg, #020205 0%, #070715 50%, #0b1020 100%)',
        }}
      >
        <div className="w-full max-w-sm">
          <div className="rounded-3xl border border-cyan-100/10 bg-[#060a13]/75 backdrop-blur-xl p-8 shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
            <div className="flex flex-col items-center mb-7">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-700 to-cyan-700 flex items-center justify-center shadow-[0_8px_24px_rgba(91,33,182,0.6)] mb-4">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">Acceso GM</h1>
              <p className="text-gray-400 text-sm mt-1 text-center">
                Confirma tu identidad para continuar
              </p>
              {storedUsername && (
                <span className="mt-3 px-3 py-1 rounded-full border border-cyan-400/30 bg-cyan-900/20 text-cyan-300 text-xs font-semibold">
                  {storedUsername}
                </span>
              )}
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Contraseña de tu cuenta"
                  autoComplete="current-password"
                  className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-2xl px-4 py-3.5 pr-12 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-300/60"
                  value={passwordInput}
                  onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(''); }}
                  disabled={passwordLoading}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-rose-300 text-sm px-1">{passwordError}</p>
              )}
              <button
                type="submit"
                disabled={passwordLoading}
                className={`w-full py-3.5 rounded-2xl font-black text-base transition-all inline-flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(91,33,182,0.45)] ${
                  passwordLoading
                    ? 'bg-purple-700/70 animate-pulse cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-700 via-purple-600 to-cyan-700 hover:from-purple-600 hover:to-cyan-600'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
                {passwordLoading ? 'VERIFICANDO...' : 'ENTRAR AL PANEL'}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  // ── Render: not allowed ──────────────────────────────────────────────────
  if (!isAllowed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#04040a] text-white">
        <p className="text-rose-400 text-lg font-bold">Acceso denegado. Se requiere GM nivel 3+.</p>
      </main>
    );
  }

  // ── Tab config ───────────────────────────────────────────────────────────
  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'shop',   label: 'Tienda',  icon: <Package className="w-4 h-4" /> },
    { id: 'news',   label: 'Noticias', icon: <Newspaper className="w-4 h-4" /> },
    { id: 'addons', label: 'Addons',  icon: <Puzzle className="w-4 h-4" /> },
    { id: 'qr',     label: 'QR Pago', icon: <QrCode className="w-4 h-4" /> },
    { id: 'dar_dp', label: 'Dar DP',  icon: <Coins className="w-4 h-4" /> },
  ];

  // ── Render: main panel ───────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen text-white pt-10 pb-12 px-4 md:px-8 relative overflow-hidden"
      style={{
        backgroundImage:
          'radial-gradient(circle at 18% 15%, rgba(34,211,238,0.12), transparent 32%), radial-gradient(circle at 82% 8%, rgba(147,51,234,0.2), transparent 28%), linear-gradient(180deg, #020205 0%, #070715 45%, #0b1020 100%)',
      }}
    >
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-1">
          <ShieldCheck className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-black tracking-tight">Panel de Administración</h1>
        </div>
        <p className="text-gray-400 text-sm ml-11">Shadow Azeroth — GM Panel</p>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto mb-8 flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-purple-700 to-cyan-700 border-cyan-500/40 text-white shadow-[0_4px_16px_rgba(91,33,182,0.4)]'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-6xl mx-auto">
        {/* ── SHOP TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'shop' && (
          <div className="space-y-8">
            {/* Add item form */}
            <div className="rounded-2xl border border-cyan-100/10 bg-[#060a13]/75 backdrop-blur-xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <h2 className="text-xl font-black mb-5 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-cyan-400" /> Agregar Item
              </h2>
              <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Name */}
                <div className="lg:col-span-2">
                  <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Nombre *</label>
                  <input
                    type="text"
                    placeholder="Ej: Espada de Fuego"
                    value={newItem.name}
                    onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                    required
                  />
                </div>
                {/* Dynamically expanding Item IDs / Bundle */}
                <div className="lg:col-span-3 border border-purple-500/20 bg-black/20 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs text-gray-400 font-semibold uppercase tracking-wider">
                      Item ID(s) *
                      <span className="text-gray-500 lowercase ml-2 normal-case font-normal">(Añade más de uno para crear un Set o Pack automáticamente por el mismo costo)</span>
                    </label>
                    <button 
                      type="button"
                      onClick={() => setNewItem(p => ({ ...p, bundleItems: [...p.bundleItems, { id: '', count: '1' }] }))}
                      className="bg-purple-900/40 hover:bg-purple-600 text-purple-200 font-bold text-[10px] uppercase px-3 py-1.5 rounded-lg transition-colors border border-purple-500/30"
                    >
                      + Añadir otro ítem
                    </button>
                  </div>
                  <div className="space-y-2">
                    {newItem.bundleItems.map((bi, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <div className="flex-1">
                          <input
                            type="number"
                            placeholder="Ej: 49623"
                            value={bi.id}
                            onChange={(e) => {
                              const nb = [...newItem.bundleItems];
                              nb[idx].id = e.target.value;
                              setNewItem({ ...newItem, bundleItems: nb });
                            }}
                            className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-lg px-3 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                            required
                          />
                        </div>
                        {newItem.bundleItems.length > 1 && (
                          <div className="w-20">
                            <input
                              type="number"
                              title="Cantidad en el pack"
                              placeholder="Cant."
                              value={bi.count}
                              onChange={(e) => {
                                const nb = [...newItem.bundleItems];
                                nb[idx].count = e.target.value;
                                setNewItem({ ...newItem, bundleItems: nb });
                              }}
                              className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-lg px-2 py-2.5 text-white text-center focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                              min={1} required
                            />
                          </div>
                        )}
                        {newItem.bundleItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const nb = [...newItem.bundleItems];
                              nb.splice(idx, 1);
                              setNewItem({ ...newItem, bundleItems: nb });
                            }}
                            className="text-gray-500 hover:text-red-500 p-2 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Price */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Precio *</label>
                  <input
                    type="number"
                    placeholder="Ej: 150"
                    value={newItem.price}
                    onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))}
                    className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                    required
                  />
                </div>
                {/* Currency */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Moneda</label>
                  <select
                    value={newItem.currency}
                    onChange={e => setNewItem(p => ({ ...p, currency: e.target.value }))}
                    className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                  >
                    <option value="vp">VP</option>
                    <option value="dp">DP</option>
                  </select>
                </div>
                {/* Category */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Categoría</label>
                  <select
                    value={newItem.category}
                    onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
                    className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                  >
                    <option value="pve">PvE (Tiers)</option>
                    <option value="pvp">PvP</option>
                    <option value="profesiones">Profesiones</option>
                    <option value="monturas">Monturas y Mascotas</option>
                    <option value="transmo">Transfiguración</option>
                    <option value="oro">Oro</option>
                    <option value="boost">Subida de Nivel</option>
                    <option value="misc">Otros</option>
                  </select>
                </div>

                {/* Service Type */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Tipo de Servicio</label>
                  <select
                    value={newItem.serviceType}
                    onChange={e => setNewItem(p => ({ ...p, serviceType: e.target.value }))}
                    className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                  >
                    <option value="none">Ninguno (Item estándar)</option>
                    <option value="name_change">Cambio de Nombre</option>
                    <option value="race_change">Cambio de Raza</option>
                    <option value="faction_change">Cambio de Facción</option>
                    <option value="level_boost">Instant Level Boost</option>
                    <option value="gold_pack">Pack de Oro</option>
                    <option value="character_transfer">Transferencia de Cuenta</option>
                  </select>
                </div>

                {/* Service Data Wrapper */}
                {newItem.serviceType !== 'none' && newItem.serviceType !== 'bundle' && (
                  <div className="lg:col-span-2">
                    <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">
                      {newItem.serviceType === 'level_boost' ? 'Nivel Objetivo (60, 70, etc)' :
                       newItem.serviceType === 'gold_pack' ? 'Cantidad de Oro' :
                       'Datos adicionales (opcional)'}
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 70"
                      value={newItem.serviceData}
                      onChange={e => setNewItem(p => ({ ...p, serviceData: e.target.value }))}
                      className="w-full bg-[#03060d]/80 border border-pink-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-pink-400/60"
                    />
                  </div>
                )}


                {/* Quality */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Calidad</label>
                  <select
                    value={newItem.quality}
                    onChange={e => setNewItem(p => ({ ...p, quality: e.target.value }))}
                    className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                  >
                    <option value="comun">Común</option>
                    <option value="poco_comun">Poco Común</option>
                    <option value="raro">Raro</option>
                    <option value="epico">Épico</option>
                    <option value="legendario">Legendario</option>
                  </select>
                </div>
                {/* Subcategory / Tier dynamic picker */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">
                     {newItem.category === 'pve' ? 'Tier PvE (1-9)' : 
                      newItem.category === 'profesiones' ? 'Tipo de Profesión' :
                      newItem.category === 'monturas' ? 'Tipo de Montura' :
                      newItem.category === 'transmo' ? 'Tipo de Transfiguración' :
                      newItem.category === 'boost' ? 'Subida de Nivel A' :
                      'Subcategoría / Tier (0)'}
                  </label>
                  {newItem.category === 'profesiones' ? (
                    <select
                      value={newItem.tier}
                      onChange={e => setNewItem(p => ({ ...p, tier: e.target.value }))}
                      className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                    >
                      <option value="0">General</option>
                      <option value="1">Herboristería</option>
                      <option value="2">Minería</option>
                      <option value="3">Alquimia</option>
                      <option value="4">Ingeniería</option>
                      <option value="5">Sastrería</option>
                      <option value="6">Herrería</option>
                      <option value="7">Encantamiento</option>
                      <option value="8">Inscripción</option>
                      <option value="9">Peletería</option>
                      <option value="10">Joyería</option>
                      <option value="11">Cocina</option>
                      <option value="12">Primeros Auxilios</option>
                    </select>
                  ) : newItem.category === 'monturas' ? (
                    <select
                      value={newItem.tier}
                      onChange={e => setNewItem(p => ({ ...p, tier: e.target.value }))}
                      className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                    >
                      <option value="0">General</option>
                      <option value="1">Terrestre</option>
                      <option value="2">Voladora</option>
                    </select>
                  ) : newItem.category === 'transmo' ? (
                    <select
                      value={newItem.tier}
                      onChange={e => setNewItem(p => ({ ...p, tier: e.target.value }))}
                      className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                    >
                      <option value="0">General</option>
                      <option value="1">Tela</option>
                      <option value="2">Cuero</option>
                      <option value="3">Malla</option>
                      <option value="4">Placas</option>
                      <option value="5">Armas/Otros</option>
                    </select>
                  ) : newItem.category === 'boost' ? (
                    <select
                      value={newItem.tier}
                      onChange={e => setNewItem(p => ({ ...p, tier: e.target.value }))}
                      className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                    >
                      <option value="0">General</option>
                      <option value="60">Nivel 60</option>
                      <option value="70">Nivel 70</option>
                      <option value="80">Nivel 80</option>
                    </select>
                  ) : (
                    <input
                      type="number"
                      min={0} max={100}
                      value={newItem.tier}
                      onChange={e => setNewItem(p => ({ ...p, tier: e.target.value }))}
                      className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                      placeholder="Ej: 8"
                    />
                  )}
                </div>
                {/* Soap Count */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Cantidad SOAP</label>
                  <input
                    type="number"
                    min={1} max={255}
                    value={newItem.soapCount}
                    onChange={e => setNewItem(p => ({ ...p, soapCount: e.target.value }))}
                    className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                  />
                </div>
                {/* Image */}
                <div className="lg:col-span-2">
                  <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Nombre del Icono (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: inv_sword_01"
                    value={newItem.image}
                    onChange={e => setNewItem(p => ({ ...p, image: e.target.value }))}
                    className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                  />
                </div>

                {error && (
                  <div className="lg:col-span-3 text-rose-300 text-sm bg-rose-900/20 px-4 py-2 rounded-xl">
                    {error}
                  </div>
                )}

                <div className="lg:col-span-3">
                  <button
                    type="submit"
                    disabled={loading || fetchLoading}
                    className={`inline-flex items-center gap-2 px-8 py-3 rounded-xl font-black text-sm transition-all shadow-[0_4px_16px_rgba(91,33,182,0.4)] ${
                      loading
                        ? 'bg-purple-700/70 animate-pulse cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-700 to-cyan-700 hover:from-purple-600 hover:to-cyan-600'
                    }`}
                  >
                    <PlusCircle className="w-4 h-4" />
                    {loading ? 'Guardando...' : 'Agregar a la Tienda'}
                  </button>
                </div>
              </form>
            </div>

            {/* Items list */}
            <div className="rounded-2xl border border-cyan-100/10 bg-[#060a13]/75 backdrop-blur-xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
              <h2 className="text-xl font-black mb-5 flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-400" /> Items en la Tienda
                <span className="ml-auto text-sm font-normal text-gray-400">{items.length} items</span>
              </h2>

              {fetchLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-10 h-10 border-4 border-purple-900 border-t-cyan-300 rounded-full animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay items en la tienda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="pb-3 text-left">ID</th>
                        <th className="pb-3 text-left">Nombre</th>
                        <th className="pb-3 text-left">Item ID</th>
                        <th className="pb-3 text-left">Precio</th>
                        <th className="pb-3 text-left">Moneda</th>
                        <th className="pb-3 text-left">Calidad</th>
                        <th className="pb-3 text-left">Categoría</th>
                        <th className="pb-3 text-left">Tier</th>
                        <th className="pb-3 text-left"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {items.map(item => (
                        <tr key={item.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-gray-500">{item.id}</td>
                          <td className="py-3 font-semibold">{item.name}</td>
                          <td className="py-3 text-cyan-300">{item.item_id}</td>
                          <td className="py-3">{item.price}</td>
                          <td className="py-3 uppercase text-xs text-purple-300">{item.currency}</td>
                          <td className="py-3 capitalize text-xs">{item.quality?.replace('_', ' ')}</td>
                          <td className="py-3 uppercase text-xs">{item.category}</td>
                          <td className="py-3">{item.tier}</td>
                          <td className="py-3">
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-2 rounded-lg bg-rose-900/30 text-rose-400 hover:bg-rose-700/50 hover:text-white transition-colors"
                              title="Eliminar item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NEWS TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'news' && <AdminNewsAddons show="news" />}

        {/* ── ADDONS TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'addons' && <AdminNewsAddons show="addons" />}

        {/* ── QR TAB ───────────────────────────────────────────────────────── */}
        {activeTab === 'qr' && (
          <div className="rounded-2xl border border-cyan-100/10 bg-[#060a13]/75 backdrop-blur-xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] max-w-lg">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-green-400" /> Configurar QR de Pago
            </h2>
            <QrBoliviaAdminForm />
          </div>
        )}

        {/* ── DAR DP TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'dar_dp' && (
          <DarDpAdminForm />
        )}
      </div>
    </div>
  );
}
