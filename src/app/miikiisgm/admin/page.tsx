'use client';

import React, { useEffect, useState } from 'react';
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
  MessageSquare,
} from 'lucide-react';
import DarDpAdminForm from './DarDpAdminForm';
import AdminForum from './AdminForum';
import AdminCategories from './AdminCategories';
import AdminForumSections from './AdminForumSections';
import { Tag } from 'lucide-react';

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
  price_dp: number;
  price_vp: number;
  quality: string;
  category: string;
  tier: number;
  class_mask: number;
  image: string;
  soap_item_count: number;
  service_type: string;
  service_data: string | null;
  faction: string | null;
  item_level: number;
  description: string | null;
}

interface NewItemForm {
  name: string;
  itemId: string;
  priceDp: string;
  priceVp: string;
  category: string;
  quality: string;
  tier: string;
  classMask: string;
  image: string;
  soapCount: string;
  serviceType: string;
  serviceData: string;
  faction: string;
  itemLevel: string;
  description: string;
  bundleItems: { id: string; count: string }[];
  // ── Boost bundle fields ──
  boostLevel: string;
  boostGold: string;
  boostItems: string;
  // ── Profession kit fields ──
  profMaterials: string;
}

const EMPTY_ITEM: NewItemForm = {
  name: '',
  itemId: '',
  priceDp: '',
  priceVp: '',
  category: 'misc',
  quality: 'comun',
  tier: '0',
  classMask: '0',
  image: '',
  soapCount: '1',
  serviceType: 'none',
  serviceData: '',
  faction: 'all',
  itemLevel: '0',
  description: '',
  bundleItems: [{ id: '', count: '1' }],
  boostLevel: '80',
  boostGold: '0',
  boostItems: '',
  profMaterials: '',
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
type AdminTab = 'shop' | 'categories' | 'news' | 'addons' | 'qr' | 'dar_dp' | 'forum' | 'forum_sections';

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
  const [searchQuery, setSearchQuery] = useState('');

  // tabs
  const [activeTab, setActiveTab] = useState<AdminTab>('shop');
  const [myGmLevel, setMyGmLevel] = useState<number>(0);
  const [categories, setCategories] = useState<{ id: number; slug: string; name: string; parent_id?: number | null }[]>([]);

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

  const fetchCategories = async () => {
    const user = getStoredUser();
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/admin/shop/categories?userId=${user.id}`);
      const data = await res.json();
      if (res.ok) {
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
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
    
    fetch(`/api/account/points?accountId=${user.id}`)
      .then((res) => res.json())
      .then((data) => {
        const lvl = Number(data.gmlevel || 0);
        if (lvl < 1) {
          router.replace('/dashboard');
        } else {
          setMyGmLevel(lvl);
          setCheckingAuth(false);
          if (lvl < 3) {
            setActiveTab('forum');
          } else {
            fetchCategories(); // Carga las categorías solo si es admin >= 3
          }
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
      
      if (myGmLevel >= 3) {
        setFetchLoading(true);
        await fetchItems();
      } else {
        setIsAllowed(true);
        setAccessChecking(false);
      }
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
    if (!newItem.name.trim() || (!newItem.priceDp && !newItem.priceVp)) {
      setError('Rellena nombre y al menos un precio (Donaciones o Estelas).');
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
          priceDp: Number(newItem.priceDp) || 0,
          priceVp: Number(newItem.priceVp) || 0,
          category: newItem.category,
          quality: newItem.quality,
          tier: Number(newItem.tier),
          classMask: Number(newItem.classMask),
          image: newItem.image.trim() || 'inv_misc_questionmark',
          soapCount: Number(newItem.soapCount) || 1,
          serviceType: finalServiceType,
          serviceData: finalServiceType === 'level_boost'
            ? JSON.stringify({ level: Number(newItem.boostLevel) || 80, gold: Number(newItem.boostGold) || 0, items: newItem.boostItems.trim() })
            : finalServiceType === 'profession'
            ? JSON.stringify({ skillId: Number(newItem.bundleItems[0]?.id) || 0, skillLevel: Number(newItem.serviceData) || 450, materials: newItem.profMaterials.trim() })
            : finalServiceData,
          faction: newItem.faction || 'all',
          itemLevel: Number(newItem.itemLevel) || 0,
          description: newItem.description || '',
        }),
      });
 
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.details ? `${data.error}: ${data.details}` : (data.error || 'Error al guardar item');
        throw new Error(errorMsg);
      }

      setNewItem(EMPTY_ITEM);
      setEditingId(null);
      await fetchItems();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar item';
      setError('❌ ERROR: ' + message);
      console.error('[AdminShop] Error detallado:', err);
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
 
    // Parse service_data JSON for boost / profession
    let boostLevel = '80', boostGold = '0', boostItems = '', profMaterials = '';
    if (item.service_type === 'level_boost' && item.service_data) {
      try {
        const sd = JSON.parse(item.service_data);
        boostLevel = String(sd.level || 80);
        boostGold = String(sd.gold || 0);
        boostItems = String(sd.items || '');
      } catch { boostLevel = String(item.service_data); }
    }
    if (item.service_type === 'profession' && item.service_data) {
      try {
        const sd = JSON.parse(item.service_data);
        profMaterials = String(sd.materials || '');
      } catch {}
    }

    setNewItem({
      name: item.name,
      itemId: String(item.item_id),
      priceDp: String(item.price_dp || 0),
      priceVp: String(item.price_vp || 0),
      category: item.category,
      quality: item.quality,
      tier: String(item.tier),
      classMask: String(item.class_mask),
      image: item.image,
      soapCount: String(item.soap_item_count),
      serviceType: item.service_type,
      serviceData: item.service_type === 'profession' && item.service_data
        ? (() => { try { return String(JSON.parse(item.service_data).skillLevel || item.service_data); } catch { return item.service_data || ''; } })()
        : item.service_data || '',
      faction: item.faction || 'all',
      itemLevel: String(item.item_level || 0),
      description: item.description || '',
      bundleItems: bundle,
      boostLevel,
      boostGold,
      boostItems,
      profMaterials,
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
        <p className="text-rose-400 text-lg font-bold">Acceso denegado. Se requiere ser miembro del Staff.</p>
      </main>
    );
  }

  // ── Tab config ───────────────────────────────────────────────────────────
  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    ...(myGmLevel >= 3 ? [
      { id: 'shop' as AdminTab,   label: 'Tienda',  icon: <Package className="w-4 h-4" /> },
      { id: 'categories' as AdminTab, label: 'Categorías', icon: <Tag className="w-4 h-4" /> },
      { id: 'news' as AdminTab,   label: 'Noticias', icon: <Newspaper className="w-4 h-4" /> },
      { id: 'addons' as AdminTab, label: 'Addons',  icon: <Puzzle className="w-4 h-4" /> },
      { id: 'qr' as AdminTab,     label: 'QR Pago', icon: <QrCode className="w-4 h-4" /> },
      { id: 'dar_dp' as AdminTab, label: 'Puntos y Estelas',  icon: <Coins className="w-4 h-4" /> },
      { id: 'forum_sections' as AdminTab, label: 'Secciones Foro', icon: <MessageSquare className="w-4 h-4" /> },
    ] : []),
    { id: 'forum' as AdminTab, label: 'Post Foro', icon: <MessageSquare className="w-4 h-4" /> }
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
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 mb-8 flex gap-2 flex-wrap">
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

      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8">
        {/* ── FORUM TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'forum' && <AdminForum />}

        {/* ── FORUM SECTIONS TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'forum_sections' && <AdminForumSections />}

        {/* ── CATEGORIES TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'categories' && <AdminCategories />}

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
                            <form onSubmit={handleAdd} className="space-y-6">
                {/* ── BLOQUE 1: Información General ── */}
                <div className="bg-[#03060d]/60 border border-purple-500/20 rounded-2xl p-6 md:p-8 space-y-6">
                  <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest border-b border-purple-500/20 pb-2 flex items-center gap-2">
                    <span className="bg-cyan-900/40 text-cyan-300 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    Información General
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Name */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Nombre del Pack o Item *</label>
                      <input
                        type="text"
                        placeholder="Ej: Set Furioso de Paladín"
                        value={newItem.name}
                        onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                        className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-5 py-3.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 transition-all text-sm"
                        required
                      />
                    </div>
                    {/* Image */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Nombre del Icono (opcional)</label>
                      <input
                        type="text"
                        placeholder="Ej: inv_sword_01"
                        value={newItem.image}
                        onChange={e => setNewItem(p => ({ ...p, image: e.target.value }))}
                        className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-5 py-3.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 transition-all text-sm"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Descripción del Producto (Opcional)</label>
                    <textarea
                      placeholder="Detalles sobre este artículo o paquete..."
                      value={newItem.description}
                      onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
                      className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-5 py-3.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 transition-all min-h-[100px] resize-y text-sm"
                    />
                  </div>
                </div>

                {/* ── BLOQUE 2: Precios y Tipología ── */}
                <div className="bg-[#03060d]/60 border border-purple-500/20 rounded-2xl p-6 md:p-8 space-y-6">
                  <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest border-b border-purple-500/20 pb-2 flex items-center gap-2">
                    <span className="bg-cyan-900/40 text-cyan-300 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    Precios y Categoría
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Precio Donaciones (DP) */}
                    <div>
                      <label className="block text-xs text-yellow-300/80 mb-1 font-semibold uppercase tracking-wider">💰 Precio Donaciones</label>
                      <input
                        type="number"
                        placeholder="0 = no disponible"
                        value={newItem.priceDp}
                        onChange={e => setNewItem(p => ({ ...p, priceDp: e.target.value }))}
                        className="w-full bg-black/50 border border-yellow-500/30 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400/60 transition-all font-black text-yellow-400 text-sm"
                      />
                      <p className="text-[10px] text-yellow-200/40 mt-1">Transferibles • Permite regalo</p>
                    </div>
                    {/* Precio Estelas (VP) */}
                    <div>
                      <label className="block text-xs text-violet-300/80 mb-1 font-semibold uppercase tracking-wider">✦ Precio Estelas</label>
                      <input
                        type="number"
                        placeholder="0 = no disponible"
                        value={newItem.priceVp}
                        onChange={e => setNewItem(p => ({ ...p, priceVp: e.target.value }))}
                        className="w-full bg-black/50 border border-violet-500/30 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-400/60 transition-all font-black text-violet-300 text-sm"
                      />
                      <p className="text-[10px] text-violet-300/40 mt-1">Soulbound • Sin regalo</p>
                    </div>
                    {/* Category */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Categoría</label>
                      <select
                        value={newItem.category}
                        onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
                        className="w-full bg-[#0a0a1a] border border-purple-500/30 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60 transition-all text-sm cursor-pointer"
                      >
                        {/* Secciones Principales y sus subsecciones indented */}
                        {categories.filter(c => !c.parent_id || Number(c.parent_id) === 0).map(main => (
                          <React.Fragment key={main.id}>
                            <option value={main.slug} style={{ backgroundColor: '#0a0a1a', color: '#00f2ff', fontWeight: 'bold' }}>
                              {main.name}
                            </option>
                            {categories.filter(sub => sub.parent_id !== null && Number(sub.parent_id) === main.id).map(sub => (
                              <option key={sub.id} value={sub.slug} style={{ backgroundColor: '#0a0a1a', color: '#e5e7eb' }}>
                                &nbsp;&nbsp;» {sub.name}
                              </option>
                            ))}
                          </React.Fragment>
                        ))}
                        {categories.length === 0 && (
                          <option value="misc" className="bg-[#0a0a1a] text-white">Otros</option>
                        )}
                      </select>
                    </div>
                    {/* Quality */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Calidad</label>
                      <select
                        value={newItem.quality}
                        onChange={e => setNewItem(p => ({ ...p, quality: e.target.value }))}
                        className="w-full bg-[#0a0a1a] border border-purple-500/30 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60 transition-all text-sm cursor-pointer"
                      >
                        <option value="comun" className="bg-[#0a0a1a] text-white">Común</option>
                        <option value="poco_comun" className="bg-[#0a0a1a] text-white">Poco Común</option>
                        <option value="raro" className="bg-[#0a0a1a] text-white">Raro</option>
                        <option value="epico" className="bg-[#0a0a1a] text-white">Épico</option>
                        <option value="legendario" className="bg-[#0a0a1a] text-white">Legendario</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── BLOQUE 3: Configuración de Entregas ── */}
                <div className="bg-[#03060d]/60 border border-cyan-500/20 rounded-2xl p-6 md:p-8 space-y-6">
                  <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest border-b border-cyan-500/20 pb-2 flex items-center gap-2">
                    <span className="bg-cyan-900/40 text-cyan-300 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                    Modo de Entrega (Ítems o Servicio)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Service Type */}
                    <div>
                      <label className="block text-xs text-cyan-400 mb-2 font-semibold uppercase tracking-wider">Naturaleza del Producto</label>
                      <select
                        value={newItem.serviceType}
                        onChange={e => {
                          const st = e.target.value;
                          let cat = newItem.category;
                          let img = newItem.image;
                          let sData = newItem.serviceData;
                          let bItems = newItem.bundleItems;
                          
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
                        className="w-full bg-[#0a0a1a] border border-cyan-500/30 rounded-xl px-5 py-4 font-bold text-cyan-100 hover:border-cyan-400 transition-all cursor-pointer"
                      >
                        <option value="none" className="bg-[#0a0a1a] text-white">Items / Equipo Físico (Por Correo)</option>
                        <option value="name_change" className="bg-[#0a0a1a] text-white">Cambio de Nombre</option>
                        <option value="race_change" className="bg-[#0a0a1a] text-white">Cambio de Raza</option>
                        <option value="faction_change" className="bg-[#0a0a1a] text-white">Cambio de Facción</option>
                        <option value="level_boost" className="bg-[#0a0a1a] text-white">Instant Level Boost</option>
                        <option value="gold_pack" className="bg-[#0a0a1a] text-white">Pack de Oro (Instant)</option>
                        <option value="profession" className="bg-[#0a0a1a] text-white">Profesión / Skill (Instant)</option>
                      </select>
                    </div>
                    
                    {/* Soap Count */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wider">Límite de Usos/Cantidad (SOAP)</label>
                      <input
                        type="number"
                        min={1} max={255}
                        value={newItem.soapCount}
                        onChange={e => setNewItem(p => ({ ...p, soapCount: e.target.value }))}
                        className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/60 transition-all font-bold text-center"
                      />
                    </div>
                  </div>

                  {/* Service Specific Section (Pink) */}
                  {newItem.serviceType !== 'none' && newItem.serviceType !== 'bundle' && (
                    <div className="border border-pink-500/30 bg-pink-900/10 p-5 md:p-6 rounded-2xl shadow-[inset_0_0_20px_rgba(236,72,153,0.1)] space-y-5">
                      <h3 className="text-xs font-black text-pink-400 uppercase tracking-widest border-b border-pink-500/20 pb-2 flex items-center gap-2">
                         ⚡ Variables del Servicio
                      </h3>
                      
                      {/* ── PROFESSION SECTION ── */}
                      {newItem.serviceType === 'profession' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Seleccionar Profesión</label>
                              <select
                                value={newItem.bundleItems[0]?.id || ''}
                                onChange={(e) => {
                                  const tid = e.target.value;
                                  const prof = PROFESSIONS_LIST.find(p => String(p.id) === tid);
                                  const newName = !newItem.name || PROFESSIONS_LIST.some(p => p.name === newItem.name) ? (prof?.name || '') : newItem.name;
                                  setNewItem(p => ({ ...p, name: newName, bundleItems: [{ id: tid, count: '1' }] }));
                                }}
                                className="w-full bg-[#0a0a1a] border border-pink-500/30 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-pink-400/60 transition-all cursor-pointer"
                              >
                                <option value="" className="bg-[#0a0a1a] text-white">-- Seleccionar --</option>
                                {PROFESSIONS_LIST.map(prof => (
                                  <option key={prof.id} value={prof.id} className="bg-[#0a0a1a] text-white">{prof.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Nivel de Habilidad (Ej: 450)</label>
                              <input
                                type="number"
                                placeholder="450"
                                value={newItem.serviceData}
                                onChange={e => setNewItem(p => ({ ...p, serviceData: e.target.value }))}
                                className="w-full bg-black/50 border border-pink-500/30 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-pink-400/60"
                              />
                            </div>
                          </div>
                          {/* Materials Textarea */}
                          <div>
                            <label className="block text-xs text-emerald-300 mb-1 font-semibold uppercase tracking-wider">📦 Kit de Materiales (Starter Pack)</label>
                            <p className="text-[10px] text-gray-500 mb-2">Formato: <code className="text-emerald-300/70">itemId:cantidad</code> separados por comas. Ej: <code className="text-emerald-300/70">36913:20, 36908:10, 2604:15</code></p>
                            <textarea
                              placeholder="36913:20, 36908:10, 2604:15"
                              value={newItem.profMaterials}
                              onChange={e => setNewItem(p => ({ ...p, profMaterials: e.target.value }))}
                              className="w-full bg-black/50 border border-emerald-500/30 rounded-xl px-5 py-3.5 text-emerald-200 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 min-h-[80px] resize-y text-sm font-mono"
                            />
                            <p className="text-[10px] text-gray-600 mt-1">Estos materiales se envían por correo al personaje. Si el campo está vacío, solo se sube el skill.</p>
                          </div>
                        </div>
                      )}

                      {/* ── LEVEL BOOST SECTION ── */}
                      {newItem.serviceType === 'level_boost' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">🎯 Nivel Final</label>
                              <input
                                type="number"
                                placeholder="80"
                                value={newItem.boostLevel}
                                onChange={e => setNewItem(p => ({ ...p, boostLevel: e.target.value }))}
                                className="w-full bg-black/50 border border-pink-500/30 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-pink-400/60 font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-yellow-300/80 mb-1 font-semibold uppercase tracking-wider">💰 Oro Incluido</label>
                              <input
                                type="number"
                                placeholder="0 = sin oro"
                                value={newItem.boostGold}
                                onChange={e => setNewItem(p => ({ ...p, boostGold: e.target.value }))}
                                className="w-full bg-black/50 border border-yellow-500/30 rounded-xl px-5 py-3.5 text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400/60 font-bold"
                              />
                            </div>
                          </div>
                          {/* Items Textarea */}
                          <div>
                            <label className="block text-xs text-orange-300 mb-1 font-semibold uppercase tracking-wider">⚔️ Ítems del Boost (Equipment Bundle)</label>
                            <p className="text-[10px] text-gray-500 mb-2">Formato: IDs de ítems separados por comas. Ej: <code className="text-orange-300/70">49908, 50644, 50603, 50078, 50613</code>. Cada uno se envía x1 por correo.</p>
                            <textarea
                              placeholder="49908, 50644, 50603, 50078, 50613"
                              value={newItem.boostItems}
                              onChange={e => setNewItem(p => ({ ...p, boostItems: e.target.value }))}
                              className="w-full bg-black/50 border border-orange-500/30 rounded-xl px-5 py-3.5 text-orange-200 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400/50 min-h-[100px] resize-y text-sm font-mono"
                            />
                            <p className="text-[10px] text-gray-600 mt-1">Los ítems se envían por correo in-game. Si el inventario está lleno, quedan en el buzón.</p>
                          </div>
                        </div>
                      )}

                      {/* ── GOLD PACK ── */}
                      {newItem.serviceType === 'gold_pack' && (
                        <div>
                          <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Cantidad de Oro</label>
                          <input
                            type="number"
                            placeholder="Ej: 5000"
                            value={newItem.serviceData}
                            onChange={e => setNewItem(p => ({ ...p, serviceData: e.target.value }))}
                            className="w-full bg-black/50 border border-pink-500/30 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-pink-400/60"
                          />
                        </div>
                      )}

                      {/* ── OTHER SERVICES (name/race/faction change) ── */}
                      {!['profession', 'level_boost', 'gold_pack'].includes(newItem.serviceType) && (
                        <div>
                          <label className="block text-xs text-gray-400 mb-1 font-semibold uppercase tracking-wider">Valor del Servicio</label>
                          <input
                            type="number"
                            placeholder="Ej: 450"
                            value={newItem.serviceData}
                            onChange={e => setNewItem(p => ({ ...p, serviceData: e.target.value }))}
                            className="w-full bg-black/50 border border-pink-500/30 rounded-xl px-5 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-pink-400/60"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* ITEM IDs Grid - Solo si es tipo NONE */}
                  {/* We must always show it if it's none or bundle */}
                  <div className={`transition-all duration-300 ${newItem.serviceType !== 'none' && newItem.serviceType !== 'bundle' ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="bg-purple-900/10 border border-purple-500/20 p-5 md:p-6 rounded-2xl space-y-4">
                      <div className="flex justify-between items-center border-b border-purple-500/20 pb-4">
                        <label className="block text-xs text-purple-300 font-bold uppercase tracking-wider">
                          {newItem.serviceType === 'none' || newItem.serviceType === 'bundle' ? 'Lista de Ítems (IDs) a Enviar al Personaje' : 'ID Visual / Referencia'}
                        </label>
                        {(newItem.serviceType === 'none' || newItem.serviceType === 'bundle') && (
                          <button 
                            type="button"
                            onClick={() => setNewItem(p => ({ ...p, bundleItems: [...p.bundleItems, { id: '', count: '1' }] }))}
                            className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] sm:text-xs uppercase px-4 py-2 rounded-lg transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                          >
                            + Añadir Otra Pieza
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        {newItem.bundleItems.map((bi, idx) => (
                          <div key={idx} className="flex gap-0 items-stretch bg-black/40 rounded-xl border border-white/5 overflow-hidden group hover:border-purple-500/50 transition-colors">
                            <input
                              type="number"
                              placeholder={newItem.serviceType === 'profession' ? "ID Profesión" : "ID del Ítem (Ej: 49623)"}
                              value={bi.id}
                              onChange={(e) => {
                                const nb = [...newItem.bundleItems];
                                nb[idx].id = e.target.value;
                                setNewItem({ ...newItem, bundleItems: nb });
                              }}
                              className="w-full bg-transparent px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none font-medium text-sm"
                              required={newItem.serviceType === 'none' || newItem.serviceType === 'bundle'}
                            />
                            {(newItem.serviceType === 'none' || newItem.serviceType === 'bundle') && newItem.bundleItems.length > 1 && (
                              <div className="w-24 border-l border-white/10 bg-white/5 flex items-center justify-center">
                                <input
                                  type="number"
                                  title="Cantidad a enviar"
                                  placeholder="Cant."
                                  value={bi.count}
                                  onChange={(e) => {
                                    const nb = [...newItem.bundleItems];
                                    nb[idx].count = e.target.value;
                                    setNewItem({ ...newItem, bundleItems: nb });
                                  }}
                                  className="w-full bg-transparent px-2 py-3 text-gray-300 text-center focus:outline-none text-sm"
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
                                className="bg-rose-900/30 text-rose-300 hover:bg-rose-600 hover:text-white px-4 transition-colors flex items-center justify-center border-l border-white/10"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── BLOQUE 4: Filtros y Restricciones ── */}
                <div className="bg-[#03060d]/60 border border-purple-500/20 rounded-2xl p-6 md:p-8 space-y-6">
                  <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest border-b border-purple-500/20 pb-2 flex items-center gap-2">
                    <span className="bg-cyan-900/40 text-cyan-300 w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
                    Filtros y Restricciones Visuales
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-purple-900/10 p-5 md:p-6 rounded-2xl border border-purple-500/10">
                    {/* ilvl Field (WotLK, PvE, PvP) */}
                    {(newItem.category === 'wotlk' || newItem.category === 'pve' || newItem.category === 'pvp') && (
                      <div>
                        <label className="text-xs text-purple-300 font-bold uppercase block mb-1">Item Level (ilvl / GS)</label>
                        <input
                          type="number"
                          value={newItem.itemLevel}
                          onChange={e => setNewItem(p => ({ ...p, itemLevel: e.target.value }))}
                          className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-3.5 text-white text-sm focus:ring-2 focus:ring-purple-400/60 transition-all"
                          placeholder="Ej: 264"
                        />
                      </div>
                    )}

                    {/* Tier / Subtype Selector */}
                    <div>
                      <label className="text-xs text-purple-300 font-bold uppercase block mb-1">
                        {newItem.category === 'pve' ? 'Seleccionar Tier' : 
                         newItem.category === 'transmo' ? 'Tipo de Armadura' : 
                         newItem.category === 'monturas' ? 'Tipo de Montura' : 
                         newItem.category === 'boost' ? 'Subida de Nivel a...' :
                         'Tier / Subcategoría / Expansión'}
                      </label>
                      {['pve', 'transmo', 'monturas', 'boost'].includes(newItem.category || '') ? (
                        <select
                          value={newItem.tier}
                          onChange={e => setNewItem(p => ({ ...p, tier: e.target.value }))}
                          className="w-full bg-[#0a0a1a] border border-purple-500/30 rounded-xl px-4 py-3.5 text-white text-sm focus:ring-2 focus:ring-purple-400/60 transition-all cursor-pointer"
                        >
                          {newItem.category === 'pve' ? (
                            <>
                              <option value="0" className="bg-[#0a0a1a] text-white">-- Sin Tier --</option>
                              {[1,2,3,4,5,6,7,8,9,10,11].map(t => <option key={t} value={t} className="bg-[#0a0a1a] text-white">Tier {t}</option>)}
                            </>
                          ) : newItem.category === 'monturas' ? (
                            <>
                              <option value="0" className="bg-[#0a0a1a] text-white">General</option>
                              <option value="1" className="bg-[#0a0a1a] text-white">Terrestre</option>
                              <option value="2" className="bg-[#0a0a1a] text-white">Voladora</option>
                            </>
                          ) : newItem.category === 'transmo' ? (
                            <>
                              <option value="0" className="bg-[#0a0a1a] text-white">General</option>
                              <option value="1" className="bg-[#0a0a1a] text-white">Tela</option>
                              <option value="2" className="bg-[#0a0a1a] text-white">Cuero</option>
                              <option value="3" className="bg-[#0a0a1a] text-white">Malla</option>
                              <option value="4" className="bg-[#0a0a1a] text-white">Placas</option>
                              <option value="5" className="bg-[#0a0a1a] text-white">Armas/Otros</option>
                            </>
                          ) : (
                            <>
                              <option value="0" className="bg-[#0a0a1a] text-white">General</option>
                              <option value="60" className="bg-[#0a0a1a] text-white">Nivel 60</option>
                              <option value="70" className="bg-[#0a0a1a] text-white">Nivel 70</option>
                              <option value="80" className="bg-[#0a0a1a] text-white">Nivel 80</option>
                            </>
                          )}
                        </select>
                      ) : (
                        <input
                          type="number"
                          value={newItem.tier}
                          onChange={e => setNewItem(p => ({ ...p, tier: e.target.value }))}
                          className="w-full bg-black/50 border border-purple-500/30 rounded-xl px-4 py-3.5 text-white text-sm focus:ring-2 focus:ring-purple-400/60 transition-all"
                          placeholder="Ej: 0"
                        />
                      )}
                    </div>

                    {/* Faction Restriction (T9) */}
                    {newItem.category === 'pve' && newItem.tier === '9' && (
                      <div className="md:col-span-2 p-4 bg-orange-950/20 border border-orange-500/30 rounded-xl mt-2 flex flex-col justify-center">
                        <label className="block text-xs text-orange-300 font-bold uppercase mb-2">Restringir a Facción (Específico T9)</label>
                        <select
                          value={newItem.faction}
                          onChange={e => setNewItem(p => ({ ...p, faction: e.target.value }))}
                          className="w-full bg-[#0a0a1a] border border-orange-500/50 rounded-xl px-4 py-3.5 text-white text-sm cursor-pointer"
                        >
                          <option value="all" className="bg-[#0a0a1a] text-white">Ambas (Horda y Alianza)</option>
                          <option value="horda" className="bg-[#0a0a1a] text-white">Horda Únicamente</option>
                          <option value="alianza" className="bg-[#0a0a1a] text-white">Alianza Únicamente</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Class Selection */}
                  <div className="p-5 md:p-6 border border-cyan-500/20 bg-cyan-950/10 rounded-2xl">
                    <label className="block text-xs text-cyan-400 mb-3 font-semibold uppercase tracking-wider border-b border-cyan-500/20 pb-2">Clases Permitidas</label>
                    <div className="flex flex-wrap gap-2.5">
                      {CLASSES.map(cls => {
                        const checked = (Number(newItem.classMask) & (1 << (cls.id - 1))) !== 0;
                        return (
                          <label key={cls.id} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 text-[10px] sm:text-xs font-bold cursor-pointer transition-all hover:-translate-y-0.5" style={{ borderColor: cls.color, color: checked ? '#fff' : cls.color, background: checked ? cls.color + '44' : 'transparent', boxShadow: checked ? `0 4px 12px ${cls.color}44` : 'none' }}>
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
                              className="hidden"
                            />
                            {cls.name}
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-cyan-200/50 mt-3 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block" /> Si no seleccionas ninguna clase, el objeto estará disponible para todas.</p>
                  </div>
                </div>

                {error && (
                  <div className="text-rose-300 text-sm bg-rose-900/20 px-6 py-4 rounded-xl border border-rose-500/50 flex flex-col gap-1 items-center">
                    <span className="font-bold text-base block">Atención:</span>
                    {error}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-4 justify-end pt-4 border-t border-white/5 mt-8">
                  {editingId && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-sm bg-white/5 border border-white/10 hover:bg-red-500/20 hover:text-red-300 transition-all order-2 sm:order-1"
                    >
                      Cancelar Edición
                    </button>
                  )}
                  
                  <button
                    type="submit"
                    disabled={loading || fetchLoading}
                    className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 rounded-xl font-black text-sm transition-all shadow-[0_8px_32px_rgba(91,33,182,0.4)] order-1 sm:order-2 ${
                      loading
                        ? 'bg-purple-700/70 animate-pulse cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-700 to-cyan-700 hover:from-purple-600 hover:to-cyan-600 hover:scale-[1.02]'
                    }`}
                  >
                    {editingId ? <Edit2 className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
                    {loading ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Agregar y Publicar'}
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
              ) : (
                <div className="space-y-4">
                  {items.length > 0 && (
                    <div className="flex items-center bg-[#03060d]/60 border border-purple-500/30 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-cyan-400/60 transition-all w-full md:w-2/3 lg:w-1/2">
                      <div className="pl-4 pr-2 text-gray-500 flex items-center pointer-events-none">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Buscar por nombre, ID o categoría..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent px-2 py-3.5 text-white placeholder:text-gray-500 focus:outline-none text-sm"
                      />
                    </div>
                  )}

                  {items.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay items en la tienda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="pb-3 text-left">ID</th>
                        <th className="pb-3 text-left">Nombre</th>
                        <th className="pb-3 text-left">Item ID</th>
                        <th className="pb-3 text-left">💰 Donaciones</th>
                        <th className="pb-3 text-left">✦ Estelas</th>
                        <th className="pb-3 text-left">Calidad</th>
                        <th className="pb-3 text-left">Categoría</th>
                        <th className="pb-3 text-left">Tier</th>
                        <th className="pb-3 text-left"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {items
                            .filter(item => 
                              item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              String(item.item_id).includes(searchQuery) ||
                              item.category.toLowerCase().includes(searchQuery.toLowerCase())
                            )
                            .map(item => (
                        <tr key={item.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-gray-500">{item.id}</td>
                          <td className="py-3 font-semibold">{item.name}</td>
                          <td className="py-3 text-cyan-300">{item.item_id}</td>
                          <td className="py-3 font-bold text-yellow-400">{item.price_dp > 0 ? item.price_dp : <span className="text-gray-600">—</span>}</td>
                          <td className="py-3 font-bold text-violet-300">{item.price_vp > 0 ? item.price_vp : <span className="text-gray-600">—</span>}</td>
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
      {/* Estilos Globales para forzar legibilidad en selects */}
      <style jsx global>{`
        select option {
          background-color: #0a0a1a !important;
          color: white !important;
          padding: 10px !important;
        }
        select option:hover {
          background-color: #1e1e3f !important;
        }
      `}</style>
    </div>
  );
}
