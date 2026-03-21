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
  Edit2,
} from 'lucide-react';
import DarDpAdminForm from './DarDpAdminForm';

// ── Constants ──────────────────────────────────────────────────────────────────
// Profesiones WoW
const PROFESSIONS_LIST = [
  { id: 171, name: 'Alquimia' },
  { id: 164, name: 'Herrería' },
  { id: 333, name: 'Encantamiento' },
  { id: 202, name: 'Ingeniería' },
  { id: 182, name: 'Herboristería' },
  { id: 773, name: 'Inscripción' },
  { id: 755, name: 'Joyería' },
  { id: 165, name: 'Peletería' },
  { id: 186, name: 'Minería' },
  { id: 393, name: 'Desuello' },
  { id: 197, name: 'Sastrería' },
  { id: 356, name: 'Pesca' },
  { id: 185, name: 'Cocina' },
  { id: 129, name: 'Primeros Auxilios' },
];

// Clases WoW para selección de tier PvE
const CLASSES = [
  { id: 1, name: 'Guerrero', color: '#C79C6E' },
  { id: 2, name: 'Paladín', color: '#F58CBA' },
  { id: 3, name: 'Cazador', color: '#ABD473' },
  { id: 4, name: 'Pícaro', color: '#FFF569' },
  { id: 5, name: 'Sacerdote', color: '#FFFFFF' },
  { id: 6, name: 'Caballero de la Muerte', color: '#C41F3B' },
  { id: 7, name: 'Chamán', color: '#0070DE' },
  { id: 8, name: 'Mago', color: '#69CCF0' },
  { id: 9, name: 'Brujo', color: '#9482C9' },
  { id: 11, name: 'Druida', color: '#FF7D0A' },
];

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
  service_type: string;
  service_data: string | null;
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
  const [editingId, setEditingId] = useState<number | null>(null);

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

      if (res.status === 401 || res.status === 403) { router.push('/dashboard'); return; }

      // Llegados aquí, el check de GM pasó sin dar 401/403.
      setIsAllowed(true);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar la tienda');

      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error cargando la tienda';
      // Mantiene isAllowed pero muestra error real en la UI
      setIsAllowed(true); 
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
    
    // Verificación silenciosa de GM para rebotar cuentas normales
    fetch(`/api/account/points?accountId=${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.gmlevel || Number(data.gmlevel) < 3) {
          router.replace('/dashboard');
        } else {
          setCheckingAuth(false);
        }
      })
      .catch(() => router.replace('/dashboard'));
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

  // ── Add/Update item ─────────────────────────────────────────────────────
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
    } else if (validItems.length === 1) {
       finalItemId = Number(validItems[0].id);
    } else {
       finalItemId = 0;
    }
 
    try {
      const isEditing = editingId !== null;
      const res = await fetch('/api/admin/shop', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
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
      setEditingId(null);
      await fetchItems();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error de conexión al guardar item';
      setError(message);
    } finally {
      setLoading(false);
    }
  };
 
  // ── Edit Click ───────────────────────────────────────────────────────────
  const handleEditClick = (item: ShopItem) => {
    setEditingId(item.id);
    setError('');
 
    let bundle: { id: string; count: string }[] = [{ id: String(item.item_id), count: String(item.soap_item_count || 1) }];
    if (item.service_type === 'bundle' && item.service_data) {
       try {
          const parsed = JSON.parse(item.service_data);
          if (Array.isArray(parsed)) {
             bundle = parsed.map(p => ({ id: String(p.id || p.item_id), count: String(p.count || 1) }));
          }
       } catch { /* use single */ }
    }
 
    setNewItem({
      name: item.name,
      itemId: String(item.item_id),
      price: String(item.price),
      currency: item.currency,
      category: item.category,
      quality: item.quality,
      tier: String(item.tier),
      classMask: String(item.class_mask),
      image: item.image,
      soapCount: String(item.soap_item_count),
      serviceType: item.service_type,
      serviceData: item.service_data || '',
      bundleItems: bundle,
    });
 
    // scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
 
  const cancelEdit = () => {
    setEditingId(null);
    setNewItem(EMPTY_ITEM);
    setError('');
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
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-black flex items-center gap-2">
                  {editingId ? (
                    <><Edit2 className="w-5 h-5 text-cyan-400" /> Modificar Item #{editingId}</>
                  ) : (
                    <><PlusCircle className="w-5 h-5 text-cyan-400" /> Agregar Item</>
                  )}
                </h2>
                {editingId && (
                  <button
                    onClick={cancelEdit}
                    className="text-xs font-bold text-gray-400 hover:text-white flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"
                  >
                    <X className="w-3" /> CANCELAR EDICIÓN
                  </button>
                )}
              </div>
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
                      {newItem.serviceType === 'none' || newItem.serviceType === 'bundle' ? 'Item ID(s) *' : 'ID Visual / Referencia (Opcional)'}
                    </label>
                    {(newItem.serviceType === 'none' || newItem.serviceType === 'bundle') && (
                      <button 
                        type="button"
                        onClick={() => setNewItem(p => ({ ...p, bundleItems: [...p.bundleItems, { id: '', count: '1' }] }))}
                        className="bg-purple-900/40 hover:bg-purple-600 text-purple-200 font-bold text-[10px] uppercase px-3 py-1.5 rounded-lg transition-colors border border-purple-500/30"
                      >
                        + Añadir otro ítem
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {newItem.bundleItems.map((bi, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <div className="flex-1">
                          <input
                            type="number"
                            placeholder={newItem.serviceType === 'profession' ? "ID de la Profesión (Ej: 171)" : "Ej: 49623"}
                            value={bi.id}
                            onChange={(e) => {
                              const nb = [...newItem.bundleItems];
                              nb[idx].id = e.target.value;
                              setNewItem({ ...newItem, bundleItems: nb });
                            }}
                            className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-lg px-3 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                            required={newItem.serviceType === 'none' || newItem.serviceType === 'bundle'}
                          />
                        </div>
                        {(newItem.serviceType === 'none' || newItem.serviceType === 'bundle') && newItem.bundleItems.length > 1 && (
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
                        {(newItem.serviceType === 'none' || newItem.serviceType === 'bundle') && newItem.bundleItems.length > 1 && (
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
                    onChange={e => {
                      const st = e.target.value;
                      let cat = newItem.category;
                      let img = newItem.image;
                      let sData = newItem.serviceData;
                      let bItems = newItem.bundleItems;
                      
                      // Auto-suggestion for categories and images
                      if (st === 'gold_pack') { 
                        cat = 'oro'; 
                        img = 'inv_misc_coin_02'; 
                        bItems = [{ id: '', count: '1' }]; 
                      }
                      else if (st === 'level_boost') { 
                        cat = 'boost'; 
                        img = 'spell_holy_blessingofstrength'; 
                        bItems = [{ id: '', count: '1' }]; 
                      }
                      else if (st === 'profession') { 
                        cat = 'profesiones'; 
                        bItems = [{ id: '', count: '1' }]; 
                      }
                      else if (st === 'none' || st === 'bundle') {
                        sData = '';
                      }
                      
                      setNewItem(p => ({ 
                        ...p, 
                        serviceType: st, 
                        category: cat, 
                        image: img, 
                        serviceData: sData,
                        bundleItems: bItems 
                      }));
                    }}
                    className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
                  >
                    <option value="none">Ninguno (Item estándar)</option>
                    <option value="name_change">Cambio de Nombre</option>
                    <option value="race_change">Cambio de Raza</option>
                    <option value="faction_change">Cambio de Facción</option>
                    <option value="level_boost">Instant Level Boost</option>
                    <option value="gold_pack">Pack de Oro (Instant)</option>
                    <option value="profession">Profesión / Skill (Instant)</option>
                  </select>
                </div>

                {/* Service Configuration Wrapper */}
                {newItem.serviceType !== 'none' && newItem.serviceType !== 'bundle' && (
                  <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 border border-pink-500/20 bg-pink-900/5 p-4 rounded-xl">
                    <h3 className="md:col-span-2 text-xs font-black text-pink-400 uppercase tracking-widest border-b border-pink-500/10 pb-2 mb-2">
                       Configuración de Servicio Instantáneo
                    </h3>
                    
                    {newItem.serviceType === 'profession' && (
                       <div>
                         <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Seleccionar Profesión</label>
                         <select
                           value={newItem.bundleItems[0]?.id || ''}
                           onChange={(e) => {
                             const tid = e.target.value;
                             const prof = PROFESSIONS_LIST.find(p => String(p.id) === tid);
                             // If profession selected, auto-set name if empty
                             const newName = !newItem.name || PROFESSIONS_LIST.some(p => p.name === newItem.name) ? (prof?.name || '') : newItem.name;
                             setNewItem(p => ({ ...p, name: newName, bundleItems: [{ id: tid, count: '1' }] }));
                           }}
                           className="w-full bg-[#03060d]/80 border border-pink-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-pink-400/60"
                         >
                           <option value="">-- Seleccionar --</option>
                           {PROFESSIONS_LIST.map(prof => (
                             <option key={prof.id} value={prof.id}>{prof.name}</option>
                           ))}
                         </select>
                       </div>
                    )}

                    <div>
                      <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">
                        {newItem.serviceType === 'level_boost' ? 'Nivel Final (Ej: 80)' :
                         newItem.serviceType === 'gold_pack' ? 'Cantidad de Oro' :
                         newItem.serviceType === 'profession' ? 'Nivel de Habilidad (Ej: 450)' :
                         'Valor del Servicio'}
                      </label>
                      <input
                        type="number"
                        placeholder="Ej: 450"
                        value={newItem.serviceData}
                        onChange={e => setNewItem(p => ({ ...p, serviceData: e.target.value }))}
                        className="w-full bg-[#03060d]/80 border border-pink-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-pink-400/60"
                      />
                    </div>
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
                {/* Subcategory / Tier dynamic picker + Clase PvE */}
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
                  ) : newItem.category === 'pve' ? (
                    <>
                      <input
                        type="number"
                        min={1} max={9}
                        value={newItem.tier}
                        onChange={e => setNewItem(p => ({ ...p, tier: e.target.value }))}
                        className="w-full bg-[#03060d]/80 border border-purple-500/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60 mb-2"
                        placeholder="Ej: 8"
                      />
                      <div className="mt-2">
                        <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Clases permitidas</label>
                        <div className="flex flex-wrap gap-2">
                          {CLASSES.map(cls => {
                            const checked = (Number(newItem.classMask) & (1 << (cls.id - 1))) !== 0;
                            return (
                              <label key={cls.id} className="flex items-center gap-1 px-2 py-1 rounded-lg border-2 text-xs font-bold cursor-pointer" style={{ borderColor: cls.color, color: checked ? '#fff' : cls.color, background: checked ? cls.color + '22' : 'transparent' }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={e => {
                                    let mask = Number(newItem.classMask) || 0;
                                    if (e.target.checked) {
                                      mask |= (1 << (cls.id - 1));
                                    } else {
                                      mask &= ~(1 << (cls.id - 1));
                                    }
                                    setNewItem(p => ({ ...p, classMask: String(mask) }));
                                  }}
                                  className="accent-cyan-500 mr-1"
                                />
                                {cls.name}
                              </label>
                            );
                          })}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Puedes seleccionar varias clases. Si no seleccionas ninguna, será para todas.</div>
                      </div>
                    </>
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
                    {editingId ? <Edit2 className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                    {loading ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Agregar a la Tienda'}
                  </button>
                  
                  {editingId && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-8 py-3.5 rounded-xl font-bold text-sm bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                    >
                      Cancelar
                    </button>
                  )}
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
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditClick(item)}
                                className="p-2 rounded-lg bg-cyan-900/30 text-cyan-400 hover:bg-cyan-700/50 hover:text-white transition-colors"
                                title="Editar item"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-2 rounded-lg bg-rose-900/30 text-rose-400 hover:bg-rose-700/50 hover:text-white transition-colors"
                                title="Eliminar item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
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
