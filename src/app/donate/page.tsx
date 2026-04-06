'use client';

import { Sparkles, CreditCard, Gift, TrendingUp, X, Shield, ShoppingCart, CheckCircle2, AlertTriangle, Search, Users, Heart, Zap, Package, ChevronLeft, Tag, User } from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { motion, AnimatePresence } from 'framer-motion';

// Importa KitItemList de forma dinámica para evitar problemas SSR
const KitItemList = dynamic(() => import('@/components/KitItemList'), { ssr: false });

// ── CatManagerPanel: panel de gestión de categorías de tienda para GM rank 3+ ──
function CatManagerPanel({
  categories,
  userId,
  onRefresh,
}: {
  categories: { id: number; slug: string; name: string; description?: string; image?: string; parent_id?: number | null }[];
  userId: number;
  onRefresh: () => void;
}) {
  const mainCats = categories.filter(c => !c.parent_id || Number(c.parent_id) === 0);
  const [form, setForm] = React.useState({ slug: '', name: '', description: '', image_url: '', parent_id: '' });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/shop/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          userId,
          parent_id: form.parent_id ? Number(form.parent_id) : null,
          order_index: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setMsg('✓ Categoría creada correctamente.');
      setForm({ slug: '', name: '', description: '', image_url: '', parent_id: '' });
      onRefresh();
    } catch (err: any) {
      setMsg('✗ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar esta categoría?')) return;
    try {
      const res = await fetch(`/api/admin/shop/categories?id=${id}&userId=${userId}`, { method: 'DELETE' });
      if (res.ok) { onRefresh(); setMsg('✓ Eliminada.'); }
    } catch {}
  };

  return (
    <div className="space-y-6">
      {msg && <p className={`text-xs font-bold ${msg.startsWith('✓') ? 'text-emerald-400' : 'text-rose-400'}`}>{msg}</p>}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Slug ID</label>
          <input className="w-full bg-black/60 border border-amber-500/20 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400/50"
            placeholder="ej: pvp-equip" value={form.slug}
            onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} required />
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Nombre Visible</label>
          <input className="w-full bg-black/60 border border-amber-500/20 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400/50"
            placeholder="ej: Equipo PvP" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Categoría Padre (opcional)</label>
          <select className="w-full bg-black/60 border border-amber-500/20 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400/50 cursor-pointer"
            value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value })}>
            <option value="">-- Sección Principal --</option>
            {mainCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">Descripción</label>
          <input className="w-full bg-black/60 border border-amber-500/20 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400/50"
            placeholder="Descripción corta..." value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={saving}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-[0_4px_15px_rgba(217,119,6,0.3)]">
            {saving ? 'Creando...' : '+ Crear'}
          </button>
        </div>
      </form>

      {/* Lista de categorías actuales */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {mainCats.map(cat => (
          <div key={cat.id} className="group">
            <div className="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 hover:border-amber-500/20 transition-all">
              <div>
                <span className="font-bold text-sm text-white">{cat.name}</span>
                <span className="ml-2 text-[10px] text-gray-500 font-mono">{cat.slug}</span>
              </div>
              <button onClick={() => handleDelete(cat.id)} className="p-1.5 text-gray-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100">
                <span className="text-xs">✕</span>
              </button>
            </div>
            {/* Subcategories */}
            {categories.filter(s => Number(s.parent_id) === cat.id).map(sub => (
              <div key={sub.id} className="group/sub ml-6 mt-1 flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-lg px-4 py-2 hover:border-amber-500/10 transition-all">
                <div className="flex items-center gap-2">
                  <span className="text-amber-500/40 text-xs">↳</span>
                  <span className="text-sm text-gray-300 font-semibold">{sub.name}</span>
                  <span className="text-[10px] text-gray-600 font-mono">{sub.slug}</span>
                </div>
                <button onClick={() => handleDelete(sub.id)} className="p-1 text-gray-600 hover:text-rose-400 transition-colors opacity-0 group-hover/sub:opacity-100">
                  <span className="text-xs">✕</span>
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Modal Premium
function Modal({ open, onClose, children }: { open: boolean, onClose: () => void, children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0b0c16]/95 rounded-3xl shadow-[0_0_60px_rgba(168,85,247,0.2)] p-8 max-w-3xl w-full relative border border-purple-600/30 max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-purple-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-full p-2 transition-all"><X className="w-6 h-6" /></button>
        {children}
      </motion.div>
    </div>
  );
}

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || '';

const DONATIONS = [
  { amount: 1, points: 1, bonus: 0, badge: null, highlight: false, plan: 'Inicial' },
  { amount: 5, points: 5, bonus: 0, badge: null, highlight: false, plan: 'Base' },
  { amount: 10, points: 11, bonus: 1, badge: '10% EXTRA', highlight: true, plan: 'Recomendado' },
  { amount: 20, points: 22, bonus: 2, badge: '10% EXTRA', highlight: false, plan: 'Créditos' },
  { amount: 30, points: 33, bonus: 3, badge: '10% EXTRA', highlight: false, plan: 'Créditos' },
  { amount: 50, points: 55, bonus: 5, badge: 'MÁXIMO VALOR', highlight: true, plan: 'Avanzado' },
].map(item => ({
  ...item,
  valuePerPoint: (item.amount / item.points).toFixed(2)
}));

const SKILL_WOWHEAD_MAP: Record<number, number> = {
  171: 51304, // Alquimia
  164: 51300, // Herrería
  333: 51313, // Encantamiento
  202: 51306, // Ingeniería
  182: 50300, // Herboristería
  773: 51311, // Inscripción
  51: 51311, // Inscripción (alias)
};

const GS_RANGES = [
  { id: '200-213', name: '200-213 (Naxx/OS)', min: 177, max: 213 },
  { id: '214-225', name: '214-225 (Ulduar)', min: 214, max: 225 },
  { id: '226-245', name: '226-245 (ToC)', min: 226, max: 245 },
  { id: '246-251', name: '246-251 (ICC 10)', min: 246, max: 251 },
  { id: '252-258', name: '252-258 (ICC 25)', min: 252, max: 258 },
  { id: '259-264', name: '259-264 (Heroico/Lich)', min: 259, max: 264 },
];

type CharacterOption = {
  guid: number;
  name: string;
  class?: number;
  level?: number;
  race?: number;
};

type ShopItem = {
  id: number;
  item_id: number;
  image: string;
  name: string;
  price: number;
  currency: string;
  price_dp: number;
  price_vp: number;
  quality: string;
  category?: string;
  tier?: number;
  class_mask?: number;
  transmog_type?: string;
  transmog_level?: number;
  profession?: string;
  faction?: string;
  item_level?: number;
  description?: string;
  service_type?: string;
};

export default function DonatePage() {
  const router = useRouter();
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<(typeof DONATIONS)[number] | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [shopCategories, setShopCategories] = useState<{id: number; slug: string; name: string; description?: string; icon?: string; image?: string; parent_id?: number | null}[]>([]);
  const [gmLevel, setGmLevel] = useState(0);
  const [showCatManager, setShowCatManager] = useState(false);
  
  const [shopCategory, setShopCategory] = useState<string | null>(null);
  const [shopTier, setShopTier] = useState<number | null>(null);
  const [shopClassFilter, setShopClassFilter] = useState<number | null>(null);
  const [tier9FactionFilter, setTier9FactionFilter] = useState<'all' | 'horda' | 'alianza'>('all');
  const [professionFilter, setProfessionFilter] = useState<string>('all');
  const [shopGsRange, setShopGsRange] = useState<string | null>(null);
  const [selectedCharacterGuid, setSelectedCharacterGuid] = useState<string>('');
  const [deliveryMode, setDeliveryMode] = useState<'self' | 'gift'>('self');
  const [giftSearch, setGiftSearch] = useState<string>('');
  const [giftCharacter, setGiftCharacter] = useState<CharacterOption | null>(null);
  const [giftPin, setGiftPin] = useState<string>('');
  const [giftSearching, setGiftSearching] = useState(false);
  const [giftSearchError, setGiftSearchError] = useState<string>('');
  const [giftResults, setGiftResults] = useState<CharacterOption[]>([]);
  const [purchaseMessage, setPurchaseMessage] = useState<string>('');
  const [purchaseError, setPurchaseError] = useState<string>('');
  const [purchasingItemId, setPurchasingItemId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'rewards' | 'donations'>('rewards');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string | null>(null);
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<string>('');
  const customAmountRef = useRef<string>('');
  // Mutex síncrono: evita que múltiples clicks disparen varias compras antes de que React re-renderice
  const purchaseLock = useRef(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [openKitModal, setOpenKitModal] = useState(false);
  const [activeKitId, setActiveKitId] = useState<number | null>(null);
  const [isPayPalLoaded, setIsPayPalLoaded] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{ success: boolean; message: string; transactionId?: string; points?: number } | null>(null);

  useEffect(() => {
    fetch('/api/shop/categories')
      .then(r => r.json())
      .then(data => {
        setShopCategories(Array.isArray(data) ? data : []);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    customAmountRef.current = customAmount;
  }, [customAmount]);

  useEffect(() => {
    if (showCheckout && selectedDonation && isPayPalLoaded && (window as any).paypal) {
      const container = document.getElementById('paypal-button-container');
      if (container) {
        container.innerHTML = '';
        (window as any).paypal.Buttons({
          style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' },
          createOrder: (data: any, actions: any) => {
            const currentCustom = customAmountRef.current;
            const finalAmount = isCustomMode ? currentCustom : selectedDonation?.amount;
            const finalPoints = isCustomMode ? currentCustom : selectedDonation?.points;
            if (!finalAmount || Number(finalAmount) <= 0) {
              alert('Por favor, ingresa un monto válido.');
              return;
            }
            return actions.order.create({
              purchase_units: [{
                description: `Carga de ${finalPoints} Créditos para ${user?.username}`,
                amount: { currency_code: 'USD', value: finalAmount.toString() }
              }]
            });
          },
          onApprove: async (data: any, actions: any) => {
            try {
              const currentCustom = customAmountRef.current;
              const finalPoints = isCustomMode ? Number(currentCustom) : Number(selectedDonation?.points);
              const res = await fetch('/api/payments/paypal/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderID: data.orderID, userId: user?.id, points: finalPoints })
              });
              const result = await res.json();
              if (res.ok) {
                setPaymentResult({
                  success: true,
                  message: result.message,
                  transactionId: result.transactionId,
                  points: finalPoints
                });
                setShowCheckout(false);
              } else {
                throw new Error(result.error || 'Error al procesar los créditos');
              }
            } catch (err: any) {
              setPaymentResult({
                success: false,
                message: err.message || 'Error de comunicación con el servidor'
              });
            }
          }
        }).render('#paypal-button-container');
      }
    }
  }, [showCheckout, selectedDonation, isPayPalLoaded, user?.username, isCustomMode]);

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const link = e.currentTarget.querySelector('a[data-wowhead]');
    if (link) {
      link.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      setCheckingAuth(false);
      return;
    }
    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetch(`/api/characters?accountId=${parsedUser.id}`).then(res => res.json()).then(data => setCharacters(data.characters || []));
      fetch(`/api/shop/items`).then(res => res.json()).then(data => setShopItems(data.items || []));
      // Fetch GM level to show admin tools
      fetch(`/api/account/points?accountId=${parsedUser.id}`)
        .then(res => res.json())
        .then(data => setGmLevel(Number(data.gmlevel || 0)))
        .catch(() => {});
    } catch (e) {
      setUser(null);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  const handlePurchase = async (itemId: number, currency: 'vp' | 'dp') => {
    // Guard síncrono: si ya hay una compra en vuelo, ignorar todos los clicks adicionales
    if (purchaseLock.current) return;
    purchaseLock.current = true;

    if (!user) { setPurchaseError('Debes iniciar sesión para comprar.'); purchaseLock.current = false; return; }
    const isGift = deliveryMode === 'gift';
    const targetGuid = isGift ? giftCharacter?.guid : Number(selectedCharacterGuid);
    if (!targetGuid) { setPurchaseError(isGift ? 'Busca y selecciona un personaje destino.' : 'Selecciona un personaje.'); purchaseLock.current = false; return; }
    if (isGift && !/^\d{4}$/.test(giftPin.trim())) { setPurchaseError('PIN de 4 dígitos requerido.'); purchaseLock.current = false; return; }

    setPurchasingItemId(itemId);
    setPurchaseMessage('');
    setPurchaseError('');

    try {
      const response = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id, itemId, characterGuid: targetGuid, isGift, currency,
          pin: isGift ? giftPin.trim() : undefined,
          targetAccountId: targetAccountId.trim() ? Number(targetAccountId) : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error en la compra');
      setPurchaseMessage(data.message || 'Compra realizada con éxito');
      if (isGift) setGiftPin('');
      
      // Redirect after a short delay so user can read the message
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (error: any) {
      setPurchaseError(error.message);
    } finally {
      setPurchasingItemId(null);
      purchaseLock.current = false; // Liberar el lock para permitir nuevas compras
    }
  };

  const handlePaymentSuccessClose = () => {
    setPaymentResult(null);
    window.location.reload(); // Recarga para actualizar créditos en Header y demás components
  };

  const searchGiftCharacter = async () => {
    const query = giftSearch.trim();
    if (query.length < 2) { setGiftSearchError('Mínimo 2 letras.'); return; }
    setGiftSearching(true);
    setGiftSearchError('');
    setGiftResults([]);
    try {
      const res = await fetch(`/api/characters/search?name=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      if (data.characters?.length === 0) setGiftSearchError('No encontrado.');
      else setGiftResults(data.characters || []);
    } catch (e: any) {
      setGiftSearchError(e.message);
    } finally {
      setGiftSearching(false);
    }
  };

  const filteredShopItems = shopItems.filter(item => {
    if (!shopCategory) return false;
    const currentMainCat = shopCategories.find(c => c.slug === shopCategory);
    const subCategories = shopCategories.filter(c => c.parent_id === currentMainCat?.id);
    const validSlugs = [shopCategory, ...subCategories.map(s => s.slug)];
    if (!validSlugs.includes(item.category || 'misc')) return false;
    if (subCategoryFilter && subCategoryFilter !== '__all' && item.category !== subCategoryFilter) return false;

    if (shopCategory === 'pve') {
      if (shopTier && item.tier !== shopTier) return false;
      if (shopTier === 9 && tier9FactionFilter !== 'all' && item.faction !== tier9FactionFilter) return false;
      if (shopClassFilter && item.class_mask && !(item.class_mask & shopClassFilter)) return false;
    }
    if (shopCategory === 'wotlk' && shopGsRange) {
      const range = GS_RANGES.find(r => r.id === shopGsRange);
      if (range && ((item.item_level || 0) < range.min || (item.item_level || 0) > range.max)) return false;
    }
    if (shopCategory === 'profesiones' && professionFilter !== 'all' && item.profession !== professionFilter) return false;
    return true;
  });

  const CategoryCard = ({ cat, onClick, isSub = false }: { cat: any, onClick: () => void, isSub?: boolean }) => (
    <motion.button
      whileHover={{ scale: 1.02, y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative flex flex-col overflow-hidden rounded-3xl border-2 transition-all duration-300 h-[220px] group shadow-2xl ${
        isSub ? 'bg-gradient-to-br from-cyan-900/40 to-[#0d131b] border-cyan-500/20 hover:border-cyan-400' : 'bg-gradient-to-br from-purple-900/40 to-[#0d131b] border-purple-500/20 hover:border-purple-500'
      }`}
    >
      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all z-10" />
      
      <div className="w-full h-[140px] relative overflow-hidden">
        {cat.image ? (
          <img 
            src={cat.image} 
            alt={cat.name} 
            className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#0d131b]">
            <div className={`p-5 rounded-full bg-white/5 group-hover:bg-white/10 transition-all border ${isSub ? 'border-cyan-500/30' : 'border-purple-500/30'}`}>
               {isSub ? <Tag className="w-10 h-10 text-cyan-400" /> : <Package className="w-10 h-10 text-purple-400" />}
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d131b] to-transparent z-20" />
      </div>

      <div className="p-5 flex flex-col justify-between flex-1 relative z-30 bg-black/40 backdrop-blur-sm border-t border-white/5">
        <h3 className={`text-sm font-black tracking-[0.15em] uppercase text-white truncate group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r ${isSub ? 'from-cyan-400 to-blue-400' : 'from-purple-400 to-indigo-400'}`}>
          {cat.name}
        </h3>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-black uppercase tracking-widest ${isSub ? 'text-cyan-400' : 'text-purple-400'}`}>
            {cat.name}
          </span>
          <ChevronLeft className={`w-4 h-4 rotate-180 transition-transform duration-300 group-hover:translate-x-1 ${isSub ? 'text-cyan-400' : 'text-purple-400'}`} />
        </div>
      </div>
    </motion.button>
  );

  if (checkingAuth) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-purple-900 border-t-purple-600 rounded-full animate-spin shadow-[0_0_20px_rgba(168,85,247,0.3)]" />
          <p className="text-purple-300 font-bold uppercase tracking-widest text-xs animate-pulse">Cargando Tienda...</p>
        </div>
      </main>
    );
  }

  return (
    <main 
      className="min-h-screen pt-32 pb-20 text-white font-sans relative overflow-x-hidden"
      style={{ backgroundImage: "url('/fono.png')", backgroundSize: 'cover', backgroundAttachment: 'fixed', backgroundPosition: 'center' }}
    >
      <Script id="wowhead-config-donate" strategy="afterInteractive">
        {`window.$WowheadPower = { colorlinks: true, iconizelinks: false, renamelinks: true, locale: 'es' };`}
      </Script>
      <Script src="https://wow.zamimg.com/widgets/power.js" strategy="afterInteractive" />
      {PAYPAL_CLIENT_ID && <Script src={`https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=USD&intent=capture`} onLoad={() => setIsPayPalLoaded(true)} strategy="lazyOnload" />}
      
      <div className="absolute inset-0 bg-[#070b16]/60 backdrop-blur-[2px] z-0" />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        
        <div className="mb-12 text-center">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400 uppercase leading-[1.1] mb-2"
            >
              Donación & Recompensas
            </motion.h1>
            <p className="text-gray-400 font-medium tracking-[0.2em] uppercase text-xs">Apoya al servidor y obtén beneficios exclusivos</p>
        </div>

        <div className="flex justify-center gap-4 mb-12">
          {[
            { id: 'donations', label: 'Cargar Créditos', icon: CreditCard, color: 'purple' },
            { id: 'rewards', label: 'Tienda de Objetos', icon: ShoppingCart, color: 'cyan' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-10 py-5 rounded-3xl font-black uppercase tracking-wider text-sm transition-all duration-300 ${
                activeTab === tab.id 
                  ? `bg-gradient-to-r ${tab.color === 'purple' ? 'from-purple-600 to-indigo-600 shadow-[0_0_25px_rgba(168,85,247,0.4)]' : 'from-cyan-600 to-blue-600 shadow-[0_0_25px_rgba(6,182,212,0.4)]'} text-white` 
                  : 'bg-black/40 border border-white/5 text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'donations' && (
            <motion.section 
              key="donations"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="mb-12"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                {DONATIONS.map((don, idx) => (
                  <motion.div 
                    key={idx}
                    whileHover={{ scale: 1.03, y: -5 }}
                    className={`p-8 rounded-[2rem] bg-black/40 backdrop-blur-md border ${don.highlight ? 'border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.2)] bg-purple-900/10' : 'border-white/10'} flex flex-col items-center group transition-all`}
                  >
                    <div className="relative mb-6">
                      <Image src="/coin.png" alt="Coin" width={80} height={80} className="drop-shadow-[0_0_15px_rgba(168,85,247,0.8)] group-hover:scale-110 transition-transform" />
                      {don.badge && <div className="absolute -top-2 -right-6 bg-purple-600 text-white font-black text-[9px] px-3 py-1 rounded-full uppercase tracking-tighter ring-2 ring-purple-900">{don.badge}</div>}
                    </div>
                    <div className="font-black text-3xl mb-1 text-white">${don.amount} <span className="text-sm font-medium text-gray-500 uppercase">USD</span></div>
                    <div className="text-yellow-400 font-black text-xl mb-4 tracking-tight">{don.points} Créditos</div>
                    <button 
                      onClick={() => { setIsCustomMode(false); setSelectedDonation(don); setShowCheckout(true); }} 
                      className="mt-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black px-8 py-4 rounded-2xl w-full shadow-lg transition-all active:scale-95 uppercase text-xs"
                    >
                      Seleccionar
                    </button>
                  </motion.div>
                ))}
                
                <motion.div 
                  whileHover={{ scale: 1.03, y: -5 }}
                  className="p-8 rounded-[2rem] bg-gradient-to-br from-indigo-900/30 to-black/30 backdrop-blur-md border border-cyan-500/40 flex flex-col items-center group shadow-[0_0_20px_rgba(6,182,212,0.1)]"
                >
                  <TrendingUp className="w-16 h-16 text-cyan-400 mb-6 drop-shadow-[0_0_15px_rgba(6,182,212,0.6)] group-hover:scale-110 transition-transform" />
                  <div className="font-black text-2xl mb-1 text-cyan-300 uppercase italic">Personalizado</div>
                  <p className="text-gray-400 text-[10px] uppercase font-bold text-center mb-6 tracking-widest">Cualquier monto que desees</p>
                  <button 
                    onClick={() => { setIsCustomMode(true); setSelectedDonation({ valuePerPoint: '', amount: 0, points: 0, bonus: 0, badge: null, highlight: false, plan: 'Custom' }); setShowCheckout(true); }} 
                    className="mt-auto bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black px-8 py-4 rounded-2xl w-full shadow-lg transition-all active:scale-95 uppercase text-xs"
                  >
                    Configurar
                  </button>
                </motion.div>
              </div>
            </motion.section>
          )}

          {activeTab === 'rewards' && (
            <motion.section 
              key="rewards"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="mb-12"
            >
              {!user ? (
                <div className="bg-[#16202d]/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-16 text-center max-w-2xl mx-auto shadow-2xl">
                  <div className="w-24 h-24 bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-purple-500/20">
                    <Shield className="w-10 h-10 text-purple-400" />
                  </div>
                  <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-4">Acceso Identificado</h2>
                  <p className="text-gray-400 text-lg mb-8 leading-relaxed">Para acceder a la tienda de recompensas y canjear tus créditos, primero debes iniciar sesión en tu cuenta oficial.</p>
                  <button onClick={() => router.push('/')} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-12 py-5 rounded-[1.5rem] font-black uppercase text-sm shadow-xl transition-all active:scale-95">Ir al Inicio de Sesión</button>
                </div>
              ) : (
                <div className="space-y-8">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0b0f1a]/80 backdrop-blur-xl border-2 border-white/5 rounded-[2rem] p-8 shadow-2xl relative"
                  >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/5 rounded-full blur-[100px] -mr-32 -mt-32" />
                    <div className="relative z-10 flex flex-col md:flex-row gap-8">
                      <div className="flex-shrink-0">
                        <label className="text-purple-300 text-[10px] font-black uppercase tracking-[0.2em] mb-4 block">Canjear Beneficio Para</label>
                        <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 w-fit">
                          <button onClick={() => setDeliveryMode('self')} className={`px-8 py-3 rounded-xl font-black uppercase text-[10px] transition-all ${deliveryMode === 'self' ? 'bg-purple-600 text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}>Para Mí</button>
                          <button onClick={() => setDeliveryMode('gift')} className={`px-8 py-3 rounded-xl font-black uppercase text-[10px] transition-all ${deliveryMode === 'gift' ? 'bg-pink-600 text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}>Regalar</button>
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        {deliveryMode === 'self' ? (
                          <>
                             <label className="text-purple-300 text-[10px] font-black uppercase tracking-[0.2em] mb-4 block">Personaje Destinatario</label>
                             <select value={selectedCharacterGuid} onChange={e => setSelectedCharacterGuid(e.target.value)} className="w-full bg-black/60 border-2 border-white/5 rounded-2xl px-6 py-4 text-lg font-black text-white focus:outline-none focus:border-purple-500/50 transition-all custom-scrollbar">
                                <option value="" className="bg-[#0d131b]">-- Selecciona quién recibirá el item --</option>
                                {characters.map(c => <option key={c.guid} value={c.guid} className="bg-[#0d131b] font-bold">{c.name} (WotLK • Nv. {c.level})</option>)}
                             </select>
                          </>
                        ) : (
                          <div className="space-y-4 relative">
                             <label className="text-pink-300 text-[10px] font-black uppercase tracking-[0.2em] block">Buscar Personaje</label>
                             <div className="flex gap-3">
                                <input value={giftSearch} onChange={e => setGiftSearch(e.target.value)} placeholder="Nombre del personaje..." className="flex-1 bg-black/60 border-2 border-white/5 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-pink-500/50" />
                                <button onClick={searchGiftCharacter} className="bg-pink-600 hover:bg-pink-500 px-8 rounded-2xl font-black uppercase text-[10px]">Buscar</button>
                             </div>
                             
                             <AnimatePresence>
                               {giftSearching && (
                                 <div className="absolute top-full left-0 w-full mt-2 flex justify-center py-4 bg-black/40 rounded-xl">
                                    <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                                 </div>
                               )}
                               {giftResults.length > 0 && (
                                 <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute top-full left-0 w-full mt-2 bg-[#0b0c16] border border-white/10 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] max-h-60 overflow-y-auto custom-scrollbar">
                                   {giftResults.map(char => (
                                     <button key={char.guid} onClick={() => { setGiftCharacter(char); setGiftResults([]); setGiftSearch(''); }} className="w-full px-6 py-4 text-left hover:bg-pink-600/20 flex items-center justify-between border-b border-white/5 last:border-0 group transition-all">
                                       <div className="flex items-center gap-3">
                                         <div className="w-3 h-3 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]" />
                                         <span className="font-black text-white group-hover:text-pink-400">{char.name}</span>
                                       </div>
                                       <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Nivel {char.level} • WotLK</span>
                                     </button>
                                   ))}
                                 </motion.div>
                               )}
                             </AnimatePresence>
                             {giftSearchError && <p className="text-red-400 text-[10px] font-bold uppercase mt-2">{giftSearchError}</p>}
                          </div>
                        )}
                      </div>
                    </div>

                    {deliveryMode === 'gift' && giftCharacter && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 bg-pink-600/20 rounded-2xl flex items-center justify-center border border-pink-500/30">
                              <User className="w-7 h-7 text-pink-400" />
                           </div>
                           <div>
                              <div className="text-[10px] text-pink-400 font-bold uppercase tracking-widest">Enviando Regalo a:</div>
                              <div className="text-2xl font-black text-white">{giftCharacter.name}</div>
                           </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <label className="text-[10px] text-gray-500 font-bold uppercase mb-2">Confirma con tu PIN</label>
                          <input type="password" value={giftPin} onChange={e => setGiftPin(e.target.value.slice(0,4))} placeholder="••••" className="w-32 bg-black border-2 border-pink-500/30 rounded-xl px-4 py-3 text-center text-xl font-black tracking-[0.2em] focus:border-pink-500" />
                        </div>
                      </motion.div>
                    )}
                    
                    {purchaseMessage && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 flex items-center gap-3 bg-green-500/10 border border-green-500/30 text-green-400 p-4 rounded-2xl font-bold uppercase text-[10px] tracking-wider"><CheckCircle2 className="w-4 h-4"/> {purchaseMessage}</motion.div>}
                    {purchaseError && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl font-bold uppercase text-[10px] tracking-wider"><AlertTriangle className="w-4 h-4"/> {purchaseError}</motion.div>}
                  </motion.div>

                  <AnimatePresence mode="wait">
                    {!shopCategory ? (
                      <motion.div 
                        key="main-cats"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {shopCategories
                          .filter(cat => !cat.parent_id || Number(cat.parent_id) === 0)
                          .map(cat => (
                            <CategoryCard key={cat.id} cat={cat} onClick={() => setShopCategory(cat.slug)} />
                          ))
                        }
                        </div>

                        {/* ── GM PANEL Categorías (solo rank 3+) ── */}
                        {gmLevel >= 3 && (
                          <div className="mt-4">
                            <button
                              onClick={() => setShowCatManager(v => !v)}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-900/20 border border-amber-600/30 text-amber-300 hover:bg-amber-600/10 text-xs font-black uppercase tracking-widest transition-all"
                            >
                              <span className="text-amber-500">⚙</span>
                              {showCatManager ? 'Cerrar Gestor de Categorías' : 'Gestionar Categorías (GM)'}
                            </button>

                            {showCatManager && (
                              <div className="mt-4 p-6 rounded-2xl bg-black/60 border border-amber-600/20 backdrop-blur-md">
                                <h4 className="text-sm font-black text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                  <span>🛡</span> Panel de Gestión — Categorías de Tienda
                                </h4>

                                <CatManagerPanel
                                  categories={shopCategories}
                                  userId={user!.id}
                                  onRefresh={() =>
                                    fetch('/api/shop/categories')
                                      .then(r => r.json())
                                      .then(data => setShopCategories(Array.isArray(data) ? data : []))
                                  }
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="sub-navigation"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-8"
                      >
                        <div className="flex items-center gap-6">
                           <button 
                             onClick={() => subCategoryFilter ? setSubCategoryFilter(null) : setShopCategory(null)} 
                             className="group flex items-center gap-3 bg-white/5 hover:bg-white/10 px-6 py-4 rounded-2xl border border-white/5 transition-all active:scale-95"
                           >
                              <ChevronLeft className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                              <span className="font-black uppercase text-[10px] tracking-widest text-gray-400 group-hover:text-white">Volver</span>
                           </button>
                           <div className="h-10 w-[2px] bg-white/10 mx-2" />
                           <div className="flex flex-col">
                              <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 uppercase italic">
                                {shopCategories.find(c => c.slug === shopCategory)?.name}
                              </h3>
                              {subCategoryFilter && (
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-[2px] bg-cyan-500/50" />
                                  <span className="text-cyan-400 font-bold uppercase text-[10px] tracking-widest">
                                    {shopCategories.find(c => c.slug === subCategoryFilter)?.name}
                                  </span>
                                </div>
                              )}
                           </div>
                        </div>

                        {!subCategoryFilter && shopCategories.some(c => c.parent_id === shopCategories.find(sc => sc.slug === shopCategory)?.id) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {shopCategories
                              .filter(c => c.parent_id === shopCategories.find(sc => sc.slug === shopCategory)?.id)
                              .map(sub => (
                                <CategoryCard key={sub.id} cat={sub} isSub={true} onClick={() => setSubCategoryFilter(sub.slug)} />
                              ))
                            }
                          </div>
                        )}

                        {( !shopCategories.some(c => c.parent_id === shopCategories.find(sc => sc.slug === shopCategory)?.id) || subCategoryFilter ) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                            {filteredShopItems.map(item => (
                              <motion.div 
                                key={item.id} 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                onMouseLeave={handleMouseLeave} 
                                className="bg-[#0b0c16]/80 backdrop-blur-md border border-white/5 rounded-[2rem] overflow-hidden group flex flex-col relative h-[380px] hover:border-purple-500/30 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] transition-all duration-500"
                              >
                                <a 
                                  href={`https://www.wowhead.com/item=${item.item_id}&domain=wotlk`} 
                                  data-wowhead={`item=${item.item_id}&domain=wotlk`} 
                                  className="absolute inset-x-0 top-0 h-1/2 z-10 block opacity-0"
                                >
                                  &nbsp;
                                </a>

                                <div className="h-[180px] bg-black/40 relative overflow-hidden flex items-center justify-center border-b border-white/5">
                                  <Image 
                                    src={item.image?.startsWith('http') ? item.image : (item.image?.startsWith('/') ? item.image : `/items/${item.image || 'default.png'}`)} 
                                    alt={item.name} 
                                    fill 
                                    className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" 
                                    unoptimized 
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c16] via-transparent to-transparent z-10" />
                                  <div className={`absolute top-4 right-4 z-20 w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_currentColor] ${item.quality === 'epic' ? 'text-purple-500 bg-purple-500' : 'text-cyan-500 bg-cyan-500'}`} />
                                </div>

                                <div className="p-6 flex flex-col flex-1 relative z-20">
                                  <h4 className="font-black text-[13px] uppercase tracking-wider text-white line-clamp-1 mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-400 transition-all">
                                    {item.name}
                                  </h4>
                                  <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 mb-4 font-bold uppercase tracking-tighter">
                                    {item.description || "Un objeto de gran poder proveniente de los confines de Northrend."}
                                  </p>

                                  <div className="mt-auto space-y-4">
                                    <div className="flex items-center justify-between border-t border-white/5 pt-4">
                                       <div className="flex flex-col">
                                          {(item.price_dp > 0 || (item.price > 0 && item.currency === 'dp')) && (
                                            <div className="text-yellow-400 font-black text-sm tracking-tighter flex items-center gap-1.5">
                                              {item.price_dp || item.price} <span className="text-[8px] font-bold text-gray-500 opacity-80 uppercase">Donación</span>
                                            </div>
                                          )}
                                          {(item.price_vp > 0 || (item.currency === 'vp' && item.price > 0)) && (
                                            <div className="text-violet-400 font-black text-sm tracking-tighter flex items-center gap-1.5">
                                              {item.price_vp || item.price} <span className="text-[8px] font-bold text-gray-500 opacity-80 uppercase">Estelas</span>
                                            </div>
                                          )}
                                       </div>
                                       {item.service_type === 'bundle' && (
                                          <button 
                                            onClick={() => { setActiveKitId(item.id); setOpenKitModal(true); }} 
                                            className="p-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-xl border border-indigo-500/30 transition-all"
                                            title="Ver Contenido"
                                          >
                                            <Package className="w-4 h-4 text-indigo-400" />
                                          </button>
                                       )}
                                    </div>
                                    
                                     <div className="flex gap-2">
                                        {(item.price_dp > 0 || (item.price > 0 && item.currency === 'dp')) && (
                                          <button
                                            onClick={() => handlePurchase(item.id, 'dp')}
                                            disabled={purchasingItemId !== null}
                                            className={`flex-1 border rounded-xl py-3 font-black text-[9px] uppercase tracking-widest transition-all ${
                                              purchasingItemId === item.id
                                                ? 'bg-yellow-900/40 border-yellow-700/30 text-yellow-500 cursor-not-allowed animate-pulse'
                                                : purchasingItemId !== null
                                                ? 'bg-yellow-600/5 border-yellow-700/20 text-yellow-800 cursor-not-allowed'
                                                : ('bg-yellow-600/10 hover:bg-yellow-600 text-yellow-500 hover:text-white border-yellow-600/40 active:scale-95' + (deliveryMode === 'gift' ? ' ring-2 ring-yellow-500/50 scale-[1.02]' : ''))
                                            }`}
                                          >
                                            {purchasingItemId === item.id ? '⏳ Procesando...' : deliveryMode === 'gift' ? '🎁 Regalar con DP' : 'Canjear DP'}
                                          </button>
                                        )}
                                        {deliveryMode !== 'gift' && (item.price_vp > 0 || (item.currency === 'vp' && item.price > 0)) && (
                                          <button
                                            onClick={() => handlePurchase(item.id, 'vp')}
                                            disabled={purchasingItemId !== null}
                                            className={`flex-1 border rounded-xl py-3 font-black text-[9px] uppercase tracking-widest transition-all ${
                                              purchasingItemId === item.id
                                                ? 'bg-violet-900/40 border-violet-700/30 text-violet-500 cursor-not-allowed animate-pulse'
                                                : purchasingItemId !== null
                                                ? 'bg-violet-600/5 border-violet-700/20 text-violet-800 cursor-not-allowed'
                                                : 'bg-violet-600/10 hover:bg-violet-600 text-violet-400 hover:text-white border-violet-600/40 active:scale-95'
                                            }`}
                                          >
                                            {purchasingItemId === item.id ? '⏳ Procesando...' : 'Canjear VP'}
                                          </button>
                                        )}
                                     </div>
                                    </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* Global Kit Modal */}
      <Modal open={openKitModal} onClose={() => setOpenKitModal(false)}>
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
            <Package className="w-10 h-10 text-indigo-400" />
          </div>
          <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Contenido del Paquete</h2>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-2">Todo lo que recibirás tras la compra</p>
        </div>
        <div className="custom-scrollbar max-h-[50vh] overflow-y-auto px-4">
          {activeKitId && <KitItemList kitId={activeKitId} />}
        </div>
      </Modal>

      {/* Checkout Modal */}
      {showCheckout && selectedDonation && (
        <Modal open={showCheckout} onClose={() => setShowCheckout(false)}>
          <div className="text-center mb-10">
            <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">Escoge Método de Pago</h2>
            <div className="mt-6 bg-black/40 p-8 rounded-3xl border border-white/5 backdrop-blur-md shadow-inner">
               {isCustomMode ? (
                 <div className="space-y-4">
                    <label className="text-[10px] text-purple-300 font-black uppercase tracking-[0.3em]">Ingresa Monto en USD</label>
                    <div className="relative">
                       <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-purple-500/50">$</span>
                       <input 
                         type="number" 
                         value={customAmount} 
                         onChange={e=>setCustomAmount(e.target.value)} 
                         className="w-full bg-black/60 border-2 border-purple-500/30 rounded-2xl py-6 px-12 text-4xl font-black text-white focus:border-purple-500 transition-all text-center" 
                         placeholder="0"
                       />
                    </div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider italic">Recibirás {customAmount || '0'} Créditos (Relación 1:1)</p>
                 </div>
               ) : (
                 <div className="flex flex-col items-center">
                    <div className="text-white text-sm font-bold uppercase tracking-widest opacity-60 mb-2">Resumen de Orden</div>
                    <div className="text-yellow-400 font-black text-5xl mb-2 tracking-tighter">{selectedDonation.points} Créditos</div>
                    <div className="text-2xl font-black uppercase italic text-purple-400">${selectedDonation.amount} USD</div>
                 </div>
               )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="relative group">
              {/* Contenedor PayPal con Estilo */}
              <div id="paypal-button-container" className="w-full min-h-[150px] relative z-10" />
              {!isPayPalLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl border border-white/5">
                   <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <motion.div whileHover={{ scale: 1.02 }} className="p-6 bg-black/40 border border-amber-500/30 rounded-3xl group cursor-pointer hover:bg-amber-900/10 transition-all">
                 <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center font-black italic text-amber-500 text-xl tracking-tighter">By</div>
                    <div className="font-black text-white uppercase text-xs">Bybit / Crypto</div>
                 </div>
                 <a href="https://discord.gg/ejemplo" target="_blank" className="block text-center py-3 bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-white rounded-xl font-black uppercase text-[9px] transition-all border border-amber-500/40">Contactar Soporte</a>
               </motion.div>
               
               <motion.div whileHover={{ scale: 1.02 }} className="p-6 bg-black/40 border border-green-500/30 rounded-3xl group cursor-pointer hover:bg-green-900/10 transition-all">
                 <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center font-black text-green-500 text-xl uppercase">QR</div>
                    <div className="font-black text-white uppercase text-xs">Pago QR Bolivia</div>
                 </div>
                 <a href="/qr" target="_blank" className="block text-center py-3 bg-green-500/20 hover:bg-green-500 text-green-400 hover:text-white rounded-xl font-black uppercase text-[9px] transition-all border border-green-500/40">Ver Código QR</a>
               </motion.div>
            </div>
          </div>
          
          <button 
            onClick={() => setShowCheckout(false)} 
            className="w-full mt-8 py-5 border-2 border-white/5 hover:border-white/20 text-gray-400 hover:text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all active:scale-95"
          >
            Regresar a la Tienda
          </button>
        </Modal>
      )}

      {/* Payment Result Modal */}
      {paymentResult && (
        <Modal open={!!paymentResult} onClose={handlePaymentSuccessClose}>
          <div className="flex flex-col items-center text-center p-4">
            {paymentResult.success ? (
              <>
                <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border-2 border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
                <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-2">¡Gracias por tu compra!</h2>
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 my-6 w-full max-w-md backdrop-blur-md">
                  <div className="text-emerald-400 font-black text-3xl mb-1 flex items-center justify-center gap-2 text-shadow-glow">
                    +{paymentResult.points} <span className="text-xs uppercase tracking-widest text-gray-400">Créditos DP</span>
                  </div>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest leading-relaxed">
                    Tus créditos han sido asignados correctamente a tu cuenta. ¡Disfruta de Shadow Azeroth!
                  </p>
                </div>
                {paymentResult.transactionId && (
                  <div className="flex flex-col items-center gap-1 mb-8">
                     <span className="text-[10px] text-gray-600 font-black uppercase tracking-[0.2em]">ID de Transacción</span>
                     <span className="text-xs font-mono text-purple-400/80 bg-purple-400/5 px-3 py-1 rounded-full border border-purple-400/10">{paymentResult.transactionId}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 border-2 border-rose-500/30 shadow-[0_0_40px_rgba(244,63,94,0.2)]">
                  <AlertTriangle className="w-12 h-12 text-rose-500" />
                </div>
                <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-2 text-rose-500">Algo salió mal</h2>
                <p className="text-gray-400 font-bold text-sm mb-8 leading-relaxed max-w-sm">
                  {paymentResult.message}
                </p>
              </>
            )}

            <button 
              onClick={handlePaymentSuccessClose}
              className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-xs transition-all shadow-xl active:scale-95 ${
                paymentResult.success 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/40' 
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/40'
              }`}
            >
              Aceptar
            </button>
          </div>
        </Modal>
      )}
      
      {/* Estilos Globales Extra */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.4);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(168, 85, 247, 0.4);
          border-radius: 10px;
          border: 2px solid rgba(0, 0, 0, 0.4);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(168, 85, 247, 0.6);
        }
        .text-shadow-glow {
          text-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
        }
      `}</style>
    </main>
  );
}
