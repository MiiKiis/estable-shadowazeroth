'use client';

import { Sparkles, CreditCard, Gift, TrendingUp, X, Shield, ShoppingCart, CheckCircle2, AlertTriangle, Search, Users, Heart, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Script from 'next/script';

const DONATIONS = [
  { amount: 1, points: 1, bonus: 0, badge: null, highlight: false, plan: 'Inicial' },
  { amount: 5, points: 5, bonus: 0, badge: null, highlight: false, plan: 'Base' },
  { amount: 10, points: 10, bonus: 0, badge: 'RECOMENDADO', highlight: true, plan: 'Recomendado' },
  { amount: 20, points: 20, bonus: 0, badge: null, highlight: false, plan: 'Créditos' },
  { amount: 30, points: 30, bonus: 0, badge: null, highlight: false, plan: 'Créditos' },
  { amount: 50, points: 50, bonus: 0, badge: 'MEJOR VALOR', highlight: true, plan: 'Créditos' },
].map(item => ({
  ...item,
  valuePerPoint: (item.amount / item.points).toFixed(2)
}));

const MAX_CREDITS_PER_DOLLAR = Math.max(...DONATIONS.map(item => item.points / item.amount));

const SHOP_CATEGORIES = [
  { id: 'all', label: 'TODOS' },
  { id: 'pve', label: 'PvE (Tiers)'   },
  { id: 'pvp', label: 'PvP'   },
  { id: 'profesiones', label: 'PROFESIONES' },
  { id: 'monturas', label: 'MONTURAS Y MASCOTAS' },
  { id: 'transmo', label: 'TRANSFIGURACIÓN' },
  { id: 'oro', label: 'ORO' },
  { id: 'boost', label: 'SUBIDA DE NIVEL' },
  { id: 'misc', label: 'OTROS' },
];

const PROFESSIONS = [
  'all',
  'herboristeria',
  'mineria',
  'alquimia',
  'ingenieria',
  'sastreria',
  'herreria',
  'encantamiento',
  'inscripcion',
  'peleteria',
  'joyeria',
  'cocina',
  'primeros auxilios',
];

const CLASS_COLORS: Record<number, string> = {
  1: '#C79C6E', 2: '#F58CBA', 3: '#ABD473', 4: '#FFF569',
  5: '#FFFFFF', 6: '#C41F3B', 7: '#0070DE', 8: '#69CCF0',
  9: '#9482C9', 11: '#FF7D0A',
};
const CLASS_NAMES: Record<number, string> = {
  1: 'Guerrero', 2: 'Paladin', 3: 'Cazador', 4: 'Picaro',
  5: 'Sacerdote', 6: 'Cab. Muerte', 7: 'Shaman', 8: 'Mago',
  9: 'Brujo', 11: 'Druida',
};

const WOW_CLASSES = [
  { mask: 0,    name: 'Todos',                 abbr: 'ALL', color: '#9ca3af' },
  { mask: 1,    name: 'Guerrero',              abbr: 'GUE', color: '#C79C6E' },
  { mask: 2,    name: 'Paladin',               abbr: 'PAL', color: '#F58CBA' },
  { mask: 4,    name: 'Cazador',               abbr: 'CAZ', color: '#ABD473' },
  { mask: 8,    name: 'Picaro',                abbr: 'PIC', color: '#FFF569' },
  { mask: 16,   name: 'Sacerdote',             abbr: 'SAC', color: '#FFFFFF' },
  { mask: 32,   name: 'Cab. de la Muerte',     abbr: 'DK',  color: '#C41F3B' },
  { mask: 64,   name: 'Shaman',                abbr: 'SHA', color: '#0070DE' },
  { mask: 128,  name: 'Mago',                  abbr: 'MAG', color: '#69CCF0' },
  { mask: 256,  name: 'Brujo',                 abbr: 'BRU', color: '#9482C9' },
  { mask: 1024, name: 'Druida',                abbr: 'DRU', color: '#FF7D0A' },
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
  quality: string;
  category?: string;
  tier?: number;
  class_mask?: number;
  transmog_type?: string;
  transmog_level?: number;
  profession?: string;
  faction?: string;
};

export default function DonatePage() {
  const router = useRouter();
  // Elimina tabs, muestra ambos apartados siempre
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<(typeof DONATIONS)[number] | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [shopCategory, setShopCategory] = useState<string>('all');
  const [shopTier, setShopTier] = useState<number>(0);
  const [shopClassFilter, setShopClassFilter] = useState<number>(0);
  const [transmogTypeFilter, setTransmogTypeFilter] = useState<'all' | 'arma' | 'armadura'>('all');
  const [transmogLevelFilter, setTransmogLevelFilter] = useState<0 | 60 | 70>(0);
  const [professionFilter, setProfessionFilter] = useState<string>('all');
  const [mountFactionFilter, setMountFactionFilter] = useState<'all' | 'horda' | 'alianza'>('all');
  const [tier9FactionFilter, setTier9FactionFilter] = useState<'all' | 'horda' | 'alianza'>('all');
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
  const [creatingCryptoInvoice, setCreatingCryptoInvoice] = useState(false);
  // Definir activeTab para evitar error
  const [activeTab, setActiveTab] = useState<'rewards' | 'donations'>('rewards');
  const [targetAccountId, setTargetAccountId] = useState<string>('');

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      setCheckingAuth(false);
      return;
    }
    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      // Cargar personajes
      fetch(`/api/characters?accountId=${parsedUser.id}`)
        .then(res => res.json())
        .then(data => {
          setCharacters(data.characters || []);
        });
      // Cargar items de la tienda
      fetch(`/api/shop/items`)
        .then(res => res.json())
        .then(data => {
          setShopItems(data.items || []);
        });
    } catch (e) {
      setUser(null);
      setCharacters([]);
      setShopItems([]);
    } finally {
      setCheckingAuth(false);
    }
  }, [router]);

  const handlePurchase = async (itemId: number) => {
    if (!user) {
      setPurchaseError('Debes iniciar sesion para comprar.');
      return;
    }

    const isGift = deliveryMode === 'gift';
    const targetGuid = isGift ? giftCharacter?.guid : Number(selectedCharacterGuid);

    if (!targetGuid) {
      setPurchaseError(isGift ? 'Busca y selecciona un personaje destino.' : 'Selecciona un personaje para recibir la compra.');
      return;
    }

    if (isGift && !/^\d{4}$/.test(giftPin.trim())) {
      setPurchaseError('Debes ingresar tu PIN de 4 digitos para regalar.');
      return;
    }

    setPurchasingItemId(itemId);
    setPurchaseMessage('');
    setPurchaseError('');

    try {
      const response = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          itemId,
          characterGuid: targetGuid,
          isGift,
          pin: isGift ? giftPin.trim() : undefined,
          targetAccountId: targetAccountId.trim() ? Number(targetAccountId) : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.details || 'No se pudo completar la compra');
      }

      setPurchaseMessage(data.message || (isGift ? 'Regalo enviado con exito' : 'Compra realizada con exito'));
      if (isGift) {
        setGiftPin('');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al procesar la compra';
      setPurchaseError(message);
    } finally {
      setPurchasingItemId(null);
    }
  };

  const searchGiftCharacter = async () => {
    const query = giftSearch.trim();
    if (query.length < 2) {
      setGiftSearchError('Escribe al menos 2 letras.');
      return;
    }
    setGiftSearching(true);
    setGiftSearchError('');
    setGiftResults([]);
    setGiftCharacter(null);
    try {
      const res = await fetch(`/api/characters/search?name=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error buscando personaje');
      const results: CharacterOption[] = data.characters || [];
      if (results.length === 0) setGiftSearchError('Sin resultados. Verifica el nombre exacto.');
      else setGiftResults(results);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al buscar';
      setGiftSearchError(message);
    } finally {
      setGiftSearching(false);
    }
  };

  const handleCryptomusCheckout = async () => {
    if (!selectedDonation || creatingCryptoInvoice) return;

    setCreatingCryptoInvoice(true);

    try {
      const response = await fetch('/api/payments/cryptomus/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedDonation.amount,
          currency: 'USD',
          userId: user?.id || 0,
          donationPoints: selectedDonation.points,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo iniciar el pago con Cryptomus');
      }

      if (data.paymentUrl) {
        window.open(data.paymentUrl, '_blank');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al iniciar el pago crypto';
      alert(message);
    } finally {
      setCreatingCryptoInvoice(false);
    }
  };

  const filteredShopItems = shopItems.filter(item => {
    const itemCat = item.category || 'misc';

    if (shopCategory !== 'all' && itemCat !== shopCategory) return false;

    // We reuse `shopTier` as a universal sub-filter parameter for ease of state management
    if (shopTier !== 0) {
      if (shopCategory === 'pve' && (item.tier ?? 0) !== shopTier) return false;
      if (shopCategory === 'monturas' && (item.tier ?? 0) !== shopTier) return false;
      if (shopCategory === 'transmo' && (item.tier ?? 0) !== shopTier) return false;
      if (shopCategory === 'boost' && (item.tier ?? 0) !== shopTier) return false;
      if (shopCategory === 'profesiones' && (item.tier ?? 0) !== shopTier) return false;
    }

    if (shopClassFilter !== 0) {
      const mask = item.class_mask ?? 0;
      if (mask !== 0 && !(mask & shopClassFilter)) return false;
    }

    return true;
  });


  // Loader robusto para evitar hydration mismatch
  if (checkingAuth) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="w-12 h-12 border-4 border-purple-900 border-t-purple-600 rounded-full animate-spin" />
      </main>
    );
  }

  // Renderiza el contenido solo cuando checkingAuth es false
  return (
    <main 
      className="min-h-screen pt-32 pb-20 text-white selection:bg-purple-600/30 font-sans relative overflow-x-hidden"
      style={{
        backgroundImage: "url('/fono.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <Script id="wowhead-config-donate" strategy="afterInteractive">
        {`window.$WowheadPower = { colorlinks: true, iconizelinks: false, renamelinks: true, locale: 'es' };`}
      </Script>
      <Script src="https://wow.zamimg.com/widgets/power.js" strategy="afterInteractive" />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/50 z-0" />

      {/* ========== TAB BAR ========== */}
      <div className="max-w-6xl mx-auto px-6 relative z-10 pt-10">
      <div className="flex gap-2 mb-8 border-b border-purple-700/40">
        <button
          onClick={() => setActiveTab('donations')}
          className={`px-8 py-3 font-bold text-lg rounded-t-xl transition-all border-b-2 ${activeTab === 'donations' ? 'border-purple-500 text-purple-300 bg-purple-900/30' : 'border-transparent text-gray-400 hover:text-purple-300'}`}
        >
          <Gift className="inline w-5 h-5 mr-2 -mt-1" />Donaciones
        </button>
        <button
          onClick={() => setActiveTab('rewards')}
          className={`px-8 py-3 font-bold text-lg rounded-t-xl transition-all border-b-2 ${activeTab === 'rewards' ? 'border-purple-500 text-purple-300 bg-purple-900/30' : 'border-transparent text-gray-400 hover:text-purple-300'}`}
        >
          <Sparkles className="inline w-5 h-5 mr-2 -mt-1" />Recompensas
        </button>
      </div>

      {/* ===== TAB: DONACIONES ===== */}
      {activeTab === 'donations' && (
        <section className="mb-12">
          <h2 className="text-4xl font-black mb-6">Precios y paquetes de donación</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mb-10">
            {DONATIONS.map((don, idx) => (
              <div key={idx} className="p-7 rounded-xl bg-black/40 border border-purple-400/30 flex flex-col items-center shadow-lg">
                <img src="/coin.png" alt="Coin" className="w-14 h-14 mb-3 drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]" />
                <div className="font-black text-2xl mb-2">{don.amount} USD</div>
                <div className="text-yellow-400 font-black text-xl mb-1">{don.points} Créditos</div>
                {don.bonus > 0 && <div className="text-green-400 font-bold mb-1">+{don.bonus}% Bonus</div>}
                <div className="text-gray-400 text-sm mb-2">{don.plan}</div>
                {don.badge && <div className="text-purple-300 font-bold text-xs uppercase bg-purple-900/30 px-3 py-1 rounded-lg mb-2">{don.badge}</div>}
                <button
                  className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-lg transition-all"
                  onClick={() => { setSelectedDonation(don); setShowCheckout(true); }}
                >Donar</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== TAB: RECOMPENSAS / TIENDA ===== */}
      {activeTab === 'rewards' && (
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-8 h-8 text-purple-400" />
            <h2 className="text-4xl font-black">Tienda de Recompensas</h2>
          </div>

          {!user ? (
            <div className="bg-purple-900/20 border border-purple-600/40 rounded-2xl p-10 text-center">
              <Shield className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <p className="text-gray-300 text-lg mb-4">Inicia sesión para ver y comprar recompensas con tus créditos.</p>
              <button
                onClick={() => router.push('/')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 py-3 rounded-xl transition-all"
              >Iniciar sesión</button>
            </div>
          ) : (
            <>
                {/* Character / Delivery picker */}
                <div className="bg-black/60 border-2 border-purple-700/50 rounded-2xl p-6 md:p-8 mb-6 shadow-2xl">
                  {/* Delivery Mode options */}
                  <div className="flex flex-col md:flex-row gap-6 mb-6 pb-6 border-b border-purple-500/20">
                    <div className="flex-shrink-0">
                      <label className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3 block">Modo de Entrega</label>
                      <div className="grid grid-cols-2 gap-3 w-full md:w-80">
                        <button
                          onClick={() => setDeliveryMode('self')}
                          className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl font-bold border-2 transition-all ${deliveryMode === 'self' ? 'bg-purple-900 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-black/40 border-purple-900/40 text-gray-500 hover:text-white hover:border-purple-700'}`}
                        ><Users className="w-6 h-6" />Para Mí</button>
                        <button
                          onClick={() => setDeliveryMode('gift')}
                          className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl font-bold border-2 transition-all ${deliveryMode === 'gift' ? 'bg-pink-900 border-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]' : 'bg-black/40 border-purple-900/40 text-gray-500 hover:text-white hover:border-pink-700'}`}
                        ><Gift className="w-6 h-6" />Regalar</button>
                      </div>
                    </div>

                    {deliveryMode === 'self' && (
                      <div className="flex-1">
                        <label className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3 block">Tus Personajes</label>
                        {characters.length > 0 ? (
                          <select
                            value={selectedCharacterGuid}
                            onChange={e => setSelectedCharacterGuid(e.target.value)}
                            className="w-full bg-[#070a13] border-2 border-purple-700/60 text-white rounded-xl px-5 py-4 font-bold text-lg focus:outline-none focus:border-purple-400 transition-colors shadow-inner"
                          >
                            <option value="">-- Selecciona el personaje que recibirá la compra --</option>
                            {characters.map(c => (
                              <option key={c.guid} value={c.guid}>{c.name} (Nivel {c.level})</option>
                            ))}
                          </select>
                        ) : (
                          <div className="w-full bg-red-900/20 border-2 border-red-500/40 text-red-200 rounded-xl px-5 py-4 font-semibold text-center flex items-center justify-center gap-2">
                             <AlertTriangle className="w-5 h-5 shrink-0" />
                             <span>No tienes ningún personaje creado en esta cuenta. Entra al juego para crear uno.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                {/* Account Transfer Field (Global or contextual) */}
                {deliveryMode === 'self' && shopItems.some(i => i.id === purchasingItemId && i.service_type === 'character_transfer') && (
                   <div className="bg-orange-950/20 border border-orange-500/30 rounded-2xl p-6 mb-6">
                     <label className="text-orange-300 font-bold block mb-2">ID de la Cuenta Destino</label>
                     <input
                        type="number"
                        placeholder="Ingresa el ID de la cuenta donde quieres mover el personaje"
                        value={targetAccountId}
                        onChange={e => setTargetAccountId(e.target.value)}
                        className="w-full bg-black/60 border border-orange-500/40 text-white rounded-xl px-4 py-3"
                     />
                     <p className="text-xs text-gray-400 mt-2">Asegúrate de que el ID sea correcto, esta acción no se puede deshacer.</p>
                   </div>
                )}

                {/* Purchase messages */}
                  {/* Gift delivery mode inputs */}
                  {deliveryMode === 'gift' && (
                    <div className="w-full flex flex-col lg:flex-row gap-8">
                      {/* Personajes del usuario también disponibles en Regalar para autoregalos entre cuentas? The user said "la búsqueda de todos los personajes de la cuenta y más visible" */}
                      <div className="flex-1">
                         <label className="text-pink-400 text-xs uppercase tracking-widest font-bold mb-3 block flex items-center gap-2"><Search className="w-4 h-4"/> Buscar destinatario</label>
                         <div className="flex gap-3 mb-2">
                            <input
                              type="text"
                              value={giftSearch}
                              onChange={e => setGiftSearch(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && searchGiftCharacter()}
                              placeholder="Escribe el nombre del personaje..."
                              className="flex-1 bg-[#070a13] border-2 border-pink-900/40 text-white rounded-xl px-5 py-3 focus:outline-none focus:border-pink-500"
                            />
                            <button onClick={searchGiftCharacter} disabled={giftSearching} className="bg-pink-600 hover:bg-pink-500 px-6 py-3 rounded-xl text-white font-black uppercase tracking-wider transition-colors shadow-lg">
                              Buscar
                            </button>
                         </div>
                         {giftSearchError && <p className="text-red-400 text-sm mb-2">{giftSearchError}</p>}
                         
                         {/* Quick pick from user's own characters to gift to their Alts easily */}
                         {characters.length > 0 && giftResults.length === 0 && !giftCharacter && (
                            <div className="mt-4 pt-4 border-t border-purple-900/30">
                              <p className="text-gray-400 text-xs mb-3">O selecciona rápidamente uno de tus personajes:</p>
                              <div className="flex flex-wrap gap-2">
                                {characters.map(c => (
                                  <button key={c.guid} onClick={() => setGiftCharacter(c)} className="bg-purple-900/30 border border-purple-500/20 px-3 py-1.5 rounded-lg text-sm text-purple-200 hover:bg-purple-600 hover:text-white transition-colors">
                                    {c.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                         )}

                         {giftResults.length > 0 && !giftCharacter && (
                           <div className="mt-4 bg-black/40 p-4 rounded-xl border border-pink-900/50">
                             <p className="text-white text-sm mb-3 font-semibold">Resultados encontrados:</p>
                             <div className="flex flex-wrap gap-2">
                               {giftResults.map(c => (
                                 <button key={c.guid} onClick={() => setGiftCharacter(c)} className="bg-pink-900/40 border border-pink-500/50 px-4 py-2 rounded-xl text-sm font-bold text-white hover:bg-pink-600 transition-all shadow-md">
                                   {c.name} <span className="text-pink-300 ml-1">(Nv. {c.level})</span>
                                 </button>
                               ))}
                             </div>
                           </div>
                         )}

                         {giftCharacter && (
                           <div className="mt-4 bg-pink-950/40 border border-pink-500 rounded-xl p-4 flex items-center justify-between shadow-[0_0_20px_rgba(236,72,153,0.2)]">
                             <div className="flex items-center gap-3">
                               <Gift className="w-8 h-8 text-pink-400" />
                               <div>
                                 <p className="text-gray-400 text-xs uppercase">Destinatario Confirmado</p>
                                 <p className="text-xl font-black text-white">{giftCharacter.name}</p>
                               </div>
                             </div>
                             <button onClick={() => setGiftCharacter(null)} className="text-pink-400 hover:text-white bg-black/50 p-2 rounded-lg"><X className="w-5 h-5" /></button>
                           </div>
                         )}
                      </div>

                      <div className="w-full lg:w-64">
                         <label className="text-pink-400 text-xs uppercase tracking-widest font-bold mb-3 block flex items-center gap-2"><Shield className="w-4 h-4"/> Confirmación PIN</label>
                         <p className="text-xs text-gray-400 mb-3">Ingresa tu PIN de seguridad (4 dígitos) para envolver el regalo.</p>
                         <input
                           type="password"
                           value={giftPin}
                           onChange={e => setGiftPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                           placeholder="••••"
                           className="w-full bg-[#070a13] border-2 border-pink-900/40 text-center text-3xl tracking-[1em] h-16 text-white rounded-xl focus:outline-none focus:border-pink-500 font-black"
                           maxLength={4}
                         />
                      </div>
                    </div>
                  )}
                </div>

              {/* Feedback */}
              {purchaseMessage && (
                <div className="flex items-center gap-3 bg-green-900/30 border border-green-500/40 rounded-xl px-6 py-3 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="text-green-300 font-semibold">{purchaseMessage}</span>
                </div>
              )}
              {purchaseError && (
                <div className="flex items-center gap-3 bg-red-900/30 border border-red-500/40 rounded-xl px-6 py-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <span className="text-red-300 font-semibold">{purchaseError}</span>
                </div>
              )}

              {/* Category filters */}
              <div className="flex flex-wrap gap-2 mb-4">
                {SHOP_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { setShopCategory(cat.id); setShopTier(0); setShopClassFilter(0); }}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${shopCategory === cat.id ? 'bg-purple-700 border-purple-500 text-white' : 'bg-black/30 border-purple-700/30 text-gray-400 hover:text-white'}`}
                  >{cat.label}</button>
                ))}
              </div>

              {/* Sub-filters: PvE tiers */}
              {/* Sub-filters logic mapping */}
              {shopCategory === 'pve' && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {[0,1,2,3,4,5,6,7,8,9].map(t => (
                    <button key={t} onClick={() => setShopTier(t)} className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${shopTier === t ? 'bg-yellow-600 border-yellow-500 text-white shadow-[0_0_10px_rgba(202,138,4,0.5)]' : 'bg-black/30 border-gray-600 text-gray-400 hover:text-white hover:border-gray-400'}`}>
                      {t === 0 ? 'Todos los Tiers' : `Tier ${t}`}
                    </button>
                  ))}
                </div>
              )}

              {shopCategory === 'profesiones' && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <button onClick={() => setShopTier(0)} className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${shopTier === 0 ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-black/30 border-gray-600 text-gray-400'}`}>Todas</button>
                  {/* Map index as tier (1 to 12) for professions */}
                  {PROFESSIONS.filter(p => p !== 'all').map((prof, idx) => {
                    const t = idx + 1; // 1 to length
                    return (
                    <button key={t} onClick={() => setShopTier(t)} className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${shopTier === t ? 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-black/30 border-gray-600 text-gray-400 hover:text-white hover:border-gray-400'}`}>
                      {prof.charAt(0).toUpperCase() + prof.slice(1)}
                    </button>
                  )})}
                </div>
              )}

              {shopCategory === 'monturas' && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <button onClick={() => setShopTier(0)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${shopTier === 0 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-black/30 border-gray-600 text-gray-400'}`}>Todas</button>
                  <button onClick={() => setShopTier(1)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${shopTier === 1 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-black/30 border-gray-600 text-gray-400'}`}>Terrestres</button>
                  <button onClick={() => setShopTier(2)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${shopTier === 2 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-black/30 border-gray-600 text-gray-400'}`}>Voladoras</button>
                </div>
              )}

              {shopCategory === 'transmo' && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <button onClick={() => setShopTier(0)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${shopTier === 0 ? 'bg-fuchsia-600 border-fuchsia-500 text-white' : 'bg-black/30 border-gray-600 text-gray-400'}`}>Todos</button>
                  <button onClick={() => setShopTier(1)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${shopTier === 1 ? 'bg-fuchsia-600 border-fuchsia-500 text-white' : 'bg-black/30 border-gray-600 text-gray-400'}`}>Tela</button>
                  <button onClick={() => setShopTier(2)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${shopTier === 2 ? 'bg-fuchsia-600 border-fuchsia-500 text-white' : 'bg-black/30 border-gray-600 text-gray-400'}`}>Cuero</button>
                  <button onClick={() => setShopTier(3)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${shopTier === 3 ? 'bg-fuchsia-600 border-fuchsia-500 text-white' : 'bg-black/30 border-gray-600 text-gray-400'}`}>Malla</button>
                  <button onClick={() => setShopTier(4)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${shopTier === 4 ? 'bg-fuchsia-600 border-fuchsia-500 text-white' : 'bg-black/30 border-gray-600 text-gray-400'}`}>Placas</button>
                  <button onClick={() => setShopTier(5)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${shopTier === 5 ? 'bg-fuchsia-600 border-fuchsia-500 text-white' : 'bg-black/30 border-gray-600 text-gray-400'}`}>Armas/Otros</button>
                </div>
              )}

              {shopCategory === 'boost' && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <button onClick={() => setShopTier(0)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${shopTier === 0 ? 'bg-orange-600 border-orange-500 text-white' : 'bg-black/30 border-gray-600 text-gray-400'}`}>Todos</button>
                  <button onClick={() => setShopTier(60)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${shopTier === 60 ? 'bg-orange-600 border-orange-500 text-white' : 'bg-black/30 border-gray-600 text-gray-400'}`}>Insta Nivel 60</button>
                  <button onClick={() => setShopTier(70)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${shopTier === 70 ? 'bg-orange-600 border-orange-500 text-white' : 'bg-black/30 border-gray-600 text-gray-400'}`}>Insta Nivel 70</button>
                  <button onClick={() => setShopTier(80)} className={`px-4 py-2 rounded-lg text-sm font-bold border ${shopTier === 80 ? 'bg-orange-600 border-orange-500 text-white' : 'bg-black/30 border-gray-600 text-gray-400'}`}>Insta Nivel 80</button>
                </div>
              )}

              {/* Class filter */}
              <div className="flex flex-wrap gap-2 mb-6">
                {WOW_CLASSES.map(cls => (
                  <button
                    key={cls.mask}
                    onClick={() => setShopClassFilter(shopClassFilter === cls.mask ? 0 : cls.mask)}
                    style={{ borderColor: shopClassFilter === cls.mask ? cls.color : undefined, color: shopClassFilter === cls.mask ? cls.color : undefined }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${shopClassFilter === cls.mask ? 'bg-black/80 shadow-[0_0_8px_currentColor]' : 'bg-black/30 border-gray-700 text-gray-400 hover:bg-black/50 hover:border-gray-500'}`}
                  >{cls.name}</button>
                ))}
              </div>

              {/* Items grid */}
              {shopItems.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                  <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No hay items en la tienda aún. El administrador puede añadirlos desde el panel.</p>
                </div>
              ) : filteredShopItems.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <p>No hay items en esta categoría / filtro.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredShopItems.map(item => {
                    const qualityColors: Record<string, string> = {
                      common: '#9d9d9d', uncommon: '#1eff00', rare: '#0070dd', epic: '#a335ee', legendary: '#ff8000',
                    };
                    const borderColor = qualityColors[item.quality] || '#555';
                    const isPurchasing = purchasingItemId === item.id;
                    return (
                      <div
                        key={item.id}
                        style={{ borderColor }}
                        className="relative flex flex-col items-center bg-[#060a13]/90 rounded-2xl border-2 p-4 hover:scale-105 transition-all duration-200 group cursor-default"
                      >
                        <div className="flex-1 w-full space-y-4">
                          <div className="flex gap-4 group/item">
                            <a 
                              href={item.item_id && item.item_id > 0 ? `https://www.wowhead.com/wotlk/item=${item.item_id}` : '#'}
                              data-wowhead={item.item_id && item.item_id > 0 ? `item=${item.item_id}&domain=wotlk` : ''}
                              target="_blank"
                              rel="noopener"
                              className="relative w-20 h-20 flex-shrink-0"
                            >
                              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent group-hover/item:opacity-0 transition-opacity" />
                              {(() => {
                                const rawIcon = (item.image || 'inv_misc_questionmark').trim().toLowerCase();
                                const iconName = rawIcon || 'inv_misc_questionmark';
                                const imageSrc = iconName.startsWith('http') 
                                  ? iconName 
                                  : (iconName.startsWith('/') || iconName.includes('.') 
                                      ? (iconName.startsWith('/') ? iconName : `/items/${iconName}`)
                                      : `https://wow.zamimg.com/images/wow/icons/large/${iconName}.jpg`
                                    );
                                
                                return (
                                  <Image
                                    src={imageSrc}
                                    alt={item.name}
                                    fill
                                    className="rounded-xl object-cover border border-white/10 shadow-lg"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      if (target.src !== '/items/default.png') {
                                        target.src = '/items/default.png';
                                      }
                                    }}
                                    unoptimized={imageSrc.startsWith('http')}
                                  />
                                );
                              })()}
                            </a>

                            <div className="flex-1 flex flex-col justify-center min-w-0">
                              <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
                                item.quality === 'leyenda' ? 'text-orange-400' : 
                                item.quality === 'epico' ? 'text-purple-400' : 
                                item.quality === 'raro' ? 'text-blue-400' : 'text-gray-400'
                              }`}>
                                {item.quality || 'COMÚN'}
                              </span>
                              <a
                                href={item.item_id && item.item_id > 0 ? `https://www.wowhead.com/wotlk/item=${item.item_id}` : '#'}
                                data-wowhead={item.item_id && item.item_id > 0 ? `item=${item.item_id}&domain=wotlk` : ''}
                                target="_blank"
                                rel="noopener"
                                className="text-white font-black text-lg leading-tight block group-hover/item:text-cyan-300 transition-colors"
                              >
                                {item.name}
                              </a>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-yellow-400 font-black text-base">{item.price}</span>
                                <span className="text-yellow-400/60 font-bold text-xs uppercase tracking-tighter">
                                  Créditos
                                </span>
                              </div>
                            </div>
                          </div>

                          <p className="text-[11px] text-gray-400 leading-relaxed italic opacity-70">
                            Previsualización rápida del ítem. Haz click en el icono para abrir la ficha completa.
                          </p>
                          
                          {item.class_mask !== undefined && Number(item.class_mask) > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {WOW_CLASSES.filter(c => c.mask !== 0 && (Number(item.class_mask) & c.mask)).map(c => (
                                <span key={c.mask} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] font-bold text-gray-400 uppercase">
                                  {c.abbr}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => handlePurchase(item.id)}
                          disabled={isPurchasing}
                          className={`w-full mt-4 py-4 rounded-xl flex items-center justify-center gap-3 font-black text-sm uppercase tracking-wider transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98] ${
                            isPurchasing 
                              ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                              : 'bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white shadow-purple-900/20'
                          }`}
                        >
                          {isPurchasing ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <ShoppingCart className="w-5 h-5" />
                          )}
                          {isPurchasing ? 'Procesando…' : 'Comprar ahora'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>

    {/* Payment modal (shown from donations tab) */}
    {showCheckout && selectedDonation && (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-purple-900/80 to-black/80 border-2 border-purple-600 rounded-lg max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto relative">
          <button onClick={() => setShowCheckout(false)} className="absolute top-4 right-4 p-2 hover:bg-purple-700/50 rounded-lg transition-all">
            <X className="w-6 h-6 text-white" />
          </button>
          <div className="text-center mb-8">
            <h2 className="text-4xl font-black text-white mb-4">Selecciona tu Método de Pago</h2>
            <div className="flex justify-center items-center gap-4 bg-purple-900/30 rounded-lg p-4">
              <img src="/coin.png" alt="Créditos" className="w-14 h-14 drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]" />
              <div className="text-left">
                <div className="text-purple-200 font-semibold">Cantidad: ${selectedDonation.amount} USD</div>
                <div className="text-yellow-400 font-black text-xl">{selectedDonation.points} Créditos</div>
                <div className="text-gray-400 text-sm">{selectedDonation.plan}{selectedDonation.bonus > 0 ? ` • +${selectedDonation.bonus}% bonus` : ''}</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-6 bg-black/40 border border-yellow-400/30 rounded-lg flex flex-col items-center">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2"><rect width="48" height="48" rx="12" fill="#F3BA2F" /><rect x="20" y="8" width="8" height="8" rx="2" fill="#181A20" /><rect x="8" y="20" width="8" height="8" rx="2" fill="#181A20" /><rect x="32" y="20" width="8" height="8" rx="2" fill="#181A20" /><rect x="20" y="32" width="8" height="8" rx="2" fill="#181A20" /><rect x="14" y="14" width="20" height="20" rx="4" fill="#181A20" /></svg>
              <div className="font-black text-2xl mb-1">Binance</div>
              <div className="text-yellow-300 font-bold mb-2">USDT, BNB, BTC</div>
              <div className="text-gray-400 text-sm mb-4 text-center">Envío directo a wallet. Solicita el QR al staff.</div>
              <button className="bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg">Solicitar QR</button>
            </div>
            <div className="p-6 bg-black/40 border border-blue-400/30 rounded-lg flex flex-col items-center">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2"><rect width="48" height="48" rx="12" fill="#0070BA" /><ellipse cx="24" cy="24" rx="14" ry="8" fill="#fff" /><rect x="18" y="16" width="12" height="16" rx="6" fill="#003087" /><rect x="22" y="20" width="4" height="8" rx="2" fill="#0070BA" /></svg>
              <div className="font-black text-2xl mb-1">PayPal</div>
              <div className="text-blue-300 font-bold mb-2">Pago internacional</div>
              <div className="text-gray-400 text-sm mb-4 text-center">Solicita el correo PayPal al staff.</div>
              <button className="bg-blue-400 text-black font-bold px-6 py-3 rounded-lg">Solicitar correo</button>
            </div>
            <div className="p-6 bg-black/40 border border-red-400/30 rounded-lg flex flex-col items-center">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2"><rect width="48" height="48" rx="12" fill="#E51C23" /><rect x="8" y="16" width="32" height="16" rx="4" fill="#fff" /><rect x="12" y="20" width="8" height="8" rx="2" fill="#F3BA2F" /><rect x="28" y="20" width="8" height="8" rx="2" fill="#0070BA" /></svg>
              <div className="font-black text-2xl mb-1">Tarjeta de crédito</div>
              <div className="text-red-300 font-bold mb-2">Visa, MasterCard</div>
              <div className="text-gray-400 text-sm mb-4 text-center">Solicita el enlace de pago al staff.</div>
              <button className="bg-red-400 text-black font-bold px-6 py-3 rounded-lg">Solicitar enlace</button>
            </div>
            <div className="p-6 bg-black/40 border border-green-400/30 rounded-lg flex flex-col items-center">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2"><rect width="48" height="48" rx="12" fill="#43A047" /><rect x="12" y="12" width="24" height="24" rx="4" fill="#fff" /><rect x="16" y="16" width="4" height="4" fill="#43A047" /><rect x="28" y="16" width="4" height="4" fill="#43A047" /><rect x="16" y="28" width="4" height="4" fill="#43A047" /><rect x="28" y="28" width="4" height="4" fill="#43A047" /><rect x="22" y="22" width="4" height="4" fill="#43A047" /></svg>
              <div className="font-black text-2xl mb-1">QR Bolivia</div>
              <div className="text-green-300 font-bold mb-2">Solo para Bolivia</div>
              <div className="text-gray-400 text-sm mb-4 text-center">El QR puede caducar, revisa las instrucciones.</div>
              <a href="/payments/qr-bolivia" target="_blank" rel="noopener" className="bg-green-400 text-black font-bold px-6 py-3 rounded-lg block hover:bg-green-500 transition-all">Ver QR</a>
            </div>
          </div>
          <div className="bg-purple-900/30 border border-purple-600/50 rounded-lg p-4 text-center text-gray-300 text-sm mb-4">
            <p>Todos los pagos son procesados de forma segura. Una vez completado, recibirás tus créditos inmediatamente.</p>
          </div>
          <button onClick={() => setShowCheckout(false)} className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-all">Cancelar</button>
        </div>
      </div>
    )}
  </main>
  );
}

