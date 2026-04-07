'use client';

import { Sparkles, CreditCard, Gift, TrendingUp, X, Shield, ShoppingCart, CheckCircle2, AlertTriangle, Search, Users, Heart, Zap, Package, ChevronLeft, Tag, User, Ticket, Timer, Crown, Target } from 'lucide-react';
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
  const normalizeParentId = (parentId: number | null | undefined): number | null => {
    const parsed = Number(parentId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  };
  const orderedCategories = [...categories].sort((a, b) => Number(a.id) - Number(b.id));
  const rootCategories = orderedCategories.filter(c => normalizeParentId(c.parent_id) === null);
  const getChildren = (parentId: number) => orderedCategories.filter(c => normalizeParentId(c.parent_id) === Number(parentId));

  const renderParentOptions = (
    nodes: { id: number; slug: string; name: string; description?: string; image?: string; parent_id?: number | null }[],
    depth = 0,
    visited = new Set<number>()
  ): JSX.Element[] => {
    const options: JSX.Element[] = [];
    for (const node of nodes) {
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      const prefix = depth > 0 ? `${'\u00A0\u00A0'.repeat(depth)}↳ ` : '';
      options.push(<option key={node.id} value={node.id}>{prefix}{node.name}</option>);
      const children = getChildren(node.id);
      if (children.length > 0) options.push(...renderParentOptions(children, depth + 1, visited));
    }
    return options;
  };

  const renderTree = (
    node: { id: number; slug: string; name: string; description?: string; image?: string; parent_id?: number | null },
    depth = 0,
    visited = new Set<number>()
  ): JSX.Element | null => {
    if (visited.has(node.id)) return null;
    visited.add(node.id);
    const children = getChildren(node.id);

    return (
      <div key={node.id} className="group">
        <div className={`flex items-center justify-between border border-white/5 rounded-xl px-4 py-2.5 transition-all hover:border-amber-500/20 ${depth === 0 ? 'bg-white/5' : 'bg-white/[0.03]'}`}>
          <div className="flex items-center gap-2 min-w-0">
            {depth > 0 ? <span className="text-amber-500/40 text-xs">↳</span> : null}
            <span className="font-bold text-sm text-white truncate">{node.name}</span>
            <span className="text-[10px] text-gray-500 font-mono truncate">{node.slug}</span>
          </div>
          <button onClick={() => handleDelete(node.id)} className="p-1.5 text-gray-600 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100">
            <span className="text-xs">✕</span>
          </button>
        </div>
        {children.length > 0 ? (
          <div className="ml-6 mt-1 space-y-1 border-l border-amber-500/10 pl-3">
            {children.map(child => renderTree(child, depth + 1, visited))}
          </div>
        ) : null}
      </div>
    );
  };

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
            {renderParentOptions(rootCategories)}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">URL de Imagen (opcional)</label>
          <input className="w-full bg-black/60 border border-amber-500/20 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400/50"
            placeholder="https://tusitio.com/imagen.webp" value={form.image_url}
            onChange={e => setForm({ ...form, image_url: e.target.value })} />
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
        {rootCategories.map(cat => renderTree(cat))}
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

function getWowItemBorderClass(qualityId?: number) {
  switch (Number(qualityId || 1)) {
    case 2: return 'border-green-400/75';
    case 3: return 'border-blue-400/75';
    case 4: return 'border-purple-400/80';
    case 5: return 'border-orange-400/85';
    case 6: return 'border-amber-300/90';
    default: return 'border-white/40';
  }
}

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

type RaffleItem = {
  id: number;
  title: string;
  description: string | null;
  prizeText: string;
  prizeItemId?: number | null;
  prizeItem?: {
    itemId: number;
    iconName: string;
    iconUrl: string;
    itemUrl: string;
    qualityId: number;
  } | null;
  status: 'draft' | 'active' | 'closed' | 'drawn';
  startsAt: string;
  endsAt: string;
  winnerAccountId: number | null;
  winnerNote?: string | null;
  drawnAt: string | null;
  totalTickets: number;
  myTickets: number;
  remainingForMe: number;
  maxTicketsPerAccount: number;
  ticketCosts: {
    dp: number;
    vp: number;
    gold: number;
  };
};

async function readApiData(res: Response): Promise<any> {
  const raw = await res.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    const looksLikeHtml = /^\s*</.test(raw);
    if (looksLikeHtml) {
      return {
        error: `El servidor devolvió HTML en vez de JSON (HTTP ${res.status}). Revisa logs del endpoint.`,
      };
    }
    return { error: raw };
  }
}

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
  const [activeTab, setActiveTab] = useState<'rewards' | 'donations' | 'raffles'>('rewards');
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
  const [raffles, setRaffles] = useState<RaffleItem[]>([]);
  const [raffleLoading, setRaffleLoading] = useState(false);
  const [raffleError, setRaffleError] = useState('');
  const [ticketQtyByRaffle, setTicketQtyByRaffle] = useState<Record<number, number>>({});
  const [ticketCurrencyByRaffle, setTicketCurrencyByRaffle] = useState<Record<number, 'dp' | 'vp' | 'gold'>>({});
  const [buyingRaffleId, setBuyingRaffleId] = useState<number | null>(null);
  const [raffleMessage, setRaffleMessage] = useState('');
  const [raffleGoldCharacterGuid, setRaffleGoldCharacterGuid] = useState<string>('');
  const [adminRaffleForm, setAdminRaffleForm] = useState({
    title: '',
    description: '',
    prizeText: '',
    prizeItemId: '',
    startsAt: '',
    endsAt: '',
    status: 'draft' as 'draft' | 'active' | 'closed',
  });
  const [savingRaffleAdmin, setSavingRaffleAdmin] = useState(false);

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

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    const link = e.currentTarget.querySelector('a[data-wowhead]');
    if (link) {
      link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      link.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
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

  const loadRaffles = async () => {
    setRaffleLoading(true);
    setRaffleError('');
    try {
      const accountId = user?.id ? `?accountId=${user.id}${gmLevel >= 3 ? '&includeAdmin=1' : ''}` : '';
      const res = await fetch(`/api/raffle${accountId}`, { cache: 'no-store' });
      const data = await readApiData(res);
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar sorteos');
      setRaffles(Array.isArray(data.raffles) ? data.raffles : []);
    } catch (err: any) {
      setRaffleError(err.message || 'Error cargando sorteos');
    } finally {
      setRaffleLoading(false);
    }
  };

  useEffect(() => {
    loadRaffles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, gmLevel]);

  const handleBuyTickets = async (raffleId: number) => {
    if (!user) {
      setRaffleError('Debes iniciar sesión para comprar tickets.');
      return;
    }

    const quantity = Number(ticketQtyByRaffle[raffleId] || 1);
    const currency = ticketCurrencyByRaffle[raffleId] || 'dp';

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setRaffleError('La cantidad de tickets debe ser mayor a 0.');
      return;
    }

    if (!raffleGoldCharacterGuid) {
      setRaffleError('Debes seleccionar el personaje destino que recibirá el premio del sorteo.');
      return;
    }

    setBuyingRaffleId(raffleId);
    setRaffleError('');
    setRaffleMessage('');

    try {
      const res = await fetch('/api/raffle/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raffleId,
          accountId: user.id,
          quantity,
          currency,
          characterGuid: Number(raffleGoldCharacterGuid),
        }),
      });
      const data = await readApiData(res);
      if (!res.ok) throw new Error(data.error || 'No se pudo completar la compra de tickets');
      setRaffleMessage(data.message || 'Tickets comprados correctamente.');
      await loadRaffles();
    } catch (err: any) {
      setRaffleError(err.message || 'Error comprando tickets');
    } finally {
      setBuyingRaffleId(null);
    }
  };

  const handleCreateRaffle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || gmLevel < 3) return;

    setSavingRaffleAdmin(true);
    setRaffleError('');
    setRaffleMessage('');
    try {
      const res = await fetch('/api/admin/raffle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          ...adminRaffleForm,
          prizeItemId: adminRaffleForm.prizeItemId ? Number(adminRaffleForm.prizeItemId) : null,
        }),
      });
      const data = await readApiData(res);
      if (!res.ok) throw new Error(data.error || 'No se pudo crear el sorteo');
      setRaffleMessage('Sorteo creado correctamente.');
      setAdminRaffleForm({
        title: '',
        description: '',
        prizeText: '',
        prizeItemId: '',
        startsAt: '',
        endsAt: '',
        status: 'draft',
      });
      await loadRaffles();
    } catch (err: any) {
      setRaffleError(err.message || 'Error creando sorteo');
    } finally {
      setSavingRaffleAdmin(false);
    }
  };

  const handleRaffleStatusUpdate = async (raffleId: number, status: 'draft' | 'active' | 'closed') => {
    if (!user || gmLevel < 3) return;

    setSavingRaffleAdmin(true);
    setRaffleError('');
    setRaffleMessage('');
    try {
      const res = await fetch('/api/admin/raffle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, raffleId, status }),
      });
      const data = await readApiData(res);
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el estado');
      setRaffleMessage('Estado del sorteo actualizado.');
      await loadRaffles();
    } catch (err: any) {
      setRaffleError(err.message || 'Error actualizando sorteo');
    } finally {
      setSavingRaffleAdmin(false);
    }
  };

  const handleDrawRaffle = async (raffleId: number) => {
    if (!user || gmLevel < 3) return;

    setSavingRaffleAdmin(true);
    setRaffleError('');
    setRaffleMessage('');
    try {
      const res = await fetch('/api/admin/raffle/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, raffleId }),
      });
      const data = await readApiData(res);
      if (!res.ok) throw new Error(data.error || 'No se pudo ejecutar el sorteo');
      setRaffleMessage(data.message || `Ganador: cuenta ${data.winnerAccountId}`);
      await loadRaffles();
    } catch (err: any) {
      setRaffleError(err.message || 'Error al sortear ganador');
    } finally {
      setSavingRaffleAdmin(false);
    }
  };

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

  const normalizeCategoryParentId = (parentId: number | null | undefined): number | null => {
    const parsed = Number(parentId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  };

  const categoryBySlug = new Map(shopCategories.map(c => [c.slug, c]));

  const getChildrenBySlug = (slug: string | null) => {
    if (!slug) return [] as typeof shopCategories;
    const current = categoryBySlug.get(slug);
    if (!current) return [] as typeof shopCategories;
    return shopCategories.filter(c => normalizeCategoryParentId(c.parent_id) === Number(current.id));
  };

  const getDescendantSlugs = (slug: string | null): string[] => {
    if (!slug) return [];
    const visited = new Set<string>();
    const stack = [slug];
    const out: string[] = [];

    while (stack.length > 0) {
      const currentSlug = stack.pop()!;
      if (visited.has(currentSlug)) continue;
      visited.add(currentSlug);
      out.push(currentSlug);

      const children = getChildrenBySlug(currentSlug);
      for (const child of children) {
        if (!visited.has(child.slug)) stack.push(child.slug);
      }
    }

    return out;
  };

  const currentBrowseSlug = subCategoryFilter || shopCategory;
  const currentBrowseCategory = currentBrowseSlug ? categoryBySlug.get(currentBrowseSlug) : null;
  const currentChildren = getChildrenBySlug(currentBrowseSlug);

  const handleBackCategory = () => {
    if (!shopCategory) return;
    if (!currentBrowseSlug || currentBrowseSlug === shopCategory) {
      setShopCategory(null);
      setSubCategoryFilter(null);
      return;
    }

    const current = categoryBySlug.get(currentBrowseSlug);
    const parentId = normalizeCategoryParentId(current?.parent_id);
    const parentSlug = parentId
      ? shopCategories.find(c => Number(c.id) === parentId)?.slug || null
      : null;

    if (!parentSlug || parentSlug === shopCategory) {
      setSubCategoryFilter(null);
      return;
    }

    setSubCategoryFilter(parentSlug);
  };

  const filteredShopItems = shopItems.filter(item => {
    if (!shopCategory) return false;
    const validSlugs = getDescendantSlugs(currentBrowseSlug || shopCategory);
    if (!validSlugs.includes(item.category || 'misc')) return false;

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

  const resolveShopImageSrc = (rawImage?: string) => {
    const value = String(rawImage || '').trim();
    if (!value) return '/items/default.png';
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('/')) return value;

    const lower = value.toLowerCase();
    if (/^(inv_|ability_|spell_|achievement_|trade_|misc_)/.test(lower)) {
      return `https://wow.zamimg.com/images/wow/icons/large/${lower}.jpg`;
    }

    return `/items/${value}`;
  };

  const CategoryCard = ({ cat, onClick, isSub = false }: { cat: any, onClick: () => void, isSub?: boolean }) => (
    <motion.button
      whileHover={{ scale: 1.02, y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative flex flex-col overflow-hidden rounded-3xl border-2 transition-all duration-300 group shadow-2xl ${
        isSub ? 'bg-gradient-to-br from-cyan-900/40 to-[#0d131b] border-cyan-500/20 hover:border-cyan-400' : 'bg-gradient-to-br from-purple-900/40 to-[#0d131b] border-purple-500/20 hover:border-purple-500'
      }`}
    >
      <div className="absolute inset-0 bg-transparent transition-all z-10" />
      
      <div className="w-full aspect-square relative overflow-hidden bg-[#060b16]">
        {cat.image ? (
          <img 
            src={cat.image} 
            alt={cat.name} 
            className="w-full h-full object-cover object-center opacity-95 group-hover:opacity-100 transition-all duration-500 group-hover:scale-[1.03]" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#0d131b]">
            <div className={`p-5 rounded-full bg-white/5 group-hover:bg-white/10 transition-all border ${isSub ? 'border-cyan-500/30' : 'border-purple-500/30'}`}>
               {isSub ? <Tag className="w-10 h-10 text-cyan-400" /> : <Package className="w-10 h-10 text-purple-400" />}
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d131b]/35 via-transparent to-transparent z-20" />
      </div>

      <div className="p-5 flex flex-col justify-between min-h-[92px] relative z-30 bg-black/40 backdrop-blur-sm border-t border-white/5">
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        
        <div className="mb-12 text-center">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400 uppercase leading-[1.1] mb-2"
            >
              Donación & Recompensas
            </motion.h1>
            <p className="text-gray-400 font-medium tracking-[0.16em] sm:tracking-[0.2em] uppercase text-[10px] sm:text-xs">Apoya al servidor y obtén beneficios exclusivos</p>
        </div>

        <div className="flex justify-center flex-wrap gap-3 sm:gap-4 mb-10 sm:mb-12">
          {[
            { id: 'donations', label: 'Cargar Créditos', icon: CreditCard, color: 'purple' },
            { id: 'rewards', label: 'Tienda de Objetos', icon: ShoppingCart, color: 'cyan' },
            { id: 'raffles', label: 'Sorteos', icon: Gift, color: 'pink' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 sm:gap-3 px-4 sm:px-8 lg:px-10 py-3 sm:py-4 lg:py-5 rounded-2xl sm:rounded-3xl font-black uppercase tracking-wider text-[11px] sm:text-sm transition-all duration-300 ${
                activeTab === tab.id 
                  ? `bg-gradient-to-r ${tab.color === 'purple' ? 'from-purple-600 to-indigo-600 shadow-[0_0_25px_rgba(168,85,247,0.4)]' : tab.color === 'cyan' ? 'from-cyan-600 to-blue-600 shadow-[0_0_25px_rgba(6,182,212,0.4)]' : 'from-pink-600 to-rose-600 shadow-[0_0_25px_rgba(236,72,153,0.4)]'} text-white` 
                  : 'bg-black/40 border border-white/5 text-gray-500 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
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

          {activeTab === 'raffles' && (
            <motion.section
              key="raffles"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="mb-12 space-y-8"
            >
              <div className="relative overflow-hidden rounded-[2rem] border border-pink-500/30 bg-gradient-to-br from-[#18070f]/90 via-[#0f0b1f]/85 to-[#0b1222]/80 p-8">
                <div className="absolute inset-0 opacity-20" style={{
                  backgroundImage: 'radial-gradient(circle at 12px 12px, rgba(255,255,255,0.28) 2px, transparent 2px)',
                  backgroundSize: '24px 24px'
                }} />
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[40rem] h-44 bg-pink-500/25 blur-3xl" />

                <div className="relative z-10 text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-pink-300">
                    <Ticket className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-[0.24em]">Modo Pachinko</span>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black italic uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-fuchsia-300 to-cyan-300">
                    Sorteos de Shadow Azeroth
                  </h2>
                  <p className="text-sm text-pink-100/80 font-semibold uppercase tracking-widest">
                    Límite por cuenta: 1000 tickets por sorteo
                  </p>
                  <p className="text-xs text-gray-300 font-bold uppercase tracking-[0.18em]">
                    Costo por ticket: 1 DP o 1 Estela o 5,000 de oro
                  </p>
                </div>
              </div>

              {raffleMessage && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-emerald-300 font-bold text-xs uppercase tracking-widest">
                  {raffleMessage}
                </div>
              )}
              {raffleError && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-rose-300 font-bold text-xs uppercase tracking-widest">
                  {raffleError}
                </div>
              )}

              {user && (
                <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 space-y-2">
                  <p className="text-[10px] text-yellow-300 font-black uppercase tracking-widest">
                    Pago con oro desde la página
                  </p>
                  <p className="text-xs text-yellow-100/90 font-semibold">
                    Si eliges moneda Oro para tickets, se descuenta directamente del personaje que selecciones aquí.
                  </p>
                  <select
                    value={raffleGoldCharacterGuid}
                    onChange={(e) => setRaffleGoldCharacterGuid(e.target.value)}
                    className="w-full max-w-xl bg-black/60 border border-yellow-500/30 rounded-xl px-4 py-3 text-white font-black"
                  >
                    <option value="">-- Selecciona personaje para pagar con oro --</option>
                    {characters.map((c) => (
                      <option key={c.guid} value={c.guid}>{c.name} (nivel {c.level || '?'})</option>
                    ))}
                  </select>
                </div>
              )}

              {raffleLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-10 h-10 rounded-full border-2 border-pink-500 border-t-transparent animate-spin" />
                </div>
              ) : raffles.length === 0 ? (
                <div className="rounded-[2rem] border border-white/10 bg-black/40 p-10 text-center text-gray-400 font-bold uppercase tracking-[0.18em] text-xs">
                  No hay sorteos disponibles por ahora.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {raffles.map((raffle) => {
                    const selectedCurrency = ticketCurrencyByRaffle[raffle.id] || 'dp';
                    const selectedQty = Number(ticketQtyByRaffle[raffle.id] || 1);
                    const unit = selectedCurrency === 'dp'
                      ? raffle.ticketCosts.dp
                      : selectedCurrency === 'vp'
                        ? raffle.ticketCosts.vp
                        : raffle.ticketCosts.gold;

                    const costLabel = selectedCurrency === 'gold'
                      ? `${(unit * selectedQty).toLocaleString()} oro`
                      : `${unit * selectedQty} ${selectedCurrency.toUpperCase()}`;

                    const canBuy = raffle.status === 'active' && raffle.remainingForMe > 0;
                    const isEnded = Date.now() >= new Date(raffle.endsAt).getTime();
                    const isFinalized = raffle.status === 'drawn' || raffle.status === 'closed' || isEnded;

                    return (
                      <div
                        key={raffle.id}
                        className={`relative overflow-hidden rounded-[2rem] border p-6 space-y-5 backdrop-blur-md ${
                          isFinalized
                            ? 'border-gray-500/35 bg-gray-900/45'
                            : 'border-pink-500/20 bg-black/35'
                        }`}
                      >
                        <div className="absolute -right-16 -top-20 w-52 h-52 rounded-full bg-pink-500/10 blur-3xl" />

                        <div className="relative z-10 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-2xl font-black uppercase tracking-tight text-white">{raffle.title}</h3>
                            <p className="text-xs text-pink-300 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                              <Crown className="w-3.5 h-3.5" /> Premio: {raffle.prizeText}
                            </p>
                            {raffle.prizeItemId ? (
                              <p className="text-[10px] text-cyan-300 font-black uppercase tracking-widest mt-1">
                                ID premio: {raffle.prizeItemId}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              raffle.status === 'active'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : raffle.status === 'drawn'
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                            }`}>
                              {raffle.status}
                            </span>

                            {raffle.prizeItem ? (
                              <div className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                                <a
                                  href={raffle.prizeItem.itemUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  data-wowhead={`item=${raffle.prizeItem.itemId}&domain=wotlk`}
                                  className={`block w-12 h-12 rounded-sm overflow-hidden border bg-black/70 shadow-[0_0_12px_rgba(34,211,238,0.25)] ${getWowItemBorderClass(raffle.prizeItem.qualityId)}`}
                                  title={`Item #${raffle.prizeItem.itemId}`}
                                >
                                  <Image
                                    src={raffle.prizeItem.iconUrl}
                                    alt={`Item ${raffle.prizeItem.itemId}`}
                                    width={48}
                                    height={48}
                                    unoptimized
                                    className="w-full h-full object-cover"
                                  />
                                </a>
                              </div>
                            ) : (
                              <div className="rounded-xl border border-gray-500/30 bg-black/50 w-[56px] h-[56px] flex items-center justify-center text-[9px] text-gray-400 font-black uppercase">
                                Sin ID
                              </div>
                            )}
                          </div>
                        </div>

                        {raffle.description && (
                          <p className="text-sm text-gray-300 leading-relaxed">{raffle.description}</p>
                        )}

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                            <p className="text-gray-400 uppercase tracking-widest font-black">Tus tickets</p>
                            <p className="text-xl font-black text-pink-300">{raffle.myTickets}</p>
                            <p className="text-[10px] font-black text-pink-200/80 uppercase tracking-widest mt-1">
                              Comprados: {raffle.myTickets}/{raffle.maxTicketsPerAccount}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                            <p className="text-gray-400 uppercase tracking-widest font-black">Total tickets</p>
                            <p className="text-xl font-black text-cyan-300">{raffle.totalTickets}</p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/35 p-3 space-y-2">
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black flex items-center gap-2">
                            <Timer className="w-3.5 h-3.5 text-pink-400" /> Cierra
                          </p>
                          <p className="font-black text-white">{new Date(raffle.endsAt).toLocaleString()}</p>
                          {isEnded && raffle.status !== 'drawn' && (
                            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">El tiempo terminó, esperando sorteo.</p>
                          )}
                        </div>

                        {canBuy && user ? (
                          <div className="space-y-3 border-t border-white/10 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <input
                                type="number"
                                min={1}
                                max={raffle.remainingForMe}
                                value={ticketQtyByRaffle[raffle.id] || 1}
                                onChange={(e) => setTicketQtyByRaffle((prev) => ({
                                  ...prev,
                                  [raffle.id]: Math.max(1, Math.min(raffle.remainingForMe, Number(e.target.value) || 1)),
                                }))}
                                className="bg-black/60 border border-pink-500/30 rounded-xl px-4 py-3 text-white font-black focus:outline-none focus:border-pink-400"
                              />

                              <select
                                value={selectedCurrency}
                                onChange={(e) => setTicketCurrencyByRaffle((prev) => ({
                                  ...prev,
                                  [raffle.id]: e.target.value as 'dp' | 'vp' | 'gold',
                                }))}
                                className="bg-black/60 border border-pink-500/30 rounded-xl px-4 py-3 text-white font-black focus:outline-none focus:border-pink-400"
                              >
                                <option value="dp">DP</option>
                                <option value="vp">Estelas</option>
                                <option value="gold">Oro</option>
                              </select>

                              <button
                                onClick={() => handleBuyTickets(raffle.id)}
                                disabled={buyingRaffleId === raffle.id}
                                className={`rounded-xl px-4 py-3 font-black uppercase tracking-widest text-[11px] transition-all ${
                                  buyingRaffleId === raffle.id
                                    ? 'bg-pink-900/40 border border-pink-700/30 text-pink-300 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-[0_0_20px_rgba(236,72,153,0.35)]'
                                }`}
                              >
                                {buyingRaffleId === raffle.id ? 'Comprando...' : 'Comprar tickets'}
                              </button>
                            </div>

                            <select
                              value={raffleGoldCharacterGuid}
                              onChange={(e) => setRaffleGoldCharacterGuid(e.target.value)}
                              className="w-full bg-black/60 border border-pink-500/30 rounded-xl px-4 py-3 text-white font-black"
                            >
                              <option value="">-- Personaje destino del premio --</option>
                              {characters.map((c) => (
                                <option key={c.guid} value={c.guid}>{c.name} (nivel {c.level || '?'})</option>
                              ))}
                            </select>

                            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-gray-300">
                              <span className="flex items-center gap-2"><Target className="w-3.5 h-3.5 text-cyan-400" /> Restantes: {raffle.remainingForMe}</span>
                              <span>Costo: {costLabel}</span>
                            </div>

                            {selectedCurrency === 'gold' && (
                              <p className="text-[10px] text-amber-300 font-bold uppercase tracking-widest">
                                Para pagar con oro, selecciona el personaje arriba en "Pago con oro desde la pagina".
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                            {user ? 'No puedes comprar más tickets en este sorteo.' : 'Inicia sesión para comprar tickets.'}
                          </p>
                        )}

                        {raffle.status === 'drawn' && raffle.winnerAccountId && (
                          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs font-black uppercase tracking-widest text-cyan-300">
                            Ganador: Cuenta #{raffle.winnerAccountId}
                            {raffle.winnerNote ? <span className="block mt-1 text-[10px] text-cyan-200">{raffle.winnerNote}</span> : null}
                          </div>
                        )}

                        {raffle.status === 'closed' && !raffle.winnerAccountId && (
                          <div className="rounded-xl border border-gray-500/30 bg-gray-500/10 p-3 text-xs font-black uppercase tracking-widest text-gray-300">
                            Sorteo cerrado sin ganador
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {gmLevel >= 3 && user && (
                <div className="rounded-[2rem] border border-amber-500/30 bg-black/50 p-6 space-y-6">
                  <h3 className="text-lg font-black uppercase tracking-widest text-amber-300">Panel GM - Sorteos</h3>

                  <form onSubmit={handleCreateRaffle} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      value={adminRaffleForm.title}
                      onChange={(e) => setAdminRaffleForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Nombre del sorteo"
                      required
                      className="bg-black/60 border border-amber-500/30 rounded-xl px-4 py-3 text-white"
                    />
                    <input
                      value={adminRaffleForm.prizeText}
                      onChange={(e) => setAdminRaffleForm((p) => ({ ...p, prizeText: e.target.value }))}
                      placeholder="Premio"
                      required
                      className="bg-black/60 border border-amber-500/30 rounded-xl px-4 py-3 text-white"
                    />
                    <input
                      value={adminRaffleForm.prizeItemId}
                      onChange={(e) => setAdminRaffleForm((p) => ({ ...p, prizeItemId: e.target.value.replace(/[^0-9]/g, '') }))}
                      placeholder="ID del item/premio (opcional)"
                      className="bg-black/60 border border-amber-500/30 rounded-xl px-4 py-3 text-white"
                    />
                    <input
                      value={adminRaffleForm.description}
                      onChange={(e) => setAdminRaffleForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Descripción"
                      className="md:col-span-2 bg-black/60 border border-amber-500/30 rounded-xl px-4 py-3 text-white"
                    />
                    <input
                      type="datetime-local"
                      value={adminRaffleForm.startsAt}
                      onChange={(e) => setAdminRaffleForm((p) => ({ ...p, startsAt: e.target.value }))}
                      required
                      className="bg-black/60 border border-amber-500/30 rounded-xl px-4 py-3 text-white"
                    />
                    <input
                      type="datetime-local"
                      value={adminRaffleForm.endsAt}
                      onChange={(e) => setAdminRaffleForm((p) => ({ ...p, endsAt: e.target.value }))}
                      required
                      className="bg-black/60 border border-amber-500/30 rounded-xl px-4 py-3 text-white"
                    />
                    <select
                      value={adminRaffleForm.status}
                      onChange={(e) => setAdminRaffleForm((p) => ({ ...p, status: e.target.value as 'draft' | 'active' | 'closed' }))}
                      className="bg-black/60 border border-amber-500/30 rounded-xl px-4 py-3 text-white"
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="closed">Closed</option>
                    </select>
                    <button
                      type="submit"
                      disabled={savingRaffleAdmin}
                      className="bg-gradient-to-r from-amber-600 to-orange-600 text-black font-black uppercase tracking-widest rounded-xl px-4 py-3 disabled:opacity-60"
                    >
                      {savingRaffleAdmin ? 'Guardando...' : 'Crear sorteo'}
                    </button>
                  </form>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {raffles.map((raffle) => (
                      <div key={`gm-${raffle.id}`} className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-black text-sm text-white uppercase tracking-wide">{raffle.title}</p>
                          <span className="text-[10px] text-gray-400 font-black uppercase">{raffle.status}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-widest">Tickets: {raffle.totalTickets}</div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => handleRaffleStatusUpdate(raffle.id, 'draft')} className="px-3 py-2 rounded-lg border border-white/20 text-xs font-black text-gray-200">Draft</button>
                          <button onClick={() => handleRaffleStatusUpdate(raffle.id, 'active')} className="px-3 py-2 rounded-lg border border-emerald-500/40 text-xs font-black text-emerald-300">Activar</button>
                          <button onClick={() => handleRaffleStatusUpdate(raffle.id, 'closed')} className="px-3 py-2 rounded-lg border border-amber-500/40 text-xs font-black text-amber-300">Cerrar</button>
                          <button onClick={() => handleDrawRaffle(raffle.id)} className="px-3 py-2 rounded-lg border border-pink-500/40 text-xs font-black text-pink-300">Sortear</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                            <CategoryCard key={cat.id} cat={cat} onClick={() => { setShopCategory(cat.slug); setSubCategoryFilter(null); }} />
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
                             onClick={handleBackCategory}
                             className="group flex items-center gap-3 bg-white/5 hover:bg-white/10 px-6 py-4 rounded-2xl border border-white/5 transition-all active:scale-95"
                           >
                              <ChevronLeft className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                              <span className="font-black uppercase text-[10px] tracking-widest text-gray-400 group-hover:text-white">Volver</span>
                           </button>
                           <div className="h-10 w-[2px] bg-white/10 mx-2" />
                           <div className="flex flex-col">
                              <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 uppercase italic">
                                {currentBrowseCategory?.name || shopCategories.find(c => c.slug === shopCategory)?.name}
                              </h3>
                              {currentBrowseSlug && currentBrowseSlug !== shopCategory && (
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-[2px] bg-cyan-500/50" />
                                  <span className="text-cyan-400 font-bold uppercase text-[10px] tracking-widest">
                                    Ruta activa: {shopCategories.find(c => c.slug === shopCategory)?.name} / {currentBrowseCategory?.name}
                                  </span>
                                </div>
                              )}
                           </div>
                        </div>

                        {currentChildren.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {currentChildren.map(sub => (
                              <CategoryCard key={sub.id} cat={sub} isSub={true} onClick={() => setSubCategoryFilter(sub.slug)} />
                            ))}
                          </div>
                        )}

                        {currentChildren.length === 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                            {filteredShopItems.map(item => (
                              <motion.div 
                                key={item.id} 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                onMouseLeave={handleMouseLeave} 
                                className="bg-[#0b0c16]/85 backdrop-blur-md border border-white/5 rounded-[2rem] overflow-hidden group flex flex-col relative hover:border-purple-500/30 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] transition-all duration-500"
                              >
                                <a 
                                  href={`https://www.wowhead.com/item=${item.item_id}&domain=wotlk`} 
                                  data-wowhead={`item=${item.item_id}&domain=wotlk`} 
                                  className="absolute inset-x-0 top-0 h-[65%] z-10 block opacity-0"
                                >
                                  &nbsp;
                                </a>

                                <div className="aspect-square w-full bg-black/40 relative overflow-hidden flex items-center justify-center border-b border-white/5">
                                  <Image 
                                    src={resolveShopImageSrc(item.image)} 
                                    alt={item.name} 
                                    fill 
                                    className="object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" 
                                    unoptimized 
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c16] via-transparent to-transparent z-10" />
                                  <div className={`absolute top-4 right-4 z-20 w-3 h-3 rounded-full animate-pulse shadow-[0_0_10px_currentColor] ${item.quality === 'epic' ? 'text-purple-500 bg-purple-500' : 'text-cyan-500 bg-cyan-500'}`} />
                                </div>

                                <div className="p-5 flex flex-col flex-1 relative z-20">
                                  <h4 className="font-black text-[13px] uppercase tracking-wider text-white line-clamp-1 mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-400 transition-all">
                                    {item.name}
                                  </h4>
                                  <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 mb-4 font-bold uppercase tracking-tighter">
                                    {item.description || "Un objeto de gran poder proveniente de los confines de Northrend."}
                                  </p>

                                  <div className="mt-auto space-y-4">
                                    {item.service_type === 'bundle' && (
                                      <button
                                        onClick={() => { setActiveKitId(item.id); setOpenKitModal(true); }}
                                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-indigo-400/45 bg-gradient-to-r from-indigo-500/25 to-cyan-500/20 px-3 py-2 text-indigo-100 hover:from-indigo-500 hover:to-cyan-500 hover:text-white shadow-[0_0_24px_rgba(99,102,241,0.2)] transition-all"
                                        title="Abrir previsualización del contenido"
                                      >
                                        <Package className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Previsualizar Contenido del Pack</span>
                                      </button>
                                    )}

                                    <div className="flex items-center justify-between border-t border-white/5 pt-4">
                                       <div className="flex flex-col gap-1">
                                          {(item.price_dp > 0 || (item.price > 0 && item.currency === 'dp')) && (
                                            <div className="inline-flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-2.5 py-1 text-yellow-300 font-black text-sm tracking-tighter">
                                              {item.price_dp || item.price} <span className="text-[9px] font-bold text-yellow-100/70 uppercase">Donación</span>
                                            </div>
                                          )}
                                          {(item.price_vp > 0 || (item.currency === 'vp' && item.price > 0)) && (
                                            <div className="inline-flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/30 rounded-lg px-2.5 py-1 text-violet-300 font-black text-sm tracking-tighter">
                                              {item.price_vp || item.price} <span className="text-[9px] font-bold text-violet-100/70 uppercase">Estelas</span>
                                            </div>
                                          )}
                                       </div>
                                       {item.service_type === 'bundle' && (
                                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-2 py-1">
                                            Incluye varios items
                                          </span>
                                       )}
                                    </div>
                                    
                                     <div className="flex gap-2">
                                        {(item.price_dp > 0 || (item.price > 0 && item.currency === 'dp')) && (
                                          <button
                                            onClick={() => handlePurchase(item.id, 'dp')}
                                            disabled={purchasingItemId !== null}
                                            className={`flex-1 border rounded-xl py-3.5 font-black text-[10px] uppercase tracking-widest transition-all ${
                                              purchasingItemId === item.id
                                                ? 'bg-yellow-900/40 border-yellow-700/30 text-yellow-500 cursor-not-allowed animate-pulse'
                                                : purchasingItemId !== null
                                                ? 'bg-yellow-600/5 border-yellow-700/20 text-yellow-800 cursor-not-allowed'
                                                : ('bg-gradient-to-r from-yellow-500/25 to-amber-500/20 hover:from-yellow-500 hover:to-amber-500 text-yellow-200 hover:text-black border-yellow-400/50 shadow-[0_0_20px_rgba(234,179,8,0.15)] active:scale-95' + (deliveryMode === 'gift' ? ' ring-2 ring-yellow-500/60 scale-[1.02]' : ''))
                                            }`}
                                          >
                                            {purchasingItemId === item.id ? '⏳ Procesando...' : deliveryMode === 'gift' ? '🎁 Regalar con DP' : 'Canjear DP'}
                                          </button>
                                        )}
                                        {deliveryMode !== 'gift' && (item.price_vp > 0 || (item.currency === 'vp' && item.price > 0)) && (
                                          <button
                                            onClick={() => handlePurchase(item.id, 'vp')}
                                            disabled={purchasingItemId !== null}
                                            className={`flex-1 border rounded-xl py-3.5 font-black text-[10px] uppercase tracking-widest transition-all ${
                                              purchasingItemId === item.id
                                                ? 'bg-violet-900/40 border-violet-700/30 text-violet-500 cursor-not-allowed animate-pulse'
                                                : purchasingItemId !== null
                                                ? 'bg-violet-600/5 border-violet-700/20 text-violet-800 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-violet-500/25 to-fuchsia-500/20 hover:from-violet-500 hover:to-fuchsia-500 text-violet-100 hover:text-white border-violet-400/50 shadow-[0_0_20px_rgba(139,92,246,0.16)] active:scale-95'
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
                    <label className="text-[10px] text-purple-300 font-black uppercase tracking-[0.16em] sm:tracking-[0.3em]">Ingresa Monto en USD</label>
                    <div className="relative">
                       <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-purple-500/50">$</span>
                       <input 
                         type="number" 
                         value={customAmount} 
                         onChange={e=>setCustomAmount(e.target.value)} 
                         className="w-full bg-black/60 border-2 border-purple-500/30 rounded-2xl py-5 sm:py-6 px-10 sm:px-12 text-3xl sm:text-4xl font-black text-white focus:border-purple-500 transition-all text-center" 
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
              className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.16em] sm:tracking-[0.3em] text-xs transition-all shadow-xl active:scale-95 ${
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
